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
