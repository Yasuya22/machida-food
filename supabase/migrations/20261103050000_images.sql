-- =====================================================================
-- 画像のアップロード（店舗の写真・着せ替え衣装）
--
--   * 保存場所：Supabase Storage の public-images（だれでも表示できる。登録は権限のある人だけ）
--       stores/<店舗ID>/...   … その店のオーナー・運営だけが登録できる
--       cosmetics/...        … 運営だけが登録できる
--   * 画像は端末側で縮小・圧縮（WebP、最大1200px）してから送る。1ファイル1MBまで
--   * 差し替えは新しいファイル名で登録して、表示する画像の場所を書き換える（古い画像は消さない）
-- =====================================================================

alter table public.stores add column cover_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-images', 'public-images', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- フォルダ名（店舗ID）から、その店を管理できるかを判定する
create function public.can_manage_store_folder(p_folder text) returns boolean
  language plpgsql stable security definer set search_path = public
  as $$
begin
  if p_folder is null or p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return is_store_owner(p_folder::uuid) or is_admin();
end $$;

create policy public_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'public-images' and (
      ((storage.foldername(name))[1] = 'stores' and public.can_manage_store_folder((storage.foldername(name))[2]))
      or ((storage.foldername(name))[1] = 'cosmetics' and public.is_admin())
    )
  );

revoke execute on function public.can_manage_store_folder(text) from public, anon;
grant execute on function public.can_manage_store_folder(text) to authenticated;
