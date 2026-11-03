import { openLabel, seatFreeLabel, updatedLabel, type OpenState, type SeatState } from "@/lib/stores/status";

const TONE = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  full: "bg-full-soft text-full",
  muted: "bg-line/60 text-muted",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-5 ${TONE[tone]}`}>{children}</span>;
}

export function OpenBadge({ state }: { state: OpenState }) {
  const { text, tone } = openLabel(state);
  return <Pill tone={tone}>{text}</Pill>;
}

/** 一覧用の空席バッジ（短い表示） */
export function SeatBadge({ state }: { state: SeatState }) {
  switch (state.kind) {
    case "available":
      return <Pill tone="ok">空きあり</Pill>;
    case "full":
      return <Pill tone="full">{state.waitMinutes > 0 ? `満席・待ち約${state.waitMinutes}分` : "満席"}</Pill>;
    case "unknown":
      return <Pill tone="muted">空席情報なし</Pill>;
    case "not_open":
      return null;
  }
}

/** 詳細用の空席パネル（席の種類ごと・最終更新時刻つき） */
export function SeatPanel({ state }: { state: SeatState }) {
  if (state.kind === "not_open") {
    return <p className="text-sm text-muted">営業時間外のため、空席情報は表示していません。</p>;
  }
  if (state.kind === "unknown") {
    return (
      <p className="text-sm text-muted">
        空席情報なし
        {state.updatedMinutesAgo !== null ? <span className="ml-1 text-xs">（最終更新：{updatedLabel(state.updatedMinutesAgo)}）</span> : null}
        <span className="mt-1 block text-xs">しばらく更新がないため、表示を止めています。</span>
      </p>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SeatBadge state={state} />
        <span className="text-xs text-muted">{updatedLabel(state.updatedMinutesAgo)}</span>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {state.seats.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{s.name}</span>
            <span className={s.free > 0 ? "font-bold text-ok" : "text-muted"}>{s.free > 0 ? `空き ${seatFreeLabel(s)}` : "満席"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
