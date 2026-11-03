-- =====================================================================
-- 開発用Supabaseに「貼り付けて実行」してもらうSQL（1回だけ）
--   Supabase の SQL Editor → New query → 全文を貼り付け → Run
--   中身：退会の関数（3本目）と、期限切れ会員証番号の自動片付け（6本目）
--   どちらも「削除」を含むため、Claude からは確認画面の都合で実行できなかったもの
--   実行しても、いまあるデータは消えません（関数と定期実行の登録だけ）
-- =====================================================================

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
