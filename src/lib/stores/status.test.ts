/**
 * 営業状況・空席の判定のテスト
 * 実行：npm test（node の標準テスト機能を使う。追加の部品は不要）
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  feeLabel,
  isWithin,
  minutesToLabel,
  openLabel,
  openState,
  seatLevel,
  seatState,
  timeToMinutes,
  tokyoNow,
  updatedLabel,
  type SeatType,
  type StoreHours,
} from "./status.ts";

// 2026-11-03（火）を基準にする。日本時間 = UTC + 9時間
const at = (hhmm: string, ymd = "2026-11-03") => new Date(`${ymd}T${hhmm}:00+09:00`);

// 焼肉店（火曜定休）・ラーメン店（昼夜の2部制）
const yakiniku: StoreHours[] = [0, 1, 3, 4, 5, 6].map((d) => ({ weekday: d, opens: "17:00:00", closes: "24:00:00", last_order: "23:00:00" }));
const ramen: StoreHours[] = [0, 1, 2, 3, 4, 5, 6].flatMap((d) => [
  { weekday: d, opens: "11:00:00", closes: "15:00:00", last_order: "14:45:00" },
  { weekday: d, opens: "18:00:00", closes: "22:00:00", last_order: "21:45:00" },
]);

const seats: SeatType[] = [
  { id: "a", name: "カウンター", kind: "counter", unit_size: 1, total: 8, free: 2, sort: 1 },
  { id: "b", name: "テーブル（4名）", kind: "unit", unit_size: 4, total: 6, free: 0, sort: 2 },
];
const fullSeats: SeatType[] = seats.map((s) => ({ ...s, free: 0 }));

test("日本時間の日付・曜日・時刻（UTCとの日付またぎ）", () => {
  const n = tokyoNow(new Date("2026-11-03T15:30:00Z")); // 日本時間 11/4（水）0:30
  assert.equal(n.ymd, "2026-11-04");
  assert.equal(n.weekday, 3);
  assert.equal(n.minutes, 30);
});

test("時刻の変換（24:00 を含む）", () => {
  assert.equal(timeToMinutes("24:00:00"), 1440);
  assert.equal(minutesToLabel(1440), "24:00");
  assert.equal(minutesToLabel(1005), "16:45");
});

test("定休日の曜日は「定休日」", () => {
  const s = openState(yakiniku, [], tokyoNow(at("19:00"))); // 火曜
  assert.deepEqual(s, { kind: "holiday", reason: "regular" });
  assert.equal(openLabel(s).text, "本日は定休日");
});

test("臨時休業日は「臨時休業」", () => {
  const s = openState(ramen, ["2026-11-03"], tokyoNow(at("12:00")));
  assert.deepEqual(s, { kind: "holiday", reason: "temporary" });
});

test("2部制：昼の営業中・中休み・夜のL.O.後・閉店後", () => {
  assert.equal(openState(ramen, [], tokyoNow(at("12:00"))).kind, "open");
  const mid = openState(ramen, [], tokyoNow(at("16:00")));
  assert.deepEqual(mid, { kind: "before_open", opens: 1080 });
  assert.equal(openLabel(mid).text, "準備中・18:00から");
  assert.equal(openState(ramen, [], tokyoNow(at("21:50"))).kind, "after_last_order");
  assert.equal(openState(ramen, [], tokyoNow(at("22:30"))).kind, "closed_for_day");
});

test("L.O.まで60分以内は残り時間を出す", () => {
  const s = openState(yakiniku, [], tokyoNow(at("22:35", "2026-11-04")));
  assert.equal(s.kind, "open");
  assert.equal(openLabel(s).text, "営業中・L.O.まであと25分");
  assert.equal(openLabel(openState(yakiniku, [], tokyoNow(at("19:00", "2026-11-04")))).text, "営業中・L.O. 23:00");
});

test("空席：更新59分前は表示、60分以上前は「情報なし」", () => {
  const now = at("12:00");
  const open = openState(ramen, [], tokyoNow(now));
  const s59 = seatState(seats, { wait_minutes: 0, updated_at: at("11:01").toISOString() }, open, now);
  assert.equal(s59.kind, "available");
  const s60 = seatState(seats, { wait_minutes: 0, updated_at: at("11:00").toISOString() }, open, now);
  assert.deepEqual(s60, { kind: "unknown", updatedMinutesAgo: 60 });
  const s61 = seatState(seats, { wait_minutes: 0, updated_at: at("10:59").toISOString() }, open, now);
  assert.equal(s61.kind, "unknown");
});

test("空席：L.O.後・営業時間外・定休日は空きがあっても「空きあり」にしない", () => {
  const fresh = (now: Date) => ({ wait_minutes: 0, updated_at: new Date(now.getTime() - 5 * 60000).toISOString() });
  for (const [hours, now] of [
    [ramen, at("21:50")], // L.O.後
    [ramen, at("16:00")], // 中休み
    [ramen, at("23:00")], // 閉店後
    [yakiniku, at("19:00")], // 定休日
  ] as const) {
    const s = seatState(seats, fresh(now), openState(hours, [], tokyoNow(now)), now);
    assert.equal(s.kind, "not_open");
  }
});

test("空席：全席埋まっていれば満席と待ち時間", () => {
  const now = at("12:00");
  const s = seatState(fullSeats, { wait_minutes: 20, updated_at: at("11:55").toISOString() }, openState(ramen, [], tokyoNow(now)), now);
  assert.equal(s.kind, "full");
  assert.equal(s.kind === "full" ? s.waitMinutes : -1, 20);
});

test("空席：まだ一度も更新がなければ「情報なし」", () => {
  const now = at("12:00");
  assert.deepEqual(seatState(seats, null, openState(ramen, [], tokyoNow(now)), now), { kind: "unknown", updatedMinutesAgo: null });
});

test("更新時刻の表示", () => {
  assert.equal(updatedLabel(0), "たった今更新");
  assert.equal(updatedLabel(12), "12分前に更新");
  assert.equal(updatedLabel(130), "2時間前に更新");
});

test("期間：開始前・期間中・終了後（期限切れは出さない）", () => {
  const now = at("12:00");
  assert.equal(isWithin(at("13:00").toISOString(), null, now), false);
  assert.equal(isWithin(at("11:00").toISOString(), at("12:30").toISOString(), now), true);
  assert.equal(isWithin(at("11:00").toISOString(), at("12:00").toISOString(), now), false);
  assert.equal(isWithin(at("11:00").toISOString(), null, now), true);
});

test("お通し・席料の表示はすべての種類で明記される", () => {
  assert.equal(feeLabel("none"), "お通し・席料なし");
  assert.equal(feeLabel("included"), "お通し・席料込み");
  assert.equal(feeLabel("separate"), "お通し・席料は別途");
});

test("空席の段階：空きあり・残りわずか・満席・情報なし・営業時間外", () => {
  const now = at("12:00");
  const open = openState(ramen, [], tokyoNow(now));
  const fresh = { wait_minutes: 0, updated_at: at("11:55").toISOString() };
  // 定員 8 + 6卓×4人 = 32人。空き 2 + 3卓×4 = 14人 → 空きあり
  assert.equal(seatLevel(seatState(seats.map((s) => ({ ...s, free: s.id === "b" ? 3 : 2 })), fresh, open, now)), "plenty");
  // 空き 2人だけ → 残りわずか
  assert.equal(seatLevel(seatState(seats, fresh, open, now)), "few");
  assert.equal(seatLevel(seatState(fullSeats, fresh, open, now)), "full");
  assert.equal(seatLevel(seatState(seats, null, open, now)), "unknown");
  assert.equal(seatLevel(seatState(seats, fresh, openState(ramen, [], tokyoNow(at("16:00"))), at("16:00"))), "closed");
});
