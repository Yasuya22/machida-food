import type { Metadata } from "next";
import { Flash, buttonClass, cardClass, inputClass } from "@/components/ui/Flash";
import { OpenBadge, SeatPanel } from "@/components/store/StatusBadges";
import { requireStoreAccess } from "@/lib/store/access";
import { openState, seatState, tokyoNow, type SeatType, type StoreHours } from "@/lib/stores/status";
import { updateSeats } from "./actions";

export const metadata: Metadata = { title: "空席の更新" };

const WAITS = [0, 10, 15, 20, 30, 45, 60, 90];

export default async function SeatsPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { storeId } = await params;
  const { msg } = await searchParams;
  const { session } = await requireStoreAccess(storeId);

  const [seats, status, hours, closed] = await Promise.all([
    session.supabase.from("seat_types").select("id,name,kind,unit_size,total,free,sort").eq("store_id", storeId).order("sort").returns<SeatType[]>(),
    session.supabase.from("store_seat_status").select("wait_minutes,updated_at").eq("store_id", storeId).maybeSingle(),
    session.supabase.from("store_hours").select("weekday,opens,closes,last_order").eq("store_id", storeId).returns<StoreHours[]>(),
    session.supabase.from("store_closed_days").select("day").eq("store_id", storeId).returns<{ day: string }[]>(),
  ]);
  const now = new Date();
  const open = openState(hours.data ?? [], (closed.data ?? []).map((d) => d.day), tokyoNow(now));
  const st = status.data as { wait_minutes: number; updated_at: string } | null;
  const view = seatState(seats.data ?? [], st, open, now);

  return (
    <div className="space-y-5">
      <Flash msg={msg} />
      <section className={cardClass}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">お客様に見えている表示</h2>
          <OpenBadge state={open} />
        </div>
        <SeatPanel state={view} />
        <p className="mt-3 text-[11px] text-muted">60分以上更新がないと、お客様の画面では「空席情報なし」になります。営業時間外・L.O.後は「空きあり」と表示されません。</p>
      </section>

      <form action={updateSeats} className={`${cardClass} space-y-3`}>
        <input type="hidden" name="store_id" value={storeId} />
        <h2 className="font-bold">いまの空き</h2>
        {(seats.data ?? []).length === 0 ? <p className="text-sm text-muted">席の種類が登録されていません（店舗設定で追加できます）。</p> : null}
        {(seats.data ?? []).map((s) => (
          <label key={s.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {s.name}
              <span className="ml-1 text-xs text-muted">（全{s.total}{s.kind === "counter" ? "席" : "卓"}）</span>
            </span>
            <select name={`seat_${s.id}`} defaultValue={s.free} className={`${inputClass} w-24 text-right`}>
              {Array.from({ length: s.total + 1 }, (_, i) => (
                <option key={i} value={i}>
                  空き {i}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            満席時の待ち時間
            <span className="block text-xs text-muted">空きが1つでもあれば0分になります</span>
          </span>
          <select name="wait" defaultValue={st?.wait_minutes ?? 0} className={`${inputClass} w-24 text-right`}>
            {WAITS.map((w) => (
              <option key={w} value={w}>
                {w}分
              </option>
            ))}
          </select>
        </label>
        <button className={`${buttonClass} w-full py-3`}>この内容で更新する</button>
        <p className="text-[11px] text-muted">変わりがなくても、こまめに「更新する」を押すと最新の情報として表示されます。</p>
      </form>
    </div>
  );
}
