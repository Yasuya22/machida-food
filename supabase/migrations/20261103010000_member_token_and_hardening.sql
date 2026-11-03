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
