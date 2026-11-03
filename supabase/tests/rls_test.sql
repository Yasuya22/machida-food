-- =====================================================================
-- 権限ごとのアクセステスト（CLAUDE.md：他店・他人のデータが見えないことを必ず確認する）
-- scripts/test-db.sh から実行する。1つでも失敗すると止まる。
--
-- 登場人物
--   admin  ...a1 運営管理者
--   owner1 ...b1 まちだ苑のオーナー   staff1 ...b2 まちだ苑のスタッフ
--   owner2 ...c1 翠のオーナー
--   userA  ...d1 一般会員（20歳以上の確認なし）  userB ...d2 一般会員（あとで登録）
-- 店舗 ...001 まちだ苑 / ...002 翠 / ...099 審査中の店舗
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------- 未ログイン ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
do $$ begin
  if (select count(*) from public.stores) <> 5 then raise exception 'FAIL T01: 未ログインで見える店舗が5件でない'; end if;
  if exists (select 1 from public.stores where status <> 'approved') then raise exception 'FAIL T01: 審査中の店舗が見える'; end if;
  if exists (select 1 from public.menu_items where store_id = '11111111-1111-1111-1111-000000000099') then raise exception 'FAIL T01: 審査中の店舗のメニューが見える'; end if;
  if exists (select 1 from public.coupons where kind = 'welcome') then raise exception 'FAIL T01: 初回登録クーポンが未ログインで見える'; end if;
  raise notice 'PASS T01 未ログインでは掲載中の店舗・通常クーポンだけが見える';
end $$;
do $$ begin
  begin perform public.redeem_visit('x', '11111111-1111-1111-1111-000000000001'); raise exception 'FAIL T02: 未ログインで来店付与を呼べた';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.member_tokens) or exists (select 1 from public.profiles) then raise exception 'FAIL T02: 会員情報が見える'; end if;
  raise notice 'PASS T02 未ログインでは付与の関数を呼べず、会員情報も見えない';
end $$;
reset role;

-- ---------- 会員A：登録と初回登録特典 ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false) \g /dev/null
do $$
declare r jsonb;
begin
  r := public.register_profile('テストA', 4::smallint, false, true);
  if r->>'status' <> 'registered' or (r->>'points')::int <> 500 or (r->>'coupons')::int <> 5 or (r->>'cosmetics')::int <> 1 then
    raise exception 'FAIL T03: 初回登録特典が想定と違う %', r;
  end if;
  r := public.register_profile('テストA', 4::smallint, false, true);
  if r->>'status' <> 'already_registered' then raise exception 'FAIL T03: 2回目の登録で特典が再付与された'; end if;
  if (select balance from public.my_points) <> 500 then raise exception 'FAIL T03: ポイントが500でない'; end if;
  if (select count(*) from public.coupons where kind = 'welcome') <> 5 then raise exception 'FAIL T03: 自分の初回クーポンが見えない'; end if;
  raise notice 'PASS T03 初回登録特典は1回だけ付与される（500pt・初回クーポン5枚・コック衣装）';
end $$;
do $$ begin
  begin perform public.register_profile('テストA2', null, false, false); exception when others then null; end;
  begin insert into public.point_ledger (user_id, delta, reason) values ('00000000-0000-0000-0000-0000000000d1', 99999, '不正'); raise exception 'FAIL T04: ポイントを直接書き込めた';
  exception when insufficient_privilege then null; end;
  begin update public.profiles set terms_agreed_at = now(); raise exception 'FAIL T04: 規約同意日時を書き換えられた';
  exception when insufficient_privilege then null; end;
  begin perform public.add_points('00000000-0000-0000-0000-0000000000d1', 99999, '不正', null, null); raise exception 'FAIL T04: 内部用の関数を呼べた';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T04 会員はポイントや記録を直接書き換えられず、内部用の関数も呼べない';
end $$;
do $$ begin
  -- 持っていない枠（ゴールド）は装備できない
  begin update public.profiles set equipped_frame_id = (select id from public.cosmetics where name = 'ゴールドの枠');
        raise exception 'FAIL T05: 持っていない枠を装備できた';
  exception when insufficient_privilege then
    if sqlerrm <> 'cosmetic_not_owned' then raise; end if;
  end;
  update public.profiles set equipped_outfit_id = (select id from public.cosmetics where name = 'コック衣装'),
                             equipped_title_id  = (select id from public.cosmetics where name = '町田グルメ見習い');
  raise notice 'PASS T05 持っている称号・衣装だけを装備できる';
end $$;
do $$ begin
  perform set_config('test.token_a', public.issue_member_token()->>'token', false);
  if exists (select 1 from public.member_tokens) then raise exception 'FAIL T06: 会員証の番号の表が画面から読める'; end if;
  raise notice 'PASS T06 会員証QRの番号を発行でき、番号の表そのものは読めない';
end $$;
reset role;

-- ---------- 会員B：他人のデータは見えない ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false) \g /dev/null
do $$ begin
  if exists (select 1 from public.profiles) then raise exception 'FAIL T07: 他人のプロフィールが見える'; end if;
  if exists (select 1 from public.point_ledger) then raise exception 'FAIL T07: 他人のポイントが見える'; end if;
  if exists (select 1 from public.user_coupons) or exists (select 1 from public.coupons where kind = 'welcome') then
    raise exception 'FAIL T07: 他人の初回クーポンが見える'; end if;
  begin perform public.issue_member_token(); raise exception 'FAIL T07: 未登録なのに会員証を発行できた';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T07 他の会員のプロフィール・ポイント・クーポンは見えない';
end $$;
reset role;

-- ---------- まちだ苑のスタッフ：来店スタンプ ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
do $$
declare r jsonb;
begin
  r := public.redeem_visit(current_setting('test.token_a'), '11111111-1111-1111-1111-000000000001');
  if r->>'status' <> 'stamped' or (r->>'points')::int <> 150 or not (r->>'first_visit')::boolean then
    raise exception 'FAIL T08: 来店付与の結果が想定と違う %', r; end if;
  r := public.redeem_visit(current_setting('test.token_a'), '11111111-1111-1111-1111-000000000001');
  if r->>'status' <> 'already_stamped_today' then raise exception 'FAIL T08: 同じ日に2回スタンプが付いた %', r; end if;
  raise notice 'PASS T08 来店スタンプは1店舗1日1回（初来店 50pt＋100pt）';
end $$;
do $$ begin
  begin perform public.redeem_visit(current_setting('test.token_a'), '11111111-1111-1111-1111-000000000002');
        raise exception 'FAIL T09: 他店の来店付与ができた';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.stamps where store_id <> '11111111-1111-1111-1111-000000000001') then
    raise exception 'FAIL T09: 他店のスタンプ記録が見える'; end if;
  if exists (select 1 from public.profiles) then raise exception 'FAIL T09: 店舗スタッフに会員のプロフィールが見える'; end if;
  raise notice 'PASS T09 スタッフは他店で付与できず、他店の記録・会員のプロフィールも見えない';
end $$;
reset role;

-- 期限切れの番号（テスト用に直接作る）
insert into public.member_tokens (token, user_id, expires_at)
values ('expiredtoken', '00000000-0000-0000-0000-0000000000d1', now() - interval '1 second');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
do $$ begin
  begin perform public.redeem_coupon('expiredtoken', 'c0000000-0000-0000-0000-000000000101');
        raise exception 'FAIL T10: 期限切れの会員証が使えた';
  exception when others then if sqlerrm <> 'invalid_or_expired_token' then raise; end if; end;
  raise notice 'PASS T10 期限切れの会員証QR（スクリーンショットの使い回し）は使えない';
end $$;
do $$
declare r jsonb;
begin
  r := public.redeem_coupon(current_setting('test.token_a'), 'c0000000-0000-0000-0000-000000000101');
  if r->>'status' <> 'redeemed' then raise exception 'FAIL T11: クーポンが使えない %', r; end if;
  begin perform public.redeem_coupon(current_setting('test.token_a'), 'c0000000-0000-0000-0000-000000000101');
        raise exception 'FAIL T11: 同じクーポンを2回使えた';
  exception when unique_violation then null; end;
  r := public.redeem_coupon(current_setting('test.token_a'), 'c0000000-0000-0000-0000-000000000103');
  if r->>'status' <> 'redeemed' then raise exception 'FAIL T11: 配られた初回クーポンが使えない %', r; end if;
  raise notice 'PASS T11 クーポンは1人1回（2回目はDBの一意制約で止まる）';
end $$;
do $$ begin
  -- スタッフはメニューを変えられない（オーナーのみ）。限定メニューは登録できる
  update public.menu_items set price = 1 where store_id = '11111111-1111-1111-1111-000000000001';
  if exists (select 1 from public.menu_items where price = 1) then raise exception 'FAIL T12: スタッフがメニュー価格を変えられた'; end if;
  insert into public.daily_specials (store_id, name, price) values ('11111111-1111-1111-1111-000000000001', 'テスト限定', 999);
  begin insert into public.daily_specials (store_id, name, price) values ('11111111-1111-1111-1111-000000000002', '他店に登録', 1);
        raise exception 'FAIL T12: 他店の限定メニューを登録できた';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T12 スタッフは自店の限定メニューだけ登録でき、メニュー価格や他店は変えられない';
end $$;
do $$
declare r jsonb;
begin
  r := public.update_seats('11111111-1111-1111-1111-000000000001',
         '{"5ea70000-0000-0000-0000-000000000101": 0, "5ea70000-0000-0000-0000-000000000102": 0, "5ea70000-0000-0000-0000-000000000103": 0}'::jsonb, 15::smallint);
  if (r->>'any_free')::boolean then raise exception 'FAIL T13: 満席にできない'; end if;
  if (select wait_minutes from public.store_seat_status where store_id = '11111111-1111-1111-1111-000000000001') <> 15 then
    raise exception 'FAIL T13: 待ち時間が保存されない'; end if;
  begin perform public.update_seats('11111111-1111-1111-1111-000000000001', '{"5ea70000-0000-0000-0000-000000000101": 99}'::jsonb, 0::smallint);
        raise exception 'FAIL T13: 席数を超える空きを登録できた';
  exception when check_violation then null; end;
  begin perform public.update_seats('11111111-1111-1111-1111-000000000001', '{"5ea70000-0000-0000-0000-000000000201": 1}'::jsonb, 0::smallint);
        raise exception 'FAIL T13: 他店の席を更新できた';
  exception when others then if sqlerrm <> 'seat_type_mismatch' then raise; end if; end;
  begin perform public.update_seats('11111111-1111-1111-1111-000000000002', '{"5ea70000-0000-0000-0000-000000000201": 1}'::jsonb, 0::smallint);
        raise exception 'FAIL T13: 他店の空席を更新できた';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T13 空席は自店だけ更新でき、席数を超える値は入らない';
end $$;
do $$ begin
  if not exists (select 1 from public.audit_logs) then raise exception 'FAIL T14: 自店の操作記録が見えない'; end if;
  if exists (select 1 from public.audit_logs where store_id is distinct from '11111111-1111-1111-1111-000000000001') then
    raise exception 'FAIL T14: 他店・会員登録の記録が見える'; end if;
  raise notice 'PASS T14 操作の記録が残り、スタッフには自店の記録だけが見える';
end $$;
reset role;

-- ---------- オーナーと運営：掲載状態の変更 ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
do $$ begin
  update public.stores set description = 'オーナーが更新' where id = '11111111-1111-1111-1111-000000000001';
  begin update public.stores set status = 'suspended' where id = '11111111-1111-1111-1111-000000000001';
        raise exception 'FAIL T15: オーナーが掲載状態を変えられた';
  exception when insufficient_privilege then null; end;
  update public.stores set description = '他店を書き換え' where id = '11111111-1111-1111-1111-000000000002';
  update public.menu_items set price = 1680 where store_id = '11111111-1111-1111-1111-000000000001' and name = '上タン塩';
end $$;
reset role;
do $$ begin
  if (select description from public.stores where id = '11111111-1111-1111-1111-000000000002') = '他店を書き換え' then
    raise exception 'FAIL T15: オーナーが他店の情報を書き換えられた'; end if;
  if (select description from public.stores where id = '11111111-1111-1111-1111-000000000001') <> 'オーナーが更新' then
    raise exception 'FAIL T15: オーナーが自店の情報を更新できない'; end if;
  raise notice 'PASS T15 オーナーは自店の情報だけ更新でき、掲載状態は変えられない';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false) \g /dev/null
do $$ begin
  update public.stores set status = 'approved' where id = '11111111-1111-1111-1111-000000000099';
  if (select status from public.stores where id = '11111111-1111-1111-1111-000000000099') <> 'approved' then
    raise exception 'FAIL T16: 運営が掲載を承認できない'; end if;
  update public.stores set status = 'pending' where id = '11111111-1111-1111-1111-000000000099';
  raise notice 'PASS T16 運営は店舗の掲載を承認できる';
end $$;
reset role;

-- ---------- はしごボーナス：20歳以上の確認をした会員だけ ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false) \g /dev/null
do $$ begin
  perform public.register_profile('テストB', null, true, true);
  perform set_config('test.token_b', public.issue_member_token()->>'token', false);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
do $$ begin perform public.redeem_visit(current_setting('test.token_b'), '11111111-1111-1111-1111-000000000001'); end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
do $$
declare rb jsonb; ra jsonb;
begin
  rb := public.redeem_visit(current_setting('test.token_b'), '11111111-1111-1111-1111-000000000002');
  ra := public.redeem_visit(current_setting('test.token_a'), '11111111-1111-1111-1111-000000000002');
  if not (rb->>'hop_bonus')::boolean or (rb->>'points')::int <> 230 then raise exception 'FAIL T17: 20歳以上の会員にはしごボーナスが付かない %', rb; end if;
  if (ra->>'hop_bonus')::boolean then raise exception 'FAIL T17: 20歳以上の確認がない会員にはしごボーナスが付いた %', ra; end if;
  raise notice 'PASS T17 はしごボーナスは20歳以上の確認をした会員だけに付く';
end $$;
reset role;

-- ---------- 会員B：初回クーポンを持たない人は使えない ----------
delete from public.user_coupons where user_id = '00000000-0000-0000-0000-0000000000d2';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
do $$ begin
  begin perform public.redeem_coupon(current_setting('test.token_b'), 'c0000000-0000-0000-0000-000000000103');
        raise exception 'FAIL T18: 配られていない初回クーポンが使えた';
  exception when insufficient_privilege then if sqlerrm <> 'coupon_not_granted' then raise; end if; end;
  raise notice 'PASS T18 配られていない初回クーポンは使えない';
end $$;
reset role;

-- ---------- ランク：累計ポイントで上がり、交換で下がらない ----------
insert into public.point_ledger (user_id, delta, reason) values
  ('00000000-0000-0000-0000-0000000000d1', 2600, 'テスト加算'),
  ('00000000-0000-0000-0000-0000000000d1', -900, 'テスト交換');
do $$ begin
  if (public.rank_of('00000000-0000-0000-0000-0000000000d1')).name <> 'ゴールド' then
    raise exception 'FAIL T19: 交換でランクが下がった、または上がらない'; end if;
  raise notice 'PASS T19 ランクは累計獲得ポイントで決まり、交換しても下がらない';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false) \g /dev/null
do $$ begin
  update public.profiles set equipped_frame_id = (select id from public.cosmetics where name = 'ゴールドの枠');
  begin update public.profiles set equipped_frame_id = (select id from public.cosmetics where name = '黒龍の枠');
        raise exception 'FAIL T20: 招待制ランクの枠を装備できた';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T20 ランクで解放された枠は装備でき、招待制ランクの枠は装備できない';
end $$;
reset role;

-- ---------- すべてのテーブルで RLS が有効か ----------
do $$
declare t text;
begin
  select string_agg(c.relname, ', ') into t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if t is not null then raise exception 'FAIL T21: RLSが無効なテーブルがある: %', t; end if;
  raise notice 'PASS T21 public のすべてのテーブルで RLS が有効';
end $$;

-- ---------- トリガー専用の関数は画面から呼べない・search_path が固定されている ----------
do $$
declare t text;
begin
  if has_function_privilege('authenticated', 'public.check_equipped()', 'execute')
     or has_function_privilege('anon', 'public.protect_store_fields()', 'execute')
     or has_function_privilege('anon', 'public.set_updated_at()', 'execute') then
    raise exception 'FAIL T22: トリガー専用の関数が画面から呼べる';
  end if;
  if has_function_privilege('anon', 'public.issue_member_token()', 'execute') then
    raise exception 'FAIL T22: 未ログインで会員証QRを発行できる';
  end if;
  select string_agg(p.proname, ', ') into t
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if t is not null then raise exception 'FAIL T22: search_path が固定されていない関数: %', t; end if;
  raise notice 'PASS T22 トリガー専用の関数は呼べず、すべての関数の search_path が固定されている';
end $$;


-- ---------- 退会：本人だけが削除でき、関連データも消え、記録は残る ----------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d3', 'user-c@example.test');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d3', false) \g /dev/null
select public.register_profile('退会テスト', null, false, true) \g /dev/null
select public.delete_my_account() \g /dev/null
reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000d3') then raise exception 'FAIL T23: 退会してもアカウントが残っている'; end if;
  if exists (select 1 from public.profiles where user_id = '00000000-0000-0000-0000-0000000000d3')
     or exists (select 1 from public.point_ledger where user_id = '00000000-0000-0000-0000-0000000000d3')
     or exists (select 1 from public.user_coupons where user_id = '00000000-0000-0000-0000-0000000000d3') then
    raise exception 'FAIL T23: 退会後も会員のデータが残っている';
  end if;
  if not exists (select 1 from public.audit_logs where action = 'account_deleted' and target_user = '00000000-0000-0000-0000-0000000000d3') then
    raise exception 'FAIL T23: 退会の記録が残っていない';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
do $$ begin
  begin perform public.delete_my_account(); raise exception 'FAIL T23: 店舗スタッフが自分で退会できた';
  exception when insufficient_privilege then if sqlerrm <> 'staff_account_cannot_self_delete' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.delete_my_account()', 'execute') then raise exception 'FAIL T23: 未ログインで退会の関数を呼べる'; end if;
  raise notice 'PASS T23 退会は本人だけ・関連データも削除・記録は残る・店舗アカウントは自分で退会できない';
end $$;


-- ---------- 店舗PIN（予備の来店認証） ----------
-- まちだ苑のスタッフ（b2）は今日のPINを見られる。翠のオーナー（c1）は、まちだ苑のPINを見られない
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
select set_config('test.pin', public.store_pin_today('11111111-1111-1111-1111-000000000001'), false) \g /dev/null
do $$ begin
  if current_setting('test.pin') !~ '^[0-9]{4}$' then raise exception 'FAIL T24: PINが4桁でない'; end if;
  begin perform public.rotate_store_pin('11111111-1111-1111-1111-000000000001'); raise exception 'FAIL T24: スタッフがPINを作り直せた';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
do $$ begin
  begin perform public.store_pin_today('11111111-1111-1111-1111-000000000001'); raise exception 'FAIL T24: 他店のオーナーがPINを見られた';
  exception when insufficient_privilege then null; end;
end $$;
-- 会員（d2）：PINの元の値は読めない。間違いは記録され、正しいPINでスタンプが付く
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false) \g /dev/null
do $$
declare r jsonb; wrong text;
begin
  begin perform 1 from public.store_pin_secrets; raise exception 'FAIL T24: PINの元の値が読めた';
  exception when insufficient_privilege then null; end;
  begin perform public.store_pin_today('11111111-1111-1111-1111-000000000001'); raise exception 'FAIL T24: 会員がPINを見られた';
  exception when insufficient_privilege then null; end;
  wrong := lpad(((current_setting('test.pin')::int + 1) % 10000)::text, 4, '0');
  r := public.redeem_visit_by_pin('11111111-1111-1111-1111-000000000001', wrong);
  if r->>'status' <> 'wrong_pin' then raise exception 'FAIL T24: 間違ったPINが通った'; end if;
  r := public.redeem_visit_by_pin('11111111-1111-1111-1111-000000000001', current_setting('test.pin'));
  if r->>'status' not in ('stamped', 'already_stamped_today') then raise exception 'FAIL T24: 正しいPINでスタンプが付かない: %', r; end if;
end $$;
reset role;
-- 5回間違えると、その日は正しいPINでも止まる（d1・翠）
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
select set_config('test.pin2', public.store_pin_today('11111111-1111-1111-1111-000000000002'), false) \g /dev/null
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false) \g /dev/null
do $$
declare wrong text := lpad(((current_setting('test.pin2')::int + 1) % 10000)::text, 4, '0');
begin
  for i in 1..5 loop perform public.redeem_visit_by_pin('11111111-1111-1111-1111-000000000002', wrong); end loop;
  begin perform public.redeem_visit_by_pin('11111111-1111-1111-1111-000000000002', current_setting('test.pin2'));
        raise exception 'FAIL T24: 5回間違えた後もPINで処理できた';
  exception when insufficient_privilege then if sqlerrm <> 'pin_locked' then raise; end if; end;
end $$;
-- オーナー（b1）がPINを作り直すと、今日のPINが変わる
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
do $$
declare before text := public.store_pin_today('11111111-1111-1111-1111-000000000001'); changed boolean := false;
begin
  for i in 1..5 loop
    perform public.rotate_store_pin('11111111-1111-1111-1111-000000000001');
    if public.store_pin_today('11111111-1111-1111-1111-000000000001') <> before then changed := true; exit; end if;
  end loop;
  if not changed then raise exception 'FAIL T24: 作り直してもPINが変わらない'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.redeem_visit_by_pin(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.pin_for(uuid,date)', 'execute')
     or has_function_privilege('authenticated', 'public.grant_visit(uuid,uuid,uuid,text)', 'execute') then
    raise exception 'FAIL T24: 内部用・会員用の関数の権限が正しくない';
  end if;
  if not exists (select 1 from public.audit_logs where action = 'pin_failed') then raise exception 'FAIL T24: PINの失敗が記録されていない'; end if;
  raise notice 'PASS T24 店舗PINはその店の人だけが見られ、毎日変わり、間違いは記録・5回で当日停止、オーナーが作り直せる';
end $$;


-- ---------- ポイント交換 ----------
-- まちだ苑のオーナー（b1）が交換用クーポンと交換品を登録できる。翠のオーナー（c1）は登録できない
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
insert into public.coupons (id, store_id, title, kind) values
  ('c0000000-0000-0000-0000-000000000901', '11111111-1111-1111-1111-000000000001', '交換：ドリンク1杯', 'exchange');
insert into public.exchange_items (id, store_id, coupon_id, title, points_cost, stock) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-000000000001', 'c0000000-0000-0000-0000-000000000901', 'ドリンク1杯', 300, 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false) \g /dev/null
do $$ begin
  begin
    insert into public.exchange_items (store_id, coupon_id, title, points_cost)
    values ('11111111-1111-1111-1111-000000000001', 'c0000000-0000-0000-0000-000000000901', '不正な交換品', 1);
    raise exception 'FAIL T25: 他店のオーナーが交換品を登録できた';
  exception when insufficient_privilege then null; end;
end $$;
-- 会員（d2）が交換する：ポイントが減り、クーポンが配られ、2回目は止まる
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false) \g /dev/null
do $$
declare before int; after int; earned_before int; earned_after int; r jsonb;
begin
  select balance, earned into before, earned_before from public.my_points where user_id = '00000000-0000-0000-0000-0000000000d2';
  r := public.exchange_points('e0000000-0000-0000-0000-000000000001');
  select balance, earned into after, earned_after from public.my_points where user_id = '00000000-0000-0000-0000-0000000000d2';
  if after <> before - 300 then raise exception 'FAIL T25: 交換でポイントが正しく減らない（% → %）', before, after; end if;
  if earned_after <> earned_before then raise exception 'FAIL T25: 交換で累計獲得ポイント（ランク）が変わった'; end if;
  if not exists (select 1 from public.user_coupons where coupon_id = 'c0000000-0000-0000-0000-000000000901') then raise exception 'FAIL T25: 交換したクーポンが配られていない'; end if;
  begin perform public.exchange_points('e0000000-0000-0000-0000-000000000001'); raise exception 'FAIL T25: 同じ交換品を2回交換できた';
  exception when unique_violation then null; when others then if sqlerrm not in ('exchange_already_done', 'exchange_sold_out') then raise; end if; end;
end $$;
-- 在庫切れ・残高不足は止まる（d1：在庫0になった交換品）
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false) \g /dev/null
do $$ begin
  begin perform public.exchange_points('e0000000-0000-0000-0000-000000000001'); raise exception 'FAIL T25: 在庫切れでも交換できた';
  exception when others then if sqlerrm <> 'exchange_sold_out' then raise; end if; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
insert into public.coupons (id, store_id, title, kind) values
  ('c0000000-0000-0000-0000-000000000902', '11111111-1111-1111-1111-000000000001', '交換：コース料理', 'exchange');
insert into public.exchange_items (id, store_id, coupon_id, title, points_cost) values
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-000000000001', 'c0000000-0000-0000-0000-000000000902', 'コース料理', 99999);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false) \g /dev/null
do $$ begin
  begin perform public.exchange_points('e0000000-0000-0000-0000-000000000002'); raise exception 'FAIL T25: 残高不足でも交換できた';
  exception when others then if sqlerrm <> 'not_enough_points' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.exchange_points(uuid)', 'execute') then raise exception 'FAIL T25: 未ログインで交換の関数を呼べる'; end if;
  raise notice 'PASS T25 ポイント交換：残高・2回目・在庫をDBで確認、ランクは下がらず、他店は交換品を登録できない';
end $$;


-- ---------- 画像のアップロード ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false) \g /dev/null
insert into storage.objects (bucket_id, name) values ('public-images', 'stores/11111111-1111-1111-1111-000000000001/cover-1.webp');
update public.stores set cover_path = 'stores/11111111-1111-1111-1111-000000000001/cover-1.webp' where id = '11111111-1111-1111-1111-000000000001';
do $$ begin
  begin insert into storage.objects (bucket_id, name) values ('public-images', 'stores/11111111-1111-1111-1111-000000000002/x.webp');
        raise exception 'FAIL T26: 他店の写真を登録できた';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('public-images', 'cosmetics/x.webp');
        raise exception 'FAIL T26: オーナーが衣装の画像を登録できた';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false) \g /dev/null
do $$ begin
  begin insert into storage.objects (bucket_id, name) values ('public-images', 'stores/11111111-1111-1111-1111-000000000001/staff.webp');
        raise exception 'FAIL T26: スタッフが店舗の写真を登録できた';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false) \g /dev/null
insert into storage.objects (bucket_id, name) values ('public-images', 'cosmetics/outfit-1.webp');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false) \g /dev/null
do $$ begin
  begin insert into storage.objects (bucket_id, name) values ('public-images', 'stores/../cosmetics/y.webp');
        raise exception 'FAIL T26: 会員が画像を登録できた';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select cover_path from public.stores where id = '11111111-1111-1111-1111-000000000001') is null then raise exception 'FAIL T26: 店舗の写真を設定できない'; end if;
  raise notice 'PASS T26 画像：店舗の写真はその店のオーナー・運営だけ、衣装の画像は運営だけが登録できる';
end $$;


-- ---------- 期限切れの会員証番号の片付け ----------
insert into public.member_tokens (token, user_id, expires_at) values
  ('oldtoken00000000000000000000000a', '00000000-0000-0000-0000-0000000000d1', now() - interval '2 hours'),
  ('newtoken00000000000000000000000b', '00000000-0000-0000-0000-0000000000d1', now() + interval '30 seconds');
do $$ begin
  perform public.cleanup_member_tokens();
  if exists (select 1 from public.member_tokens where token = 'oldtoken00000000000000000000000a') then raise exception 'FAIL T27: 期限切れの番号が残っている'; end if;
  if not exists (select 1 from public.member_tokens where token = 'newtoken00000000000000000000000b') then raise exception 'FAIL T27: 有効な番号まで消えた'; end if;
  if has_function_privilege('authenticated', 'public.cleanup_member_tokens()', 'execute') then raise exception 'FAIL T27: 会員が片付けの関数を呼べる'; end if;
  raise notice 'PASS T27 期限切れの会員証番号だけを片付ける（画面からは呼べない）';
end $$;

\echo 'ALL TESTS PASSED'
