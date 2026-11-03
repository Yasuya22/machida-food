-- =====================================================================
-- 町田ポイントの交換
--
--   * 交換品は「店舗の販促」として、その店のオーナー（または運営）が登録する
--     → 交換すると、その店のクーポン（kind = 'exchange'）がお客様に配られる
--     → 店舗間の精算は発生しない（CLAUDE.md：町田ポイントは換金・値引き不可、購入不可）
--   * ポイントは減るが、ランクは累計獲得ポイントで決まるので下がらない
--   * 残高不足・同じ交換品の2回目・在庫切れはDB側で止める
--   * 同じ人の交換は1件ずつ順番に処理する（同時に押されても残高を二重に使えない）
-- =====================================================================

create table public.exchange_items (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  coupon_id   uuid not null unique references public.coupons (id) on delete cascade,
  title       text not null,
  description text,
  points_cost int not null check (points_cost between 1 and 100000),
  stock       int check (stock >= 0),
  is_active   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index exchange_items_store_idx on public.exchange_items (store_id, is_active);
alter table public.exchange_items enable row level security;

-- 交換品のクーポンは同じ店の「ポイント交換用」クーポンに限る
create function public.check_exchange_item() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if not exists (select 1 from coupons where id = new.coupon_id and store_id = new.store_id and kind = 'exchange') then
    raise exception 'exchange_coupon_mismatch' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger exchange_items_check before insert or update on public.exchange_items
  for each row execute function public.check_exchange_item();

create policy exchange_items_read on public.exchange_items for select
  using (store_visible(store_id) and (is_active or is_store_member(store_id) or is_admin()));
create policy exchange_items_write on public.exchange_items for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

create function public.exchange_points(p_item uuid) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid := auth.uid();
  it exchange_items%rowtype;
  c coupons%rowtype;
  v_balance int;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where user_id = v_user) then
    raise exception 'not_registered' using errcode = '42501';
  end if;

  -- 同じ人の交換を順番に処理する
  perform pg_advisory_xact_lock(hashtextextended('exchange:' || v_user::text, 0));

  select * into it from exchange_items where id = p_item for update;
  if not found or not it.is_active then raise exception 'exchange_not_available' using errcode = '22023'; end if;
  select * into c from coupons where id = it.coupon_id;
  if not c.is_active or now() < c.starts_at or (c.ends_at is not null and now() >= c.ends_at)
     or not exists (select 1 from stores where id = it.store_id and status = 'approved') then
    raise exception 'exchange_not_available' using errcode = '22023';
  end if;
  if it.stock is not null and it.stock <= 0 then raise exception 'exchange_sold_out' using errcode = '22023'; end if;
  if exists (select 1 from user_coupons where user_id = v_user and coupon_id = it.coupon_id) then
    raise exception 'exchange_already_done' using errcode = '23505';
  end if;

  select coalesce(sum(delta), 0) into v_balance from point_ledger where user_id = v_user;
  if v_balance < it.points_cost then raise exception 'not_enough_points' using errcode = '22023'; end if;

  insert into user_coupons (user_id, coupon_id, source) values (v_user, it.coupon_id, 'exchange');
  perform add_points(v_user, -it.points_cost, 'ポイント交換：' || it.title, 'exchange', it.id);
  if it.stock is not null then
    update exchange_items set stock = stock - 1 where id = it.id;
  end if;
  perform write_audit('exchange', it.store_id, v_user, jsonb_build_object('item', it.id, 'points', -it.points_cost));

  return jsonb_build_object('status', 'exchanged', 'title', it.title, 'points', it.points_cost, 'balance', v_balance - it.points_cost);
end $$;

revoke execute on function public.check_exchange_item() from public, anon, authenticated;
revoke execute on function public.exchange_points(uuid) from public, anon;
grant execute on function public.exchange_points(uuid) to authenticated;
