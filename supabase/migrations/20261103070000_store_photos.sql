-- =====================================================================
-- 店舗の写真ギャラリーと、店名・ジャンル検索の索引
--
--   * store_photos：1店舗に複数の写真（料理・店内など）。表示順と説明つき
--     見られるのは掲載中の店舗の写真だけ。登録・並べ替え・非表示はその店のオーナーと運営
--   * 画像そのものは Storage の stores/<店舗ID>/ に置く（6本目のマイグレーションの権限）
--   * 部分一致検索（店名・ジャンル）を速くする索引（pg_trgm）。使えない環境では作らない
-- =====================================================================

create table public.store_photos (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  path       text not null,
  caption    text check (caption is null or char_length(caption) <= 40),
  sort       int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  check (path like 'stores/' || store_id::text || '/%')
);
create index store_photos_store_idx on public.store_photos (store_id, sort);
alter table public.store_photos enable row level security;

create policy store_photos_read on public.store_photos for select
  using (store_visible(store_id) and (is_active or is_store_member(store_id) or is_admin()));
create policy store_photos_write on public.store_photos for all
  using (is_store_owner(store_id) or is_admin()) with check (is_store_owner(store_id) or is_admin());

do $$
declare
  v_schema text;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    v_schema := case when exists (select 1 from pg_namespace where nspname = 'extensions') then 'extensions' else 'public' end;
    execute format('create extension if not exists pg_trgm with schema %I', v_schema);
    execute format('create index if not exists stores_name_trgm_idx on public.stores using gin (name %I.gin_trgm_ops)', v_schema);
    execute format('create index if not exists stores_genre_trgm_idx on public.stores using gin (genre %I.gin_trgm_ops)', v_schema);
  end if;
end $$;
