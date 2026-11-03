-- =====================================================================
-- MACHIDA FOOD 開発用プロジェクト（machida-food-dev）の初期セットアップ
-- 内容：Phase 1 のデータベース定義 ＋ デモ用の架空5店舗の初期データ
-- 使い方：Supabase の SQL Editor に全文を貼り付けて Run（1回だけ）
-- 注意：開発用プロジェクト専用。本番プロジェクトには初期データ部分を入れない
--       supabase/tests/ の中身（テスト専用）は実行しない
-- =====================================================================

-- =====================================================================
-- MACHIDA FOOD  Phase 1 初期スキーマ
--
-- 方針（CLAUDE.md より）
--   * すべてのテーブルで RLS を有効化する。RLS なしのテーブルは作らない
--   * 後から増える中身（店舗・メニュー・プラン・クーポン・ランク・称号・
--     枠・衣装・各種ポイント数）はコードに書かず、データとして持つ
--   * スタンプ・ポイント・クーポン利用など不正が起きやすい操作は、
--     画面から直接テーブルを書き換えさせず、security definer の関数（RPC）
--     だけで行う。二重付与は一意制約で DB 側が保証する
--   * 利用・付与の記録は audit_logs にすべて残す
--   * 日付の基準は Asia/Tokyo
-- =====================================================================

-- ---------- 型 ----------
create type public.store_status  as enum ('pending', 'approved', 'suspended');
create type public.brand         as enum ('food', 'night');
create type public.store_role    as enum ('store_owner', 'store_staff');
create type public.seat_kind     as enum ('counter', 'unit');
create type public.fee_policy    as enum ('none', 'included', 'separate');
create type public.coupon_kind   as enum ('normal', 'rain', 'welcome', 'exchange');
create type public.cosmetic_kind as enum ('title', 'frame', 'outfit');

-- ---------- 共通 ----------
create function public.tokyo_today() returns date
  language sql stable
  as $$ select (now() at time zone 'Asia/Tokyo')::date $$;

create function public.set_updated_at() returns trigger
  language plpgsql
  as $$ begin new.updated_at := now(); return new; end $$;

-- 運営が管理画面から変えられる設定値（ポイント数など）
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  note       text,
  updated_at timestamptz not null default now()
);

create function public.setting_int(p_key text, p_default int) returns int
  language sql stable security definer set search_path = public
  as $$ select coalesce((select (value #>> '{}')::int from app_settings where key = p_key), p_default) $$;

-- ---------- 運営管理者 ----------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- ---------- エリア・店舗 ----------
-- エリアは町田駅周辺から市全域・周辺地域へ増やせるようにテーブルで持つ
create table public.areas (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int  not null default 0
);

create table public.stores (
  id              uuid primary key default gen_random_uuid(),
  brand           public.brand not null default 'food',      -- 将来の MACHIDA NIGHT 用
  area_id         uuid references public.areas (id),
  name            text not null,
  genre           text not null,
  description     text,
  address         text,
  lat             double precision,
  lng             double precision,
  walk_minutes    smallint check (walk_minutes >= 0),
  price_min       int check (price_min >= 0),
  price_max       int check (price_max >= price_min),
  max_party       smallint not null default 4 check (max_party >= 1),
  payment_methods text[] not null default '{}',
  features        text[] not null default '{}',
  parking         text,
  holiday_note    text,
  stamp_goal      smallint not null default 10 check (stamp_goal between 3 and 50),
  stamp_reward    text,
  status          public.store_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index stores_brand_status_idx on public.stores (brand, status);
create index stores_area_idx         on public.stores (area_id);
create index stores_genre_idx        on public.stores (genre);
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- 店舗のスタッフ・オーナー
create table public.store_members (
  store_id   uuid not null references public.stores (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.store_role not null,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index store_members_user_idx on public.store_members (user_id);

create function public.is_store_member(p_store uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from store_members where store_id = p_store and user_id = auth.uid()) $$;

create function public.is_store_owner(p_store uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from store_members
                       where store_id = p_store and user_id = auth.uid() and role = 'store_owner') $$;

-- 一般公開されている店舗、または自分の店舗・運営なら見える
create function public.store_visible(p_store uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from stores where id = p_store and status = 'approved')
               or is_store_member(p_store) or is_admin() $$;

-- 掲載状態とブランドは運営だけが変えられる
create function public.protect_store_fields() returns trigger
  language plpgsql
  as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status or new.brand is distinct from old.brand then
    raise exception 'only_admin_can_change_status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger stores_protect before update on public.stores
  for each row execute function public.protect_store_fields();

-- 営業時間（ランチ・ディナーなど1日に複数行可）。行がない曜日は定休日
create table public.store_hours (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),   -- 0 = 日曜
  opens      time not null,
  closes     time not null,
  last_order time,
  check (closes > opens),
  check (last_order is null or (last_order > opens and last_order <= closes))
);
create index store_hours_store_idx on public.store_hours (store_id, weekday);

-- 臨時休業日
create table public.store_closed_days (
  store_id uuid not null references public.stores (id) on delete cascade,
  day      date not null,
  note     text,
  primary key (store_id, day)
);

-- メニュー（価格は税込み）
create table public.menu_items (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  name       text not null,
  price      int not null check (price >= 0),
  is_active  boolean not null default true,
  sort       int not null default 0
);
create index menu_items_store_idx on public.menu_items (store_id);

-- 今日の限定メニュー
create table public.daily_specials (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  name         text not null,
  price        int not null check (price >= 0),
  note         text,
  special_date date not null default public.tokyo_today()
);
create index daily_specials_store_date_idx on public.daily_specials (store_id, special_date);

-- 予算別プラン（税込み・お一人様。お通し・席料の扱いを必ず持つ）
create table public.budget_plans (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references public.stores (id) on delete cascade,
  price     int not null check (price >= 500),
  dishes    smallint not null check (dishes between 0 and 20),
  drinks    smallint not null check (drinks between 0 and 20),
  note      text,
  fee       public.fee_policy not null,
  is_active boolean not null default true,
  sort      int not null default 0
);
create index budget_plans_store_idx on public.budget_plans (store_id);

-- 席の種類ごとの空き（free は update_seats 関数だけが変える）
create table public.seat_types (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references public.stores (id) on delete cascade,
  name      text not null,
  kind      public.seat_kind not null,
  unit_size smallint not null default 1 check (unit_size >= 1),
  total     smallint not null check (total >= 0),
  free      smallint not null default 0,
  sort      int not null default 0,
  check (free between 0 and total)
);
create index seat_types_store_idx on public.seat_types (store_id);

create table public.store_seat_status (
  store_id     uuid primary key references public.stores (id) on delete cascade,
  wait_minutes smallint not null default 0 check (wait_minutes between 0 and 240),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id)
);

-- タイムセール
create table public.time_sales (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references public.stores (id) on delete cascade,
  title     text not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  check (ends_at > starts_at)
);
create index time_sales_store_idx on public.time_sales (store_id, ends_at);

-- ---------- ランク・着せ替え（データで増やせる） ----------
create table public.ranks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  animal      text not null,
  min_points  int,
  invite_only boolean not null default false,
  point_rate  numeric(3, 2) not null default 1.00 check (point_rate between 1 and 5),
  image_path  text,
  sort        int not null unique,
  check (invite_only or min_points is not null)
);

create table public.cosmetics (
  id              uuid primary key default gen_random_uuid(),
  kind            public.cosmetic_kind not null,
  name            text not null,
  image_path      text,
  color           text,
  unlock_rank_id  uuid references public.ranks (id),   -- このランク以上で自動的に使える
  grant_on_signup boolean not null default false,      -- 初回登録特典で配る
  is_active       boolean not null default true,
  sort            int not null default 0,
  unique (kind, name)
);

-- ---------- 会員 ----------
create table public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  member_seq         bigint generated always as identity unique,   -- 表示用の会員番号の元
  nickname           text not null check (char_length(nickname) between 1 and 12),
  birth_month        smallint check (birth_month between 1 and 12),
  adult_confirmed_at timestamptz,                                  -- 20歳以上の確認（自己申告）
  terms_agreed_at    timestamptz not null,
  equipped_title_id  uuid references public.cosmetics (id),
  equipped_frame_id  uuid references public.cosmetics (id),
  equipped_outfit_id uuid references public.cosmetics (id),
  created_at         timestamptz not null default now()
);

create table public.user_cosmetics (
  user_id     uuid not null references auth.users (id) on delete cascade,
  cosmetic_id uuid not null references public.cosmetics (id) on delete cascade,
  source      text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

-- ポイントは残高を持たず、増減の記録を積み上げる（後から検証できるように）
create table public.point_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  delta      int not null check (delta <> 0),
  reason     text not null,
  ref_type   text,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index point_ledger_user_idx on public.point_ledger (user_id, created_at desc);

create function public.user_earned(p_user uuid) returns int
  language sql stable security definer set search_path = public
  as $$ select coalesce(sum(delta) filter (where delta > 0), 0)::int from point_ledger where user_id = p_user $$;

-- ランクは累計獲得ポイントで決まり、交換で使っても下がらない。招待制のランクは別途
create function public.rank_of(p_user uuid) returns public.ranks
  language sql stable security definer set search_path = public
  as $$ select r.* from ranks r
        where not r.invite_only and r.min_points <= user_earned(p_user)
        order by r.min_points desc limit 1 $$;

create function public.owns_cosmetic(p_user uuid, p_cosmetic uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from user_cosmetics where user_id = p_user and cosmetic_id = p_cosmetic)
            or exists (select 1 from cosmetics c join ranks r on r.id = c.unlock_rank_id
                        where c.id = p_cosmetic and r.sort <= coalesce((rank_of(p_user)).sort, -1)) $$;

-- 持っていない称号・枠・衣装は装備できない
create function public.check_equipped() returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  slot record;
begin
  for slot in select * from (values ('title'::public.cosmetic_kind, new.equipped_title_id),
                                    ('frame'::public.cosmetic_kind, new.equipped_frame_id),
                                    ('outfit'::public.cosmetic_kind, new.equipped_outfit_id)) as t(kind, cid)
  loop
    if slot.cid is not null then
      if not exists (select 1 from public.cosmetics where id = slot.cid and kind = slot.kind) then
        raise exception 'cosmetic_wrong_slot' using errcode = '22023';
      end if;
      if not public.owns_cosmetic(new.user_id, slot.cid) then
        raise exception 'cosmetic_not_owned' using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end $$;
create trigger profiles_check_equipped before insert or update on public.profiles
  for each row execute function public.check_equipped();

-- ---------- クーポン ----------
create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  title       text not null,
  conditions  text,
  kind        public.coupon_kind not null default 'normal',
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  total_limit int check (total_limit > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index coupons_store_idx on public.coupons (store_id, is_active);

-- 特定の会員に配られたクーポン（初回登録特典・ポイント交換）
create table public.user_coupons (
  user_id    uuid not null references auth.users (id) on delete cascade,
  coupon_id  uuid not null references public.coupons (id) on delete cascade,
  source     text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, coupon_id)
);

-- 1人1回を DB の一意制約で保証する
create table public.coupon_redemptions (
  id           uuid primary key default gen_random_uuid(),
  coupon_id    uuid not null references public.coupons (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  store_id     uuid not null references public.stores (id) on delete cascade,
  confirmed_by uuid not null references auth.users (id),
  redeemed_at  timestamptz not null default now(),
  unique (coupon_id, user_id)
);
create index coupon_redemptions_store_idx on public.coupon_redemptions (store_id, redeemed_at desc);

-- ---------- 来店スタンプ ----------
-- 1店舗につき1日1回を一意制約で保証する
create table public.stamps (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  store_id   uuid not null references public.stores (id) on delete cascade,
  visit_date date not null,
  granted_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (user_id, store_id, visit_date)
);
create index stamps_store_idx on public.stamps (store_id, visit_date desc);
create index stamps_user_date_idx on public.stamps (user_id, visit_date);

create table public.stamp_rewards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  store_id     uuid not null references public.stores (id) on delete cascade,
  title        text not null,
  issued_at    timestamptz not null default now(),
  used_at      timestamptz,
  used_confirmed_by uuid references auth.users (id)
);
create index stamp_rewards_user_idx on public.stamp_rewards (user_id);

-- ---------- 会員証QRの使い捨て番号 ----------
-- 個人情報は持たない。30秒（設定値）で失効。画面からは読めない（ポリシーなし）
create table public.member_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index member_tokens_user_idx on public.member_tokens (user_id, expires_at);

-- ---------- お気に入り ----------
create table public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  store_id   uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

-- ---------- 操作の記録（不正監視用） ----------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null,
  store_id    uuid references public.stores (id) on delete set null,
  target_user uuid,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_logs_store_idx on public.audit_logs (store_id, created_at desc);

-- =====================================================================
-- 内部用の関数（画面からは呼べない）
-- =====================================================================
create function public.add_points(p_user uuid, p_delta int, p_reason text, p_ref_type text, p_ref_id uuid)
  returns int
  language plpgsql security definer set search_path = public
  as $$
begin
  if p_delta = 0 then return 0; end if;
  insert into point_ledger (user_id, delta, reason, ref_type, ref_id)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref_id);
  return p_delta;
end $$;

create function public.write_audit(p_action text, p_store uuid, p_target uuid, p_detail jsonb)
  returns void
  language sql security definer set search_path = public
  as $$ insert into audit_logs (actor, action, store_id, target_user, detail)
        values (auth.uid(), p_action, p_store, p_target, coalesce(p_detail, '{}')) $$;

-- 会員証の番号から会員を取り出す（有効期限内のみ）
create function public.token_user(p_token text) returns uuid
  language sql stable security definer set search_path = public
  as $$ select user_id from member_tokens where token = p_token and expires_at > now() $$;

-- =====================================================================
-- 画面から呼ぶ関数（RPC）
-- =====================================================================

-- 会員登録と初回登録特典（何度呼んでも特典は1回だけ）
create function public.register_profile(p_nickname text, p_birth_month smallint, p_adult boolean, p_agree boolean)
  returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid := auth.uid();
  v_new uuid;
  v_points int;
  v_coupons int;
  v_cosmetics int;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not coalesce(p_agree, false) then raise exception 'terms_not_agreed' using errcode = '22023'; end if;

  insert into profiles (user_id, nickname, birth_month, adult_confirmed_at, terms_agreed_at)
  values (v_user, btrim(p_nickname), p_birth_month, case when p_adult then now() end, now())
  on conflict (user_id) do nothing
  returning user_id into v_new;

  if v_new is null then
    return jsonb_build_object('status', 'already_registered');
  end if;

  v_points := add_points(v_user, setting_int('welcome_points', 500), '新規登録特典', 'signup', null);

  insert into user_coupons (user_id, coupon_id, source)
  select v_user, c.id, 'signup'
    from coupons c join stores s on s.id = c.store_id
   where c.kind = 'welcome' and c.is_active and s.status = 'approved'
  on conflict do nothing;
  get diagnostics v_coupons = row_count;

  insert into user_cosmetics (user_id, cosmetic_id, source)
  select v_user, id, 'signup' from cosmetics where grant_on_signup and is_active
  on conflict do nothing;
  get diagnostics v_cosmetics = row_count;

  perform write_audit('register', null, v_user,
    jsonb_build_object('points', v_points, 'coupons', v_coupons, 'cosmetics', v_cosmetics));

  return jsonb_build_object('status', 'registered', 'points', v_points,
                            'coupons', v_coupons, 'cosmetics', v_cosmetics);
end $$;

-- 会員証QRの番号を発行する（30秒で失効）
create function public.issue_member_token() returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_expires timestamptz := now() + make_interval(secs => setting_int('member_token_seconds', 30));
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where user_id = v_user) then
    raise exception 'not_registered' using errcode = '42501';
  end if;
  delete from member_tokens where user_id = v_user and expires_at < now() - interval '1 hour';
  insert into member_tokens (token, user_id, expires_at) values (v_token, v_user, v_expires);
  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end $$;

-- 店舗スタッフが会員証を読み取り、来店スタンプとポイントを付与する
create function public.redeem_visit(p_token text, p_store uuid) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid;
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
  if auth.uid() is null or not is_store_member(p_store) then
    raise exception 'not_store_member' using errcode = '42501';
  end if;
  if not exists (select 1 from stores where id = p_store and status = 'approved') then
    raise exception 'store_not_active' using errcode = '22023';
  end if;
  v_user := token_user(p_token);
  if v_user is null then raise exception 'invalid_or_expired_token' using errcode = '22023'; end if;

  insert into stamps (user_id, store_id, visit_date, granted_by)
  values (v_user, p_store, v_today, auth.uid())
  on conflict (user_id, store_id, visit_date) do nothing
  returning id into v_stamp;

  if v_stamp is null then
    perform write_audit('visit_duplicate', p_store, v_user, '{}');
    return jsonb_build_object('status', 'already_stamped_today');
  end if;

  select count(*) = 1 into v_first from stamps where user_id = v_user and store_id = p_store;
  select exists (select 1 from stamps where user_id = v_user and visit_date = v_today and store_id <> p_store) into v_hop;
  select adult_confirmed_at is not null into v_adult from profiles where user_id = v_user;
  v_rate := coalesce((rank_of(v_user)).point_rate, 1);

  v_points := v_points + add_points(v_user, round(setting_int('visit_points', 50) * v_rate)::int, '来店スタンプ', 'stamp', v_stamp);
  if v_first then
    v_points := v_points + add_points(v_user, setting_int('first_visit_bonus', 100), '初めてのお店', 'stamp', v_stamp);
  end if;
  -- はしごボーナスは飲酒に関わるため、20歳以上の確認をした会員だけ
  if v_hop and v_adult then
    v_points := v_points + add_points(v_user, setting_int('hop_bonus', 80), 'はしごボーナス', 'stamp', v_stamp);
  end if;

  select count(*) into v_count from stamps where user_id = v_user and store_id = p_store;
  select stamp_goal, stamp_reward into v_goal, v_reward from stores where id = p_store;
  if v_reward is not null and v_count % v_goal = 0 then
    insert into stamp_rewards (user_id, store_id, title) values (v_user, p_store, v_reward);
    v_reward_issued := true;
  end if;

  perform write_audit('visit', p_store, v_user,
    jsonb_build_object('points', v_points, 'first', v_first, 'hop', v_hop and v_adult, 'reward', v_reward_issued));

  return jsonb_build_object('status', 'stamped', 'points', v_points, 'first_visit', v_first,
                            'hop_bonus', v_hop and v_adult, 'stamp_count', v_count % v_goal,
                            'reward_issued', v_reward_issued);
end $$;

-- 店舗スタッフが会員証を読み取り、クーポンを使用済みにする
create function public.redeem_coupon(p_token text, p_coupon uuid) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  c coupons%rowtype;
  v_user uuid;
  v_used int;
  v_redemption uuid;
  v_points int;
begin
  select * into c from coupons where id = p_coupon for update;   -- 枚数制限の取り合いを防ぐ
  if not found then raise exception 'coupon_not_found' using errcode = '22023'; end if;
  if auth.uid() is null or not is_store_member(c.store_id) then
    raise exception 'not_store_member' using errcode = '42501';
  end if;
  v_user := token_user(p_token);
  if v_user is null then raise exception 'invalid_or_expired_token' using errcode = '22023'; end if;
  if not c.is_active or now() < c.starts_at or (c.ends_at is not null and now() >= c.ends_at) then
    raise exception 'coupon_not_available' using errcode = '22023';
  end if;
  if c.kind in ('welcome', 'exchange')
     and not exists (select 1 from user_coupons where user_id = v_user and coupon_id = c.id) then
    raise exception 'coupon_not_granted' using errcode = '42501';
  end if;
  if c.total_limit is not null then
    select count(*) into v_used from coupon_redemptions where coupon_id = c.id;
    if v_used >= c.total_limit then raise exception 'coupon_sold_out' using errcode = '22023'; end if;
  end if;

  begin
    insert into coupon_redemptions (coupon_id, user_id, store_id, confirmed_by)
    values (c.id, v_user, c.store_id, auth.uid())
    returning id into v_redemption;
  exception when unique_violation then
    perform write_audit('coupon_duplicate', c.store_id, v_user, jsonb_build_object('coupon', c.id));
    raise exception 'coupon_already_used' using errcode = '23505';
  end;

  v_points := add_points(v_user, setting_int('coupon_points', 10), 'クーポン利用', 'coupon', v_redemption);
  perform write_audit('coupon', c.store_id, v_user, jsonb_build_object('coupon', c.id, 'points', v_points));
  return jsonb_build_object('status', 'redeemed', 'points', v_points, 'title', c.title);
end $$;

-- 店舗スタッフが空席を更新する（p_free は {"席の種類のid": 空き数} の形）
create function public.update_seats(p_store uuid, p_free jsonb, p_wait smallint default 0) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  k text;
  v_rows int;
  v_any_free boolean;
begin
  if auth.uid() is null or not is_store_member(p_store) then
    raise exception 'not_store_member' using errcode = '42501';
  end if;
  for k in select jsonb_object_keys(p_free) loop
    update seat_types set free = (p_free ->> k)::smallint
     where id = k::uuid and store_id = p_store;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'seat_type_mismatch' using errcode = '22023'; end if;
  end loop;
  select exists (select 1 from seat_types where store_id = p_store and free > 0) into v_any_free;
  insert into store_seat_status (store_id, wait_minutes, updated_at, updated_by)
  values (p_store, case when v_any_free then 0 else coalesce(p_wait, 0) end, now(), auth.uid())
  on conflict (store_id) do update
    set wait_minutes = excluded.wait_minutes, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  perform write_audit('seats', p_store, null, jsonb_build_object('free', p_free, 'wait', p_wait));
  return jsonb_build_object('status', 'updated', 'any_free', v_any_free);
end $$;

-- =====================================================================
-- 画面向けのビュー（呼び出した人の権限で RLS がかかる）
-- =====================================================================
create view public.my_points with (security_invoker = true) as
  select user_id,
         coalesce(sum(delta), 0)::int                          as balance,
         coalesce(sum(delta) filter (where delta > 0), 0)::int as earned
    from public.point_ledger
   group by user_id;

create view public.my_stamp_cards with (security_invoker = true) as
  select s.user_id, s.store_id, st.name as store_name, st.stamp_goal, st.stamp_reward,
         count(*)::int                    as total_stamps,
         (count(*) % st.stamp_goal)::int  as current_stamps
    from public.stamps s join public.stores st on st.id = s.store_id
   group by s.user_id, s.store_id, st.name, st.stamp_goal, st.stamp_reward;

-- =====================================================================
-- RLS（すべてのテーブルで有効化）
-- =====================================================================
alter table public.app_settings       enable row level security;
alter table public.admins             enable row level security;
alter table public.areas              enable row level security;
alter table public.stores             enable row level security;
alter table public.store_members      enable row level security;
alter table public.store_hours        enable row level security;
alter table public.store_closed_days  enable row level security;
alter table public.menu_items         enable row level security;
alter table public.daily_specials     enable row level security;
alter table public.budget_plans       enable row level security;
alter table public.seat_types         enable row level security;
alter table public.store_seat_status  enable row level security;
alter table public.time_sales         enable row level security;
alter table public.ranks              enable row level security;
alter table public.cosmetics          enable row level security;
alter table public.profiles           enable row level security;
alter table public.user_cosmetics     enable row level security;
alter table public.point_ledger       enable row level security;
alter table public.coupons            enable row level security;
alter table public.user_coupons       enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.stamps             enable row level security;
alter table public.stamp_rewards      enable row level security;
alter table public.member_tokens      enable row level security;   -- ポリシーなし＝画面からは一切読めない
alter table public.favorites          enable row level security;
alter table public.audit_logs         enable row level security;

-- 設定・マスタ（誰でも読める／運営だけ書ける）
create policy app_settings_read  on public.app_settings for select using (true);
create policy app_settings_admin on public.app_settings for all using (is_admin()) with check (is_admin());
create policy areas_read  on public.areas for select using (true);
create policy areas_admin on public.areas for all using (is_admin()) with check (is_admin());
create policy ranks_read  on public.ranks for select using (true);
create policy ranks_admin on public.ranks for all using (is_admin()) with check (is_admin());
create policy cosmetics_read  on public.cosmetics for select using (is_active or is_admin());
create policy cosmetics_admin on public.cosmetics for all using (is_admin()) with check (is_admin());

-- 運営管理者：自分が運営かどうかだけ分かる
create policy admins_self on public.admins for select using (user_id = auth.uid() or is_admin());

-- 店舗：掲載中は誰でも、未掲載は自店舗と運営だけ。オーナーは自店舗を編集できる（掲載状態はトリガーで保護）
create policy stores_read   on public.stores for select using (status = 'approved' or is_store_member(id) or is_admin());
create policy stores_update on public.stores for update using (is_store_owner(id) or is_admin()) with check (is_store_owner(id) or is_admin());
create policy stores_insert on public.stores for insert with check (is_admin());
create policy stores_delete on public.stores for delete using (is_admin());

create policy store_members_read  on public.store_members for select
  using (user_id = auth.uid() or is_store_owner(store_id) or is_admin());
create policy store_members_admin on public.store_members for all using (is_admin()) with check (is_admin());

-- 店舗の中身：見える店舗のものは読める。書き込みは役割ごと
-- オーナー（と運営）：営業時間・休業日・メニュー・予算プラン・席の種類・クーポン
-- スタッフも可：限定メニュー・タイムセール（空席は update_seats 関数）
create policy store_hours_read  on public.store_hours for select using (store_visible(store_id));
create policy store_hours_write on public.store_hours for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

create policy closed_days_read  on public.store_closed_days for select using (store_visible(store_id));
create policy closed_days_write on public.store_closed_days for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

create policy menu_read  on public.menu_items for select using (store_visible(store_id) and (is_active or is_store_member(store_id) or is_admin()));
create policy menu_write on public.menu_items for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

create policy plans_read  on public.budget_plans for select using (store_visible(store_id) and (is_active or is_store_member(store_id) or is_admin()));
create policy plans_write on public.budget_plans for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

create policy seat_types_read  on public.seat_types for select using (store_visible(store_id));
create policy seat_types_write on public.seat_types for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

create policy seat_status_read on public.store_seat_status for select using (store_visible(store_id));

create policy specials_read  on public.daily_specials for select using (store_visible(store_id));
create policy specials_write on public.daily_specials for all
  using (is_store_member(store_id) or is_admin()) with check (is_store_member(store_id) or is_admin());

create policy time_sales_read  on public.time_sales for select using (store_visible(store_id));
create policy time_sales_write on public.time_sales for all
  using (is_store_member(store_id) or is_admin()) with check (is_store_member(store_id) or is_admin());

-- クーポン：初回登録・交換用は、配られた本人と店舗・運営だけが見える
create policy coupons_read on public.coupons for select using (
  store_visible(store_id) and (
    (kind in ('normal', 'rain') and is_active)
    or exists (select 1 from user_coupons uc where uc.coupon_id = coupons.id and uc.user_id = auth.uid())
    or is_store_member(store_id) or is_admin()));
create policy coupons_write on public.coupons for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

-- 会員のデータ：本人と運営だけ（店舗は自店舗での利用記録のみ）
create policy profiles_read   on public.profiles for select using (user_id = auth.uid() or is_admin());
create policy profiles_update on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_cosmetics_read on public.user_cosmetics for select using (user_id = auth.uid() or is_admin());
create policy points_read         on public.point_ledger   for select using (user_id = auth.uid() or is_admin());
create policy user_coupons_read   on public.user_coupons   for select using (user_id = auth.uid() or is_admin());

create policy redemptions_read on public.coupon_redemptions for select
  using (user_id = auth.uid() or is_store_member(store_id) or is_admin());
create policy stamps_read on public.stamps for select
  using (user_id = auth.uid() or is_store_member(store_id) or is_admin());
create policy stamp_rewards_read on public.stamp_rewards for select
  using (user_id = auth.uid() or is_store_member(store_id) or is_admin());

create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_read on public.audit_logs for select
  using (is_admin() or (store_id is not null and is_store_member(store_id)));

-- =====================================================================
-- 権限
-- =====================================================================
-- 会員が自分で変えられるのはニックネーム・誕生月・装備だけ
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nickname, birth_month, equipped_title_id, equipped_frame_id, equipped_outfit_id)
  on public.profiles to authenticated;

-- 付与・記録系のテーブルは画面から直接書き込ませない（関数経由のみ）
revoke insert, update, delete on public.point_ledger, public.stamps, public.stamp_rewards,
  public.coupon_redemptions, public.user_coupons, public.user_cosmetics, public.member_tokens,
  public.audit_logs, public.store_seat_status
  from anon, authenticated;

-- 内部用の関数は画面から呼べないようにする
revoke execute on function public.add_points(uuid, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.write_audit(text, uuid, uuid, jsonb)      from public, anon, authenticated;
revoke execute on function public.token_user(text)                          from public, anon, authenticated;
revoke execute on function public.user_earned(uuid)                         from public, anon, authenticated;
revoke execute on function public.rank_of(uuid)                             from public, anon, authenticated;
revoke execute on function public.owns_cosmetic(uuid, uuid)                 from public, anon, authenticated;

-- 画面から呼ぶ関数はログインした人だけ
revoke execute on function public.register_profile(text, smallint, boolean, boolean) from public, anon;
revoke execute on function public.issue_member_token()                               from public, anon;
revoke execute on function public.redeem_visit(text, uuid)                           from public, anon;
revoke execute on function public.redeem_coupon(text, uuid)                          from public, anon;
revoke execute on function public.update_seats(uuid, jsonb, smallint)                from public, anon;
grant execute on function public.register_profile(text, smallint, boolean, boolean) to authenticated;
grant execute on function public.issue_member_token()                               to authenticated;
grant execute on function public.redeem_visit(text, uuid)                           to authenticated;
grant execute on function public.redeem_coupon(text, uuid)                          to authenticated;
grant execute on function public.update_seats(uuid, jsonb, smallint)                to authenticated;

-- =====================================================================
-- 会員証QRの発行関数の作り直し と セキュリティ診断の指摘への対応
--
-- 1. issue_member_token() から「期限切れの番号の片付け（削除）」を外す
--    * 理由：Supabaseの接続では削除を含む命令に本人の確認が必須で、
--      開発用プロジェクトへの反映が止まるため
--    * 安全性は変わらない：期限切れの番号は token_user() が受け付けない
--    * 片付けは後で定期実行の仕組み（pg_cron 等）として別に追加する
-- 2. search_path が固定されていない関数3件に search_path を設定
-- 3. トリガー専用の関数を画面（API）から呼べないようにする
--    （トリガーの動作には EXECUTE 権限は不要なので、動きは変わらない）
-- =====================================================================

create or replace function public.issue_member_token() returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_expires timestamptz := now() + make_interval(secs => setting_int('member_token_seconds', 30));
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where user_id = v_user) then
    raise exception 'not_registered' using errcode = '42501';
  end if;
  insert into member_tokens (token, user_id, expires_at) values (v_token, v_user, v_expires);
  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end $$;

revoke execute on function public.issue_member_token() from public, anon;
grant execute on function public.issue_member_token() to authenticated;

alter function public.tokyo_today()          set search_path = public;
alter function public.set_updated_at()       set search_path = public;
alter function public.protect_store_fields() set search_path = public;

revoke execute on function public.set_updated_at()       from public, anon, authenticated;
revoke execute on function public.protect_store_fields() from public, anon, authenticated;
revoke execute on function public.check_equipped()       from public, anon, authenticated;

-- =====================================================================
-- アプリ内で退会できるようにする（App Store・Google Play の審査で必須）
--
-- delete_my_account()
--   * ログイン中の会員が自分のアカウントを削除する
--   * auth.users を削除すると、プロフィール・ポイント・スタンプ・クーポン・
--     会員証の番号・お気に入りなどは外部キーの on delete cascade で一緒に消える
--   * 操作の記録（audit_logs）は不正監視のため残す（利用者IDだけで、氏名・連絡先は持たない）
--   * 店舗のオーナー・スタッフ、運営のアカウントは、記録の整合のためここでは削除しない
--     （担当を外してから退会する。運営に連絡してもらう）
-- =====================================================================

create function public.delete_my_account() returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from store_members where user_id = v_user) or exists (select 1 from admins where user_id = v_user) then
    raise exception 'staff_account_cannot_self_delete' using errcode = '42501';
  end if;

  perform write_audit('account_deleted', null, v_user, '{}');
  delete from auth.users where id = v_user;
  return jsonb_build_object('status', 'deleted');
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- =====================================================================
-- MACHIDA FOOD  初期データ（デモ用の架空5店舗・ランク・称号など）
-- 実在の店舗ではありません。本番では管理画面から実際の加盟店を登録します。
-- =====================================================================

-- 設定値（管理画面から変更できる）
insert into public.app_settings (key, value, note) values
  ('welcome_points',       '500', '初回登録特典のポイント'),
  ('visit_points',         '50',  '来店スタンプ1回のポイント（ランクの倍率をかける）'),
  ('first_visit_bonus',    '100', '初めてのお店に来店したときの追加ポイント'),
  ('hop_bonus',            '80',  '同じ日の2軒目（はしご）の追加ポイント。20歳以上の確認をした会員のみ'),
  ('coupon_points',        '10',  'クーポン利用のポイント'),
  ('member_token_seconds', '30',  '会員証QRの有効秒数'),
  ('seat_stale_minutes',   '60',  'この時間更新がない空席情報は表示しない');

-- エリア
insert into public.areas (id, name, sort) values
  ('a0000000-0000-0000-0000-000000000001', '町田駅北口', 1),
  ('a0000000-0000-0000-0000-000000000002', '原町田',     2),
  ('a0000000-0000-0000-0000-000000000003', '中町',       3),
  ('a0000000-0000-0000-0000-000000000004', '森野',       4);

-- 店舗
insert into public.stores (id, area_id, name, genre, description, address, walk_minutes, price_min, price_max,
                           max_party, payment_methods, features, parking, holiday_note, stamp_reward, status) values
  ('11111111-1111-1111-1111-000000000001', 'a0000000-0000-0000-0000-000000000002', '炭火焼肉 まちだ苑', '焼肉',
   '厳選した黒毛和牛を備長炭で。家族連れから仕事帰りの一杯まで。', '原町田（デモ用の架空店舗）', 4, 4000, 5000, 12,
   '{クレジットカード,PayPay,交通系IC,現金}', '{子連れOK,ベビーカー可,禁煙,アレルギー相談可,個室あり,宴会OK}',
   '提携駐車場あり（2時間無料）', '火曜日', '上タン塩1皿サービス', 'approved'),
  ('11111111-1111-1111-1111-000000000002', 'a0000000-0000-0000-0000-000000000001', '町田らーめん 翠', 'ラーメン',
   '鶏と煮干しの淡麗スープ。昼も夜も、さっと一杯。', '町田駅北口（デモ用の架空店舗）', 2, 900, 1300, 4,
   '{現金,交通系IC,PayPay}', '{一人歓迎,禁煙}', 'なし（近くにコインパーキングあり）', 'なし', 'ラーメン1杯無料', 'approved'),
  ('11111111-1111-1111-1111-000000000003', 'a0000000-0000-0000-0000-000000000003', '居酒屋 芹ヶ谷', '居酒屋',
   '地元の野菜と旬の魚、全国の地酒。最大30名まで貸切できます。', '中町（デモ用の架空店舗）', 6, 3000, 4000, 30,
   '{クレジットカード,現金}', '{一人歓迎,喫煙可（専用室）,アレルギー相談可,貸切OK}', 'なし', '月曜日', '地酒一合サービス', 'approved'),
  ('11111111-1111-1111-1111-000000000004', 'a0000000-0000-0000-0000-000000000004', 'CAFE ivory leaf', 'カフェ',
   '自家焙煎のコーヒーと、季節の焼き菓子。窓際の席が人気です。', '森野（デモ用の架空店舗）', 5, 800, 1500, 6,
   '{クレジットカード,PayPay,交通系IC,現金}', '{子連れOK,ベビーカー可,車椅子対応,禁煙,一人歓迎,アレルギー相談可}',
   '駐輪場あり', '水曜日', '好きなドリンク1杯無料', 'approved'),
  ('11111111-1111-1111-1111-000000000005', 'a0000000-0000-0000-0000-000000000004', 'ビストロ 森野キッチン', '洋食・バル',
   '町田の小さなビストロ。肉料理とグラスワインを気軽に。', '森野（デモ用の架空店舗）', 7, 3000, 5000, 16,
   '{クレジットカード,PayPay,現金}', '{禁煙,車椅子対応,アレルギー相談可,記念日向け,貸切OK}',
   '提携駐車場あり（1時間無料）', '日曜日', 'グラスワイン2杯サービス', 'approved');

-- 営業時間（行がない曜日は定休日）
insert into public.store_hours (store_id, weekday, opens, closes, last_order)
select '11111111-1111-1111-1111-000000000001'::uuid, d::smallint, '17:00'::time, '24:00'::time, '23:00'::time
  from generate_series(0, 6) d where d <> 2
union all
select '11111111-1111-1111-1111-000000000002', d, '11:00', '15:00', '14:45' from generate_series(0, 6) d
union all
select '11111111-1111-1111-1111-000000000002', d, '18:00', '22:00', '21:45' from generate_series(0, 6) d
union all
select '11111111-1111-1111-1111-000000000003', d, '16:00', '24:00', '23:30' from generate_series(0, 6) d where d <> 1
union all
select '11111111-1111-1111-1111-000000000004', d, '09:00', '19:00', '18:30' from generate_series(0, 6) d where d <> 3
union all
select '11111111-1111-1111-1111-000000000005', d, '11:30', '14:30', '14:00' from generate_series(0, 6) d where d <> 0
union all
select '11111111-1111-1111-1111-000000000005', d, '17:30', '23:00', '22:00' from generate_series(0, 6) d where d <> 0;

-- 席の種類
insert into public.seat_types (id, store_id, name, kind, unit_size, total, free, sort) values
  ('5ea70000-0000-0000-0000-000000000101', '11111111-1111-1111-1111-000000000001', 'カウンター',         'counter', 1, 8, 2, 1),
  ('5ea70000-0000-0000-0000-000000000102', '11111111-1111-1111-1111-000000000001', 'テーブル（4名）',     'unit',    4, 6, 3, 2),
  ('5ea70000-0000-0000-0000-000000000103', '11111111-1111-1111-1111-000000000001', '個室（〜8名）',       'unit',    8, 2, 0, 3),
  ('5ea70000-0000-0000-0000-000000000201', '11111111-1111-1111-1111-000000000002', 'カウンター',         'counter', 1, 10, 3, 1),
  ('5ea70000-0000-0000-0000-000000000202', '11111111-1111-1111-1111-000000000002', 'テーブル（2名）',     'unit',    2, 2, 0, 2),
  ('5ea70000-0000-0000-0000-000000000301', '11111111-1111-1111-1111-000000000003', 'カウンター',         'counter', 1, 6, 1, 1),
  ('5ea70000-0000-0000-0000-000000000302', '11111111-1111-1111-1111-000000000003', '座敷テーブル（6名）', 'unit',    6, 5, 1, 2),
  ('5ea70000-0000-0000-0000-000000000303', '11111111-1111-1111-1111-000000000003', '宴会座敷（〜30名）',  'unit',   30, 1, 0, 3),
  ('5ea70000-0000-0000-0000-000000000401', '11111111-1111-1111-1111-000000000004', 'カウンター',         'counter', 1, 6, 4, 1),
  ('5ea70000-0000-0000-0000-000000000402', '11111111-1111-1111-1111-000000000004', 'テーブル（2名）',     'unit',    2, 5, 2, 2),
  ('5ea70000-0000-0000-0000-000000000403', '11111111-1111-1111-1111-000000000004', 'ソファ席（4名）',     'unit',    4, 2, 1, 3),
  ('5ea70000-0000-0000-0000-000000000501', '11111111-1111-1111-1111-000000000005', 'カウンター',         'counter', 1, 6, 0, 1),
  ('5ea70000-0000-0000-0000-000000000502', '11111111-1111-1111-1111-000000000005', 'テーブル（4名）',     'unit',    4, 5, 0, 2);

insert into public.store_seat_status (store_id, wait_minutes)
select id, case when id = '11111111-1111-1111-1111-000000000005' then 20 else 0 end from public.stores;

-- メニュー（税込み）
insert into public.menu_items (store_id, name, price, sort) values
  ('11111111-1111-1111-1111-000000000001', '上タン塩', 1680, 1),
  ('11111111-1111-1111-1111-000000000001', '特選カルビ', 1480, 2),
  ('11111111-1111-1111-1111-000000000001', 'ハラミ', 1280, 3),
  ('11111111-1111-1111-1111-000000000001', '冷麺', 980, 4),
  ('11111111-1111-1111-1111-000000000002', '翠そば（醤油）', 950, 1),
  ('11111111-1111-1111-1111-000000000002', '翠そば（塩）', 950, 2),
  ('11111111-1111-1111-1111-000000000002', '味玉', 150, 3),
  ('11111111-1111-1111-1111-000000000002', '炙りチャーシュー丼', 400, 4),
  ('11111111-1111-1111-1111-000000000003', '刺身五点盛り', 1580, 1),
  ('11111111-1111-1111-1111-000000000003', 'だし巻き玉子', 580, 2),
  ('11111111-1111-1111-1111-000000000003', '地鶏の炭火焼き', 880, 3),
  ('11111111-1111-1111-1111-000000000003', '日本酒（一合）', 650, 4),
  ('11111111-1111-1111-1111-000000000004', 'ハンドドリップ', 550, 1),
  ('11111111-1111-1111-1111-000000000004', 'カフェラテ', 600, 2),
  ('11111111-1111-1111-1111-000000000004', '季節のタルト', 580, 3),
  ('11111111-1111-1111-1111-000000000004', 'モーニングセット', 780, 4),
  ('11111111-1111-1111-1111-000000000005', 'パテ・ド・カンパーニュ', 980, 1),
  ('11111111-1111-1111-1111-000000000005', '牛ほほ肉の赤ワイン煮', 2280, 2),
  ('11111111-1111-1111-1111-000000000005', '本日の鮮魚のポワレ', 1980, 3),
  ('11111111-1111-1111-1111-000000000005', 'グラスワイン', 700, 4);

-- 予算別プラン
insert into public.budget_plans (store_id, price, dishes, drinks, note, fee, sort) values
  ('11111111-1111-1111-1111-000000000001', 3000, 3, 1, '上タン塩・ハラミ・ライス', 'none', 1),
  ('11111111-1111-1111-1111-000000000001', 5000, 5, 2, '上タン塩・特選カルビ・ハラミ・サラダ・冷麺', 'none', 2),
  ('11111111-1111-1111-1111-000000000002', 1000, 1, 0, '翠そば＋味玉', 'none', 1),
  ('11111111-1111-1111-1111-000000000002', 1500, 2, 1, '翠そば・炙りチャーシュー丼・ソフトドリンク', 'none', 2),
  ('11111111-1111-1111-1111-000000000003', 3000, 3, 2, '刺身・だし巻き玉子・季節の一品', 'included', 1),
  ('11111111-1111-1111-1111-000000000003', 4000, 4, 3, '刺身五点盛り・地鶏の炭火焼き・だし巻き・〆の一品', 'included', 2),
  ('11111111-1111-1111-1111-000000000004', 1000, 1, 1, '季節のタルト＋好きなドリンク', 'none', 1),
  ('11111111-1111-1111-1111-000000000005', 4000, 3, 2, '前菜・本日のメイン・デザート', 'none', 1),
  ('11111111-1111-1111-1111-000000000005', 5000, 4, 3, 'パテ・鮮魚のポワレ・牛ほほ肉の赤ワイン煮・デザート', 'none', 2);

-- クーポン（通常・雨の日・初回登録特典）
insert into public.coupons (id, store_id, title, conditions, kind) values
  ('c0000000-0000-0000-0000-000000000101', '11111111-1111-1111-1111-000000000001', 'ドリンク1杯サービス', '4名様以上でご来店時', 'normal'),
  ('c0000000-0000-0000-0000-000000000102', '11111111-1111-1111-1111-000000000001', '雨の日はライス大盛り無料', '雨の日のご来店', 'rain'),
  ('c0000000-0000-0000-0000-000000000103', '11111111-1111-1111-1111-000000000001', '初回来店：キムチ盛り合わせサービス', '初回来店のみ・登録特典', 'welcome'),
  ('c0000000-0000-0000-0000-000000000201', '11111111-1111-1111-1111-000000000002', '味玉トッピング無料', 'ラーメン1杯につき1回', 'normal'),
  ('c0000000-0000-0000-0000-000000000202', '11111111-1111-1111-1111-000000000002', '雨の日は麺大盛り無料', '雨の日のご来店', 'rain'),
  ('c0000000-0000-0000-0000-000000000203', '11111111-1111-1111-1111-000000000002', '初回来店：替え玉1回無料', '初回来店のみ・登録特典', 'welcome'),
  ('c0000000-0000-0000-0000-000000000301', '11111111-1111-1111-1111-000000000003', 'お会計から10%割引', '18時までのご入店', 'normal'),
  ('c0000000-0000-0000-0000-000000000303', '11111111-1111-1111-1111-000000000003', '初回来店：お通し無料', '初回来店のみ・登録特典', 'welcome'),
  ('c0000000-0000-0000-0000-000000000401', '11111111-1111-1111-1111-000000000004', '焼き菓子1つプレゼント', 'ドリンク注文時', 'normal'),
  ('c0000000-0000-0000-0000-000000000402', '11111111-1111-1111-1111-000000000004', '雨の日はドリンク50円引き', '雨の日のご来店', 'rain'),
  ('c0000000-0000-0000-0000-000000000403', '11111111-1111-1111-1111-000000000004', '初回来店：ドリンクのサイズアップ無料', '初回来店のみ・登録特典', 'welcome'),
  ('c0000000-0000-0000-0000-000000000501', '11111111-1111-1111-1111-000000000005', '記念日デザートプレート', '要予約・記念日のご来店', 'normal'),
  ('c0000000-0000-0000-0000-000000000503', '11111111-1111-1111-1111-000000000005', '初回来店：乾杯ドリンク1杯（ソフトドリンク可）', '初回来店のみ・登録特典', 'welcome');

-- ランク（キャラクター画像は Storage にアップロードしてパスを入れる）
insert into public.ranks (id, name, animal, min_points, invite_only, point_rate, sort) values
  ('7a000000-0000-0000-0000-000000000001', 'ブロンズ', 'リス',     0,    false, 1.00, 0),
  ('7a000000-0000-0000-0000-000000000002', 'シルバー', 'ウサギ',   1000, false, 1.20, 1),
  ('7a000000-0000-0000-0000-000000000003', 'ゴールド', 'ライオン', 3000, false, 1.50, 2),
  ('7a000000-0000-0000-0000-000000000004', 'プラチナ', 'ゴリラ',   6000, false, 2.00, 3),
  ('7a000000-0000-0000-0000-000000000005', 'ブラック', 'ドラゴン', null, true,  2.00, 4);

-- 称号・枠・衣装（ランクで解放されるものと、初回登録で配るもの）
insert into public.cosmetics (kind, name, color, unlock_rank_id, grant_on_signup, sort) values
  ('title',  '町田グルメ見習い', null,      '7a000000-0000-0000-0000-000000000001', false, 1),
  ('title',  '町田グルメ通',     null,      '7a000000-0000-0000-0000-000000000002', false, 2),
  ('title',  '町田の美食家',     null,      '7a000000-0000-0000-0000-000000000003', false, 3),
  ('title',  '町田グルメ大使',   null,      '7a000000-0000-0000-0000-000000000004', false, 4),
  ('title',  '伝説の町田グルメ', null,      '7a000000-0000-0000-0000-000000000005', false, 5),
  ('frame',  'ブロンズの枠',     '#B07A4A', '7a000000-0000-0000-0000-000000000001', false, 1),
  ('frame',  'シルバーの枠',     '#B8BEC6', '7a000000-0000-0000-0000-000000000002', false, 2),
  ('frame',  'ゴールドの枠',     '#D2AE58', '7a000000-0000-0000-0000-000000000003', false, 3),
  ('frame',  'プラチナの枠',     '#B9A6E0', '7a000000-0000-0000-0000-000000000004', false, 4),
  ('frame',  '黒龍の枠',         '#111111', '7a000000-0000-0000-0000-000000000005', false, 5),
  ('outfit', 'いつもの服',       null,      '7a000000-0000-0000-0000-000000000001', false, 1),
  ('outfit', 'コック衣装',       null,      null,                                   true,  2);

-- キャラクター画像（public/characters/ に置いたもの。{rank} は表示中のランクの sort に置き換わる）
update public.ranks set image_path = '/characters/rank-' || sort || '.webp';
update public.cosmetics set image_path = '/characters/chef-{rank}.webp' where kind = 'outfit' and name = 'コック衣装';
