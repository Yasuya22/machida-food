import type { Metadata } from "next";
import { Flash, buttonClass, cardClass, inputClass, subButtonClass } from "@/components/ui/Flash";
import { requireStoreAccess } from "@/lib/store/access";
import { minutesToLabel, tokyoNow, yen } from "@/lib/stores/status";
import { addSpecial, addTimeSale, deleteSpecial, endTimeSale } from "../actions";

export const metadata: Metadata = { title: "限定メニュー・タイムセール" };

function when(iso: string): string {
  const t = tokyoNow(new Date(iso));
  const [, m, d] = t.ymd.split("-");
  return `${Number(m)}/${Number(d)} ${minutesToLabel(t.minutes)}`;
}

export default async function StoreDealsPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { storeId } = await params;
  const { msg } = await searchParams;
  const { session } = await requireStoreAccess(storeId);
  const now = new Date();
  const today = tokyoNow(now).ymd;

  const [specials, sales] = await Promise.all([
    session.supabase.from("daily_specials").select("id,name,price,note,special_date").eq("store_id", storeId).gte("special_date", today).order("special_date").returns<{ id: string; name: string; price: number; note: string | null; special_date: string }[]>(),
    session.supabase.from("time_sales").select("id,title,starts_at,ends_at").eq("store_id", storeId).gt("ends_at", now.toISOString()).order("starts_at").returns<{ id: string; title: string; starts_at: string; ends_at: string }[]>(),
  ]);

  // 入力欄の初期値（日本時間の今日）
  const t = tokyoNow(now);
  const hh = (m: number) => minutesToLabel(Math.min(m, 23 * 60 + 59)).padStart(5, "0");
  const defaultStart = `${today}T${hh(t.minutes)}`;
  const defaultEnd = `${today}T${hh(t.minutes + 120)}`;

  return (
    <div className="space-y-6">
      <Flash msg={msg} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">今日の限定メニュー</h2>
        <form action={addSpecial} className={`${cardClass} space-y-2`}>
          <input type="hidden" name="store_id" value={storeId} />
          <input name="name" required placeholder="メニュー名（例：本日の鮮魚の刺身）" className={inputClass} />
          <div className="flex gap-2">
            <input name="price" type="number" min={0} required placeholder="価格（税込み）" className={inputClass} />
            <input name="date" type="date" defaultValue={today} min={today} className={inputClass} />
          </div>
          <input name="note" placeholder="ひとこと（例：数量限定）" className={inputClass} />
          <button className={`${buttonClass} w-full`}>登録する</button>
          <p className="text-[11px] text-muted">指定した日だけ表示され、翌日には自動で消えます。</p>
        </form>
        <ul className="space-y-2">
          {(specials.data ?? []).map((s) => (
            <li key={s.id} className={`${cardClass} flex items-center justify-between gap-2`}>
              <div className="text-sm">
                <p className="font-bold">{s.name}　{yen(s.price)}</p>
                <p className="text-xs text-muted">{s.special_date === today ? "今日" : s.special_date}{s.note ? `・${s.note}` : ""}</p>
              </div>
              <form action={deleteSpecial}>
                <input type="hidden" name="store_id" value={storeId} />
                <input type="hidden" name="id" value={s.id} />
                <button className={subButtonClass}>取り消す</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">タイムセール</h2>
        <form action={addTimeSale} className={`${cardClass} space-y-2`}>
          <input type="hidden" name="store_id" value={storeId} />
          <input name="title" required placeholder="内容（例：生ビール半額）" className={inputClass} />
          <div className="grid grid-cols-2 gap-2 text-xs text-muted">
            <label className="space-y-1">開始<input name="starts_at" type="datetime-local" required defaultValue={defaultStart} className={inputClass} /></label>
            <label className="space-y-1">終了<input name="ends_at" type="datetime-local" required defaultValue={defaultEnd} className={inputClass} /></label>
          </div>
          <button className={`${buttonClass} w-full`}>登録する</button>
          <p className="text-[11px] text-muted">終了時刻を過ぎると自動で表示されなくなります。値引きの表示は実際の内容と一致させてください。</p>
        </form>
        <ul className="space-y-2">
          {(sales.data ?? []).map((s) => {
            const started = Date.parse(s.starts_at) <= now.getTime();
            return (
              <li key={s.id} className={`${cardClass} flex items-center justify-between gap-2`}>
                <div className="text-sm">
                  <p className="font-bold">{s.title}</p>
                  <p className="text-xs text-muted">{started ? "開催中" : "予定"}・{when(s.starts_at)}〜{when(s.ends_at)}</p>
                </div>
                <form action={endTimeSale}>
                  <input type="hidden" name="store_id" value={storeId} />
                  <input type="hidden" name="id" value={s.id} />
                  <button className={subButtonClass}>{started ? "今すぐ終了" : "取り消す"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
