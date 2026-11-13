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

/** クーポン（切り取り線のチケット。左の半券に縦書きで「クーポン」） */
export function CouponCard({ coupon, showStore = false }: { coupon: Coupon; showStore?: boolean }) {
  return (
    <div className="relative flex overflow-hidden rounded-md border border-accent-bright/70 bg-surface">
      <div className="flex w-10 shrink-0 items-center justify-center border-r-2 border-dashed border-accent-bright/60 bg-accent-soft">
        <span className="text-xs font-bold tracking-[0.3em] text-accent [writing-mode:vertical-rl]">クーポン</span>
      </div>
      {/* 切り込み（チケットの丸い欠け） */}
      <span className="absolute left-[34px] top-[-7px] h-3.5 w-3.5 rounded-full border border-accent-bright/70 bg-bg" aria-hidden="true" />
      <span className="absolute bottom-[-7px] left-[34px] h-3.5 w-3.5 rounded-full border border-accent-bright/70 bg-bg" aria-hidden="true" />
      <div className="min-w-0 flex-1 p-3.5 pl-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-bold leading-snug">{coupon.title}</p>
          {coupon.kind === "rain" ? <Pill tone="muted">雨の日限定</Pill> : null}
        </div>
        {coupon.conditions ? <p className="mt-1 text-xs text-muted">条件：{coupon.conditions}</p> : null}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {showStore ? <StoreLink id={coupon.store_id} name={coupon.stores?.name} /> : <span />}
          <span className="text-xs text-muted">{coupon.ends_at ? endLabel(coupon.ends_at) : "期限なし"}</span>
        </div>
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

/** タイムセール（テラコッタの貼り紙。左上に判子のような「時間限定」） */
export function TimeSaleCard({ sale, showStore = false }: { sale: TimeSale; showStore?: boolean }) {
  const r = remainLabel(sale.ends_at);
  return (
    <div className="rounded-md border-l-4 border-sale bg-sale-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex -rotate-2 items-center rounded-sm border-2 border-sale px-1.5 py-px font-display text-sm font-bold leading-tight text-sale">
          時間限定
        </span>
        <span className={`inline-flex items-center gap-1 text-sm font-bold ${r.soon ? "text-sale" : "text-muted"}`}>
          <Icon name="clock" className="h-4 w-4" />
          {r.text}
        </span>
      </div>
      <p className="mt-2 text-[17px] font-bold leading-snug">{sale.title}</p>
      {showStore ? (
        <div className="mt-1">
          <StoreLink id={sale.store_id} name={sale.stores?.name} />
        </div>
      ) : null}
    </div>
  );
}

/** 今日だけの限定メニュー（品書きの一行：料理名 ……… 値段） */
export function SpecialCard({ special, showStore = false }: { special: DailySpecial; showStore?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface px-4 py-3">
      <p className="flex items-center gap-1 text-xs font-bold text-accent">
        <Icon name="bowl" className="h-4 w-4" />
        今日だけ
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="font-display text-[17px] font-bold leading-snug">{special.name}</p>
        <span className="leader" aria-hidden="true" />
        <span className="shrink-0 font-display text-[17px] font-bold">{yen(special.price)}</span>
      </div>
      {special.note || showStore ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          {showStore ? <StoreLink id={special.store_id} name={special.stores?.name} /> : <span />}
          {special.note ? <span className="text-xs text-muted">{special.note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
