import { Icon } from "@/components/ui/Icon";
import {
  SEAT_LEVEL_LABEL,
  openLabel,
  seatFreeLabel,
  seatLevel,
  updatedLabel,
  type OpenState,
  type SeatLevel,
  type SeatState,
} from "@/lib/stores/status";

const TONE = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  full: "bg-full-soft text-full",
  sale: "bg-sale-soft text-sale",
  muted: "bg-line/60 text-muted",
} as const;

export function Pill({ tone, children, large = false }: { tone: keyof typeof TONE; children: React.ReactNode; large?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-bold ${large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs leading-5"} ${TONE[tone]}`}>
      {children}
    </span>
  );
}

/** 空席の段階ごとの色（空きあり＝緑／残りわずか＝黄／満席＝テラコッタ／情報なし・時間外＝灰） */
export const LEVEL_TONE: Record<SeatLevel, keyof typeof TONE> = {
  plenty: "ok",
  few: "warn",
  full: "full",
  unknown: "muted",
  closed: "muted",
};
const DOT: Record<SeatLevel, string> = { plenty: "bg-ok", few: "bg-warn", full: "bg-full", unknown: "bg-muted", closed: "bg-muted" };

export function OpenBadge({ state }: { state: OpenState }) {
  const { text, tone } = openLabel(state);
  return <Pill tone={tone}>{text}</Pill>;
}

/** 空席のバッジ（色の点＋文字。満席のときは待ち時間も） */
export function SeatBadge({ state, large = false, hideClosed = true }: { state: SeatState; large?: boolean; hideClosed?: boolean }) {
  const level = seatLevel(state);
  if (level === "closed" && hideClosed) return null;
  const text = state.kind === "full" && state.waitMinutes > 0 ? `満席・待ち約${state.waitMinutes}分` : SEAT_LEVEL_LABEL[level];
  return (
    <Pill tone={LEVEL_TONE[level]} large={large}>
      <span className={`h-2 w-2 rounded-full ${DOT[level]}`} aria-hidden="true" />
      {text}
    </Pill>
  );
}

/** 「3分前に更新」（時計アイコンつき）。古くて表示を止めているときも、最後の更新を出す */
export function UpdatedAt({ state }: { state: SeatState }) {
  const ago = state.kind === "available" || state.kind === "full" ? state.updatedMinutesAgo : state.kind === "unknown" ? state.updatedMinutesAgo : null;
  if (ago === null || ago === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Icon name="clock" className="h-3.5 w-3.5" />
      {updatedLabel(ago)}
    </span>
  );
}

/** 詳細用の空席パネル（席の種類ごと・色分け・最終更新時刻つき） */
export function SeatPanel({ state }: { state: SeatState }) {
  const level = seatLevel(state);
  if (state.kind === "not_open") {
    return (
      <div className="flex items-center justify-between gap-2">
        <SeatBadge state={state} large hideClosed={false} />
        <span className="text-sm text-muted">空席は営業中に表示します</span>
      </div>
    );
  }
  if (state.kind === "unknown") {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <SeatBadge state={state} large />
          <UpdatedAt state={state} />
        </div>
        <p className="text-sm text-muted">しばらく更新がないため、表示を止めています。お店に直接ご確認ください。</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SeatBadge state={state} large />
        <UpdatedAt state={state} />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
        {state.seats.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3 text-[15px]">
            <span>{s.name}</span>
            <span className={`font-bold ${s.free > 0 ? (level === "few" ? "text-warn" : "text-ok") : "text-full"}`}>
              {s.free > 0 ? `空き ${seatFreeLabel(s)}` : "満席"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
