-- テスト用の利用者と店舗スタッフ（テスト専用。本番では実行しない）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-machidaen@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'staff-machidaen@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'owner-sui@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'user-a@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'user-b@example.test');

insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');

insert into public.store_members (store_id, user_id, role) values
  ('11111111-1111-1111-1111-000000000001', '00000000-0000-0000-0000-0000000000b1', 'store_owner'),
  ('11111111-1111-1111-1111-000000000001', '00000000-0000-0000-0000-0000000000b2', 'store_staff'),
  ('11111111-1111-1111-1111-000000000002', '00000000-0000-0000-0000-0000000000c1', 'store_owner');

-- 掲載前（審査中）の店舗：一般には見えてはいけない
insert into public.stores (id, name, genre, status) values
  ('11111111-1111-1111-1111-000000000099', '審査中の店舗', '居酒屋', 'pending');
insert into public.menu_items (store_id, name, price) values
  ('11111111-1111-1111-1111-000000000099', '審査中のメニュー', 500);
