"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/auth";
import { requireStoreAccess } from "@/lib/store/access";

/**
 * 店舗設定（オーナー・運営）。権限はDBのRLSでも確認している（オーナーは自店だけ、掲載状態は変更不可）。
 */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const optInt = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const list = (f: FormData, k: string) =>
  str(f, k)
    .split(/[,、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

async function ctx(form: FormData) {
  const storeId = str(form, "store_id");
  const access = await requireStoreAccess(storeId);
  const path = `/store/${storeId}/manage`;
  if (!access.canManage) redirect(`/store/${storeId}`);
  return { db: access.session.supabase, storeId, path };
}

function back(path: string, error: { message?: string } | null, ok: string): never {
  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(error ? errorMessage(error) : ok)}`);
}

export async function saveStoreInfo(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db
    .from("stores")
    .update({
      name: str(form, "name"),
      genre: str(form, "genre"),
      area_id: optStr(form, "area_id"),
      description: optStr(form, "description"),
      address: optStr(form, "address"),
      walk_minutes: optInt(form, "walk_minutes"),
      price_min: optInt(form, "price_min"),
      price_max: optInt(form, "price_max"),
      max_party: optInt(form, "max_party") ?? 4,
      payment_methods: list(form, "payment_methods"),
      features: list(form, "features"),
      parking: optStr(form, "parking"),
      holiday_note: optStr(form, "holiday_note"),
      stamp_goal: optInt(form, "stamp_goal") ?? 10,
      stamp_reward: optStr(form, "stamp_reward"),
    })
    .eq("id", storeId);
  back(path, error, "店舗情報を保存しました");
}

// ---------- 営業時間・臨時休業 ----------

export async function addHours(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("store_hours").insert({
    store_id: storeId,
    weekday: optInt(form, "weekday"),
    opens: str(form, "opens"),
    closes: str(form, "closes"),
    last_order: optStr(form, "last_order"),
  });
  back(path, error, "営業時間を追加しました");
}

export async function deleteHours(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("store_hours").delete().eq("id", str(form, "id")).eq("store_id", storeId);
  back(path, error, "営業時間を削除しました");
}

export async function addClosedDay(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("store_closed_days").insert({ store_id: storeId, day: str(form, "day"), note: optStr(form, "note") });
  back(path, error, "臨時休業日を追加しました");
}

export async function deleteClosedDay(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("store_closed_days").delete().eq("store_id", storeId).eq("day", str(form, "day"));
  back(path, error, "臨時休業日を取り消しました");
}

// ---------- メニュー ----------

export async function addMenu(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("menu_items").insert({ store_id: storeId, name: str(form, "name"), price: optInt(form, "price"), sort: optInt(form, "sort") ?? 0 });
  back(path, error, "メニューを追加しました");
}

export async function toggleMenu(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("menu_items").update({ is_active: str(form, "active") === "1" }).eq("id", str(form, "id")).eq("store_id", storeId);
  back(path, error, "メニューの表示を切り替えました");
}

// ---------- 予算別プラン ----------

export async function addPlan(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("budget_plans").insert({
    store_id: storeId,
    price: optInt(form, "price"),
    dishes: optInt(form, "dishes") ?? 0,
    drinks: optInt(form, "drinks") ?? 0,
    note: optStr(form, "note"),
    fee: str(form, "fee"),
    sort: optInt(form, "sort") ?? 0,
  });
  back(path, error, "予算別プランを追加しました");
}

export async function togglePlan(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("budget_plans").update({ is_active: str(form, "active") === "1" }).eq("id", str(form, "id")).eq("store_id", storeId);
  back(path, error, "プランの表示を切り替えました");
}

// ---------- クーポン ----------

export async function addCoupon(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const ends = str(form, "ends_at");
  const { error } = await db.from("coupons").insert({
    store_id: storeId,
    title: str(form, "title"),
    conditions: optStr(form, "conditions"),
    kind: str(form, "kind") || "normal",
    ends_at: ends ? new Date(`${ends}T23:59:59+09:00`).toISOString() : null,
    total_limit: optInt(form, "total_limit"),
  });
  back(path, error, "クーポンを追加しました");
}

export async function toggleCoupon(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("coupons").update({ is_active: str(form, "active") === "1" }).eq("id", str(form, "id")).eq("store_id", storeId);
  back(path, error, "クーポンの公開を切り替えました");
}

// ---------- 席の種類 ----------

export async function addSeatType(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("seat_types").insert({
    store_id: storeId,
    name: str(form, "name"),
    kind: str(form, "kind") === "counter" ? "counter" : "unit",
    unit_size: optInt(form, "unit_size") ?? 1,
    total: optInt(form, "total") ?? 0,
    free: 0,
    sort: optInt(form, "sort") ?? 0,
  });
  back(path, error, "席の種類を追加しました");
}

export async function deleteSeatType(form: FormData) {
  const { db, storeId, path } = await ctx(form);
  const { error } = await db.from("seat_types").delete().eq("id", str(form, "id")).eq("store_id", storeId);
  back(path, error, "席の種類を削除しました");
}
