import Link from "next/link";
import { requireStoreAccess } from "@/lib/store/access";
import { StoreTabs, type StoreTab } from "./StoreTabs";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { store_owner: "オーナー", store_staff: "スタッフ", admin: "運営" } as const;

/** 店舗管理画面の共通の枠（店名・権限・タブ） */
export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const access = await requireStoreAccess(storeId);
  const tabs: StoreTab[] = [
    { href: `/store/${storeId}/scan`, label: "来店処理", icon: "qr", main: true },
    { href: `/store/${storeId}`, label: "空席更新", icon: "seat", main: true },
    { href: `/store/${storeId}/deals`, label: "セール登録", icon: "sale", main: true },
    { href: `/store/${storeId}/logs`, label: "記録", icon: "list" },
    ...(access.canManage ? [{ href: `/store/${storeId}/manage`, label: "店舗設定", icon: "gear" as const }] : []),
  ];

  return (
    <div className="min-h-dvh">
      <header className="bg-brand px-4 pt-[calc(env(safe-area-inset-top)+14px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between text-xs">
            <Link href="/mypage" className="text-on-brand-soft">← マイページ</Link>
            <span className="rounded-full bg-accent-bright px-2 py-0.5 font-bold text-brand">{ROLE_LABEL[access.role]}</span>
          </div>
          <p className="mt-2 text-xs tracking-[0.25em] text-accent-bright">STORE ADMIN</p>
          <h1 className="font-display text-xl font-bold">{access.store.name}</h1>
          {access.store.status !== "approved" ? (
            <p className="mt-1 text-xs text-warn-soft">掲載状態：{access.store.status === "pending" ? "審査中（一般には非表示）" : "停止中（一般には非表示）"}</p>
          ) : null}
          <StoreTabs tabs={tabs} />
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-5">{children}</div>
    </div>
  );
}
