import "server-only";
import { notFound } from "next/navigation";
import { requireSession, type Session } from "@/lib/auth";

export type StoreRole = "store_owner" | "store_staff" | "admin";

export type StoreAccess = {
  session: Session;
  role: StoreRole;
  /** 店舗情報・メニュー等を編集できるか（オーナーと運営） */
  canManage: boolean;
  /** 会員証の読み取り（スタンプ・クーポン）ができるか（その店のオーナー・スタッフ） */
  canRedeem: boolean;
  store: { id: string; name: string; status: string };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 店舗管理画面の入口チェック。その店のオーナー・スタッフ、または運営だけが入れる。
 * 画面で隠すだけでなく、実際の読み書きはDBのRLS・関数でも権限を確認している。
 */
export async function requireStoreAccess(storeId: string): Promise<StoreAccess> {
  if (!UUID.test(storeId)) notFound();
  const session = await requireSession(`/store/${storeId}`);
  const [member, admin, store] = await Promise.all([
    session.supabase.from("store_members").select("role").eq("store_id", storeId).eq("user_id", session.userId).maybeSingle(),
    session.supabase.from("admins").select("user_id").eq("user_id", session.userId).maybeSingle(),
    session.supabase.from("stores").select("id,name,status").eq("id", storeId).maybeSingle(),
  ]);
  const memberRole = (member.data as { role: "store_owner" | "store_staff" } | null)?.role;
  const isAdmin = !!admin.data;
  if ((!memberRole && !isAdmin) || !store.data) notFound();

  const role: StoreRole = memberRole ?? "admin";
  return {
    session,
    role,
    canManage: role === "store_owner" || isAdmin,
    canRedeem: !!memberRole,
    store: store.data as StoreAccess["store"],
  };
}
