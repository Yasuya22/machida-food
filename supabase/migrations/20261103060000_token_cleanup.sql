-- =====================================================================
-- 期限切れの会員証QR番号の自動片付け
--
--   * 会員証の番号は30秒で使えなくなるが、表には残るため、1日1回まとめて片付ける
--   * 定期実行は Supabase の pg_cron（無料）で、毎日 日本時間 4:15 に実行
--   * pg_cron がない環境（ローカルのテスト）では、片付けの関数だけを作る
-- =====================================================================

create function public.cleanup_member_tokens() returns int
  language plpgsql security definer set search_path = public
  as $$
declare
  n int;
begin
  delete from member_tokens where expires_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.cleanup_member_tokens() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- 毎日 19:15 UTC ＝ 日本時間 4:15
    perform cron.schedule('cleanup-member-tokens', '15 19 * * *', 'select public.cleanup_member_tokens()');
  end if;
end $$;
