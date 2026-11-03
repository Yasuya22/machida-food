-- =====================================================================
-- 店舗PIN（予備の来店認証）
--
-- 店舗の端末で会員証QRを読み取れないときの予備。
-- お客様が自分のスマホで「店舗PINでスタンプ」を開き、スタッフがその画面に店舗PINを入力して確定する。
--
--   * PINは店舗ごと・毎日（日本時間）自動で変わる4桁。オーナーはいつでも作り直せる
--   * PINの元になる秘密の値（store_pin_secrets）は画面から読めない（RLS有効・ポリシーなし）
--   * PINを見られるのは、その店のオーナー・スタッフだけ（store_pin_today）
--   * 1人・1店舗・1日あたり5回間違えると、その日はPINでの来店処理を止める（総当たり対策）
--   * 成功・失敗はすべて audit_logs に記録する
--   * スタンプとポイントの付け方は会員証QRと同じ（共通の内部関数 grant_visit にまとめる）
-- =====================================================================

create table public.store_pin_secrets (
  store_id   uuid primary key references public.stores (id) on delete cascade,
  secret     text not null default replace(gen_random_uuid()::text, '-', ''),
  rotated_at timestamptz not null default now()
);
alter table public.store_pin_secrets enable row level security;
revoke all on public.store_pin_secrets from anon, authenticated;

-- 今日のPIN（内部用）。秘密の値がなければ作る
create function public.pin_for(p_store uuid, p_day date) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  v_secret text;
begin
  insert into store_pin_secrets (store_id) values (p_store) on conflict (store_id) do nothing;
  select secret into v_secret from store_pin_secrets where store_id = p_store;
  return lpad(((('x' || substr(md5(v_secret || ':' || p_day::text), 1, 8))::bit(32)::bigint % 10000))::text, 4, '0');
end $$;

-- 来店スタンプとポイントの付与（会員証QR・店舗PINで共通。内部用）
create function public.grant_visit(p_user uuid, p_store uuid, p_by uuid, p_method text) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_today date := tokyo_today();
  v_stamp uuid;
  v_first boolean;
  v_hop boolean;
  v_adult boolean;
  v_rate numeric;
  v_points int := 0;
  v_count int;
  v_goal int;
  v_reward text;
  v_reward_issued boolean := false;
begin
  insert into stamps (user_id, store_id, visit_date, granted_by)
  values (p_user, p_store, v_today, p_by)
  on conflict (user_id, store_id, visit_date) do nothing
  returning id into v_stamp;

  if v_stamp is null then
    perform write_audit('visit_duplicate', p_store, p_user, jsonb_build_object('method', p_method));
    return jsonb_build_object('status', 'already_stamped_today');
  end if;

  select count(*) = 1 into v_first from stamps where user_id = p_user and store_id = p_store;
  select exists (select 1 from stamps where user_id = p_user and visit_date = v_today and store_id <> p_store) into v_hop;
  select adult_confirmed_at is not null into v_adult from profiles where user_id = p_user;
  v_rate := coalesce((rank_of(p_user)).point_rate, 1);

  v_points := v_points + add_points(p_user, round(setting_int('visit_points', 50) * v_rate)::int, '来店スタンプ', 'stamp', v_stamp);
  if v_first then
    v_points := v_points + add_points(p_user, setting_int('first_visit_bonus', 100), '初めてのお店', 'stamp', v_stamp);
  end if;
  if v_hop and v_adult then
    v_points := v_points + add_points(p_user, setting_int('hop_bonus', 80), 'はしごボーナス', 'stamp', v_stamp);
  end if;

  select count(*) into v_count from stamps where user_id = p_user and store_id = p_store;
  select stamp_goal, stamp_reward into v_goal, v_reward from stores where id = p_store;
  if v_reward is not null and v_count % v_goal = 0 then
    insert into stamp_rewards (user_id, store_id, title) values (p_user, p_store, v_reward);
    v_reward_issued := true;
  end if;

  perform write_audit('visit', p_store, p_user,
    jsonb_build_object('points', v_points, 'first', v_first, 'hop', v_hop and v_adult, 'reward', v_reward_issued, 'method', p_method));

  return jsonb_build_object('status', 'stamped', 'points', v_points, 'first_visit', v_first,
                            'hop_bonus', v_hop and v_adult, 'stamp_count', v_count % v_goal,
                            'reward_issued', v_reward_issued);
end $$;

-- 会員証QRでの来店処理（動きは従来と同じ。付与部分を共通関数に移した）
create or replace function public.redeem_visit(p_token text, p_store uuid) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid;
begin
  if auth.uid() is null or not is_store_member(p_store) then
    raise exception 'not_store_member' using errcode = '42501';
  end if;
  if not exists (select 1 from stores where id = p_store and status = 'approved') then
    raise exception 'store_not_active' using errcode = '22023';
  end if;
  v_user := token_user(p_token);
  if v_user is null then raise exception 'invalid_or_expired_token' using errcode = '22023'; end if;
  return grant_visit(v_user, p_store, auth.uid(), 'qr');
end $$;

-- 今日の店舗PIN（その店のオーナー・スタッフだけ）
create function public.store_pin_today(p_store uuid) returns text
  language plpgsql security definer set search_path = public
  as $$
begin
  if auth.uid() is null or not is_store_member(p_store) then
    raise exception 'not_store_member' using errcode = '42501';
  end if;
  return pin_for(p_store, tokyo_today());
end $$;

-- 店舗PINの作り直し（オーナー・運営）。今日のPINもすぐ変わる
create function public.rotate_store_pin(p_store uuid) returns void
  language plpgsql security definer set search_path = public
  as $$
begin
  if auth.uid() is null or not (is_store_owner(p_store) or is_admin()) then
    raise exception 'not_store_owner' using errcode = '42501';
  end if;
  insert into store_pin_secrets (store_id) values (p_store)
  on conflict (store_id) do update set secret = replace(gen_random_uuid()::text, '-', ''), rotated_at = now();
  perform write_audit('pin_rotated', p_store, null, '{}');
end $$;

-- お客様の端末で、スタッフが店舗PINを入力して来店スタンプを付ける
create function public.redeem_visit_by_pin(p_store uuid, p_pin text) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid := auth.uid();
  v_fails int;
  v_limit int := setting_int('pin_max_failures', 5);
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where user_id = v_user) then
    raise exception 'not_registered' using errcode = '42501';
  end if;
  if not exists (select 1 from stores where id = p_store and status = 'approved') then
    raise exception 'store_not_active' using errcode = '22023';
  end if;

  select count(*) into v_fails from audit_logs
   where action = 'pin_failed' and store_id = p_store and target_user = v_user
     and (created_at at time zone 'Asia/Tokyo')::date = tokyo_today();
  if v_fails >= v_limit then
    raise exception 'pin_locked' using errcode = '42501';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4}$' or p_pin <> pin_for(p_store, tokyo_today()) then
    perform write_audit('pin_failed', p_store, v_user, jsonb_build_object('remaining', v_limit - v_fails - 1));
    return jsonb_build_object('status', 'wrong_pin', 'remaining', greatest(v_limit - v_fails - 1, 0));
  end if;

  return grant_visit(v_user, p_store, v_user, 'pin');
end $$;

insert into public.app_settings (key, value, note) values
  ('pin_max_failures', '5', '店舗PINを1人・1店舗・1日に間違えられる回数（超えるとその日は停止）')
on conflict (key) do nothing;

-- 権限：内部用は画面から呼べない。PINの表示・作り直しはログイン者（中で店舗権限を確認）
revoke execute on function public.pin_for(uuid, date)                      from public, anon, authenticated;
revoke execute on function public.grant_visit(uuid, uuid, uuid, text)      from public, anon, authenticated;
revoke execute on function public.store_pin_today(uuid)                    from public, anon;
revoke execute on function public.rotate_store_pin(uuid)                   from public, anon;
revoke execute on function public.redeem_visit_by_pin(uuid, text)          from public, anon;
grant execute on function public.store_pin_today(uuid)                     to authenticated;
grant execute on function public.rotate_store_pin(uuid)                    to authenticated;
grant execute on function public.redeem_visit_by_pin(uuid, text)           to authenticated;
