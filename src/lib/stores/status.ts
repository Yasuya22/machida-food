/**
 * 営業状況・空席の判定（画面に依存しない共通部品）
 *
 * - 基準は日本時間（Asia/Tokyo）
 * - 空席は一定時間（app_settings.seat_stale_minutes、既定60分）以上更新がなければ「情報なし」
 * - L.O.後・営業時間外・定休日は「空きあり」にしない
 *
 * お店側の画面（4. 店舗スタッフ画面）でも同じ判定を使う。
 * このファイルは他のファイルを読み込まない（自動テストを単体で動かすため）。
 */

// ---------- 日本時間 ----------

export type TokyoNow = {
  /** 日本時間の日付（YYYY-MM-DD） */
  ymd: string;
  /** 曜日（0=日曜 … 6=土曜。DBの store_hours.weekday と同じ） */
  weekday: number;
  /** 0時からの経過分 */
  minutes: number;
  /** 元の時刻 */
  date: Date;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TOKYO_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function tokyoNow(date: Date = new Date()): TokyoNow {
  const parts = TOKYO_FORMAT.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    date,
  };
}

/** "17:00:00" / "17:00" → 1020。"24:00:00" → 1440 */
export function timeToMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** 1020 → "17:00"、1440 → "24:00" */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

// ---------- 営業状況 ----------

export type StoreHours = { weekday: number; opens: string; closes: string; last_order: string | null };

export type OpenState =
  | { kind: "open"; closes: number; lastOrder: number; minutesToLastOrder: number }
  | { kind: "after_last_order"; closes: number }
  | { kind: "before_open"; opens: number }
  | { kind: "closed_for_day" }
  | { kind: "holiday"; reason: "regular" | "temporary" };

export function openState(hours: StoreHours[], closedDays: string[], now: TokyoNow): OpenState {
  if (closedDays.includes(now.ymd)) return { kind: "holiday", reason: "temporary" };

  const today = hours
    .filter((h) => h.weekday === now.weekday)
    .map((h) => {
      const closes = timeToMinutes(h.closes);
      return { opens: timeToMinutes(h.opens), closes, lastOrder: h.last_order ? timeToMinutes(h.last_order) : closes };
    })
    .sort((a, b) => a.opens - b.opens);

  if (today.length === 0) return { kind: "holiday", reason: "regular" };

  for (const s of today) {
    if (now.minutes >= s.opens && now.minutes < s.closes) {
      if (now.minutes < s.lastOrder) {
        return { kind: "open", closes: s.closes, lastOrder: s.lastOrder, minutesToLastOrder: s.lastOrder - now.minutes };
      }
      return { kind: "after_last_order", closes: s.closes };
    }
  }

  const next = today.find((s) => s.opens > now.minutes);
  if (next) return { kind: "before_open", opens: next.opens };
  return { kind: "closed_for_day" };
}

/** 営業状況の表示文言。tone は色分け用 */
export function openLabel(state: OpenState): { text: string; tone: "ok" | "warn" | "muted" } {
  switch (state.kind) {
    case "open":
      return state.minutesToLastOrder <= 60
        ? { text: `営業中・L.O.まであと${state.minutesToLastOrder}分`, tone: "warn" }
        : { text: `営業中・L.O. ${minutesToLabel(state.lastOrder)}`, tone: "ok" };
    case "after_last_order":
      return { text: `L.O.終了（${minutesToLabel(state.closes)}閉店）`, tone: "muted" };
    case "before_open":
      return { text: `準備中・${minutesToLabel(state.opens)}から`, tone: "muted" };
    case "closed_for_day":
      return { text: "本日の営業は終了", tone: "muted" };
    case "holiday":
      return { text: state.reason === "temporary" ? "本日は臨時休業" : "本日は定休日", tone: "muted" };
  }
}

// ---------- 空席 ----------

export type SeatType = {
  id: string;
  name: string;
  kind: "counter" | "unit";
  unit_size: number;
  total: number;
  free: number;
  sort: number;
};

export type SeatStatus = { wait_minutes: number; updated_at: string } | null;

export type SeatState =
  /** 営業時間外・L.O.後・定休日（「空きあり」にしない） */
  | { kind: "not_open" }
  /** 更新がない・古い（情報なし） */
  | { kind: "unknown"; updatedMinutesAgo: number | null }
  | { kind: "available"; updatedMinutesAgo: number; seats: SeatType[] }
  | { kind: "full"; updatedMinutesAgo: number; waitMinutes: number; seats: SeatType[] };

export const DEFAULT_SEAT_STALE_MINUTES = 60;

export function seatState(
  seatTypes: SeatType[],
  status: SeatStatus,
  open: OpenState,
  now: Date,
  staleMinutes: number = DEFAULT_SEAT_STALE_MINUTES,
): SeatState {
  if (open.kind !== "open") return { kind: "not_open" };
  if (!status || seatTypes.length === 0) return { kind: "unknown", updatedMinutesAgo: null };

  const ago = Math.max(0, Math.floor((now.getTime() - Date.parse(status.updated_at)) / 60000));
  if (ago >= staleMinutes) return { kind: "unknown", updatedMinutesAgo: ago };

  const seats = [...seatTypes].sort((a, b) => a.sort - b.sort);
  if (seats.some((s) => s.free > 0)) return { kind: "available", updatedMinutesAgo: ago, seats };
  return { kind: "full", updatedMinutesAgo: ago, waitMinutes: status.wait_minutes, seats };
}

/** 「3分前に更新」など */
export function updatedLabel(minutesAgo: number): string {
  if (minutesAgo < 1) return "たった今更新";
  if (minutesAgo < 60) return `${minutesAgo}分前に更新`;
  const h = Math.floor(minutesAgo / 60);
  return h < 24 ? `${h}時間前に更新` : `${Math.floor(h / 24)}日前に更新`;
}

/** 席1種類の空き表示（カウンター＝席数、テーブル等＝卓数） */
export function seatFreeLabel(s: SeatType): string {
  return s.kind === "counter" ? `${s.free}席` : `${s.free}卓`;
}

// ---------- 期間・料金 ----------

/** 開始・終了の間か（終了なし＝期限なし）。期限切れは自動で表示しないために使う */
export function isWithin(startsAt: string, endsAt: string | null, now: Date): boolean {
  const t = now.getTime();
  if (Date.parse(startsAt) > t) return false;
  return endsAt === null || Date.parse(endsAt) > t;
}

export type FeePolicy = "none" | "included" | "separate";

/** 予算別プランの「お通し・席料」表示（必ず明記する） */
export function feeLabel(fee: FeePolicy): string {
  switch (fee) {
    case "none":
      return "お通し・席料なし";
    case "included":
      return "お通し・席料込み";
    case "separate":
      return "お通し・席料は別途";
  }
}

export function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}
