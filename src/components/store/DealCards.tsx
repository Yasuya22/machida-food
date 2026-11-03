import Link from "next/link";
import type { Coupon, DailySpecial, TimeSale } from "@/lib/stores/queries";
import { minutesToLabel, tokyoNow, yen } from "@/lib/stores/status";
import { Pill } from "./StatusBadges";
import { Icon } from "@/components/ui/Icon";

/** 終了時刻の表示（今日なら時刻だけ、別の日なら日付も） */
function endLabel(endsAt: string): string {
  const end = tokyoNow(new Date(endsAt));
  const today = tokyoNow();
  const time = minutesToLabel(end.minutes);
  if (end.ymd === today.ymd) return `本日${time}まで`;
  const [, m, d] = end.ymd.split("-");
  return `${Number(m)}/${Number(d)} ${time}まで`;
}

function StoreLink({ id, name }: { id: string; name?: string | null }) {
  if (!name) return null;
  return (
    <Link href={`/stores/${id}`} className="text-sm text-accent underline-offset-2 hover:underline">
      {name}
    </Link>
  );
}

export function CouponCard({ coupon, showStore = false }: { coupon: Coupon; showStore?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent-bright/60 bg-surface p-4 shadow-card">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-accent-bright" aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-bold">{coupon.title}</p>
        {coupon.kind === "rain" ? <Pill tone="muted">雨の日限定</Pill> : null}
      </div>
      {coupon.conditions ? <p className="mt-1 text-xs text-muted">条件：{coupon.conditions}</p> : null}
      <div className="mt-1 flex items-center justify-between gap-2">
        {showStore ? <StoreLink id={coupon.store_id} name={coupon.stores?.name} /> : <span />}
        <span className="text-xs text-muted">{coupon.ends_at ? endLabel(coupon.ends_at) : "期限なし"}</span>
      </div>
    </div>
  );
}

/** 残り時間（60分未満なら「まもなく終了」） */
function remainLabel(endsAt: string): { text: string; soon: boolean } {
  const min = Math.floor((Date.parse(endsAt) - Date.now()) / 60000);
  if (min < 60) return { text: min <= 0 ? "まもなく終了" : `まもなく終了・あと${min}分`, soon: true };
  return { text: endLabel(endsAt), soon: false };
}

/** タイムセール（テラコッタで強調） */
export function TimeSaleCard({ sale, showStore = false }: { sale: TimeSale; showStore?: boolean }) {
  const r = remainLabel(sale.ends_at);
  return (
    <div className="rounded-2xl border border-sale/30 bg-sale-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-sm font-bold text-sale">
          <Icon name="flame" className="h-4 w-4" />
          タイムセール
        </span>
        <span className={`text-sm font-bold ${r.soon ? "text-sale" : "text-muted"}`}>{r.text}</span>
      </div>
      <p className="mt-1.5 text-base font-bold leading-snug">{sale.title}</p>
      {showStore ? (
        <div className="mt-1">
          <StoreLink id={sale.store_id} name={sale.stores?.name} />
        </div>
      ) : null}
    </div>
  );
}

export function SpecialCard({ special, showStore = false }: { special: DailySpecial; showStore?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-bold tracking-wider text-accent">今日だけ</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-base font-bold">{special.name}</p>
        <span className="shrink-0 font-bold text-accent">{yen(special.price)}</span>
      </div>
      {special.note ? <p className="mt-1 text-xs text-muted">{special.note}</p> : null}
      {showStore ? (
        <div className="mt-1">
          <StoreLink id={special.store_id} name={special.stores?.name} />
        </div>
      ) : null}
    </div>
  );
}
