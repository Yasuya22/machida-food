import type { Metadata } from "next";
import { requireStoreAccess } from "@/lib/store/access";
import { isWithin } from "@/lib/stores/status";
import { Scanner } from "./Scanner";
import { StorePin } from "./StorePin";

export const metadata: Metadata = { title: "来店処理" };

export default async function ScanPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { session, canRedeem } = await requireStoreAccess(storeId);
  if (!canRedeem) {
    return <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">来店処理はこのお店のオーナー・スタッフのアカウントで行います（運営アカウントでは処理できません）。</p>;
  }
  const { data: pin } = await session.supabase.rpc("store_pin_today", { p_store: storeId });
  const { data } = await session.supabase
    .from("coupons")
    .select("id,title,kind,starts_at,ends_at")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("created_at")
    .returns<{ id: string; title: string; kind: string; starts_at: string; ends_at: string | null }[]>();
  const now = new Date();
  const coupons = (data ?? []).filter((c) => isWithin(c.starts_at, c.ends_at, now)).map(({ id, title, kind }) => ({ id, title, kind }));

  return (
    <div className="space-y-3">
      <Scanner storeId={storeId} coupons={coupons} />
      {typeof pin === "string" ? <StorePin pin={pin} /> : null}
      <p className="text-xs text-muted">
        会員証QRは30秒で切り替わる使い捨ての番号です。スクリーンショットの使い回しや、同じ日の2回目のスタンプは自動で止まり、記録に残ります。
      </p>
    </div>
  );
}
