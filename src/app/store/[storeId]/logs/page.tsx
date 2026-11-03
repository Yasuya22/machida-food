import type { Metadata } from "next";
import { cardClass } from "@/components/ui/Flash";
import { requireStoreAccess } from "@/lib/store/access";
import { minutesToLabel, tokyoNow } from "@/lib/stores/status";

export const metadata: Metadata = { title: "記録" };

const ACTION_LABEL: Record<string, string> = {
  visit: "来店スタンプ",
  visit_duplicate: "同じ日の2回目（付与なし）",
  coupon: "クーポン使用",
  coupon_duplicate: "使用済みクーポンの再利用（拒否）",
  seats: "空席の更新",
};

type Log = { id: number; action: string; detail: Record<string, unknown>; created_at: string; target_user: string | null };

/** 操作の記録。お客様の個人情報は表示しない（お客様ごとの短い記号だけ） */
export default async function LogsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { session } = await requireStoreAccess(storeId);
  const { data } = await session.supabase
    .from("audit_logs")
    .select("id,action,detail,created_at,target_user")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Log[]>();
  const logs = data ?? [];
  const today = tokyoNow().ymd;
  const todays = logs.filter((l) => tokyoNow(new Date(l.created_at)).ymd === today);
  const count = (a: string) => todays.filter((l) => l.action === a).length;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          ["今日の来店", count("visit")],
          ["クーポン", count("coupon")],
          ["不正の疑い", count("visit_duplicate") + count("coupon_duplicate")],
        ].map(([label, n]) => (
          <div key={label as string} className={cardClass}>
            <p className="text-[11px] text-muted">{label}</p>
            <p className="font-display text-2xl font-bold text-brand">{n}</p>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">最近の記録</h2>
        {logs.length === 0 ? <p className={`${cardClass} text-sm text-muted`}>まだ記録はありません。</p> : null}
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
          {logs.map((l) => {
            const t = tokyoNow(new Date(l.created_at));
            const pts = typeof l.detail?.points === "number" ? `${l.detail.points}pt` : "";
            const warn = l.action.endsWith("_duplicate");
            return (
              <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <p className={warn ? "font-bold text-full" : ""}>{ACTION_LABEL[l.action] ?? l.action}</p>
                  <p className="text-[11px] text-muted">
                    {t.ymd === today ? "今日" : t.ymd.slice(5).replace("-", "/")} {minutesToLabel(t.minutes)}
                    {l.target_user ? `・お客様 #${l.target_user.slice(0, 4)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">{pts}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-muted">お客様の名前・連絡先はお店には表示されません。「#」の記号は同じお客様かどうかの目安です。</p>
      </section>
    </div>
  );
}
