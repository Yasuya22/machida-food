import "server-only";
import { currentBrand } from "@/config/brand";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_SEAT_STALE_MINUTES,
  isWithin,
  openState,
  seatState,
  tokyoNow,
  type FeePolicy,
  type OpenState,
  type SeatState,
  type SeatStatus,
  type SeatType,
  type StoreHours,
} from "./status";

/**
 * 店舗まわりのデータ読み込み（サーバー側）。
 * 閲覧する人の権限で読むので、RLS により掲載中の店舗だけが返る。
 */

// ---------- 型 ----------

type StoreRow = {
  id: string;
  name: string;
  genre: string;
  description: string | null;
  address: string | null;
  walk_minutes: number | null;
  price_min: number | null;
  price_max: number | null;
  max_party: number;
  payment_methods: string[];
  features: string[];
  parking: string | null;
  holiday_note: string | null;
  stamp_goal: number;
  stamp_reward: string | null;
  area_id: string | null;
  areas: { name: string } | null;
  store_hours: StoreHours[];
  store_closed_days: { day: string }[];
  seat_types: SeatType[];
  store_seat_status: SeatStatus | SeatStatus[];
};

export type StoreView = Omit<StoreRow, "store_seat_status" | "store_closed_days" | "areas"> & {
  areaName: string | null;
  open: OpenState;
  seats: SeatState;
};

export type MenuItem = { id: string; name: string; price: number };
export type BudgetPlan = { id: string; price: number; dishes: number; drinks: number; note: string | null; fee: FeePolicy };
export type DailySpecial = { id: string; store_id: string; name: string; price: number; note: string | null; stores?: { name: string } | null };
export type TimeSale = { id: string; store_id: string; title: string; starts_at: string; ends_at: string; stores?: { name: string } | null };
export type Coupon = {
  id: string;
  store_id: string;
  title: string;
  conditions: string | null;
  kind: "normal" | "rain" | "welcome" | "exchange";
  starts_at: string;
  ends_at: string | null;
  stores?: { name: string } | null;
};

export type SearchFilters = {
  area?: string;
  genre?: string;
  budget?: number;
  party?: number;
  features: string[];
  availableNow: boolean;
};

export type LoadResult<T> = { status: "ok"; data: T } | { status: "unconfigured" } | { status: "error" };

const STORE_SELECT = [
  "id,name,genre,description,address,walk_minutes,price_min,price_max,max_party",
  "payment_methods,features,parking,holiday_note,stamp_goal,stamp_reward,area_id",
  "areas(name)",
  "store_hours(weekday,opens,closes,last_order)",
  "store_closed_days(day)",
  "seat_types(id,name,kind,unit_size,total,free,sort)",
  "store_seat_status(wait_minutes,updated_at)",
].join(",");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServer>>>;

// ---------- 共通 ----------

async function staleMinutes(supabase: Supabase): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "seat_stale_minutes").maybeSingle();
  const n = Number((data as { value: unknown } | null)?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SEAT_STALE_MINUTES;
}

function toView(row: StoreRow, now: Date, stale: number): StoreView {
  const { store_seat_status, store_closed_days, areas, ...rest } = row;
  const status = Array.isArray(store_seat_status) ? (store_seat_status[0] ?? null) : store_seat_status;
  const open = openState(row.store_hours, store_closed_days.map((d) => d.day), tokyoNow(now));
  return { ...rest, areaName: areas?.name ?? null, open, seats: seatState(row.seat_types, status, open, now, stale) };
}

// ---------- 店舗一覧・検索 ----------

export async function loadStores(filters?: SearchFilters): Promise<LoadResult<StoreView[]>> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "unconfigured" };

  let query = supabase.from("stores").select(STORE_SELECT).eq("brand", currentBrand());
  if (filters?.area && UUID.test(filters.area)) query = query.eq("area_id", filters.area);
  if (filters?.genre) query = query.eq("genre", filters.genre);
  if (filters?.party) query = query.gte("max_party", filters.party);
  if (filters?.budget) query = query.lte("price_min", filters.budget);
  if (filters?.features.length) query = query.contains("features", filters.features);

  const [{ data, error }, stale] = await Promise.all([
    query.order("walk_minutes", { ascending: true, nullsFirst: false }).returns<StoreRow[]>(),
    staleMinutes(supabase),
  ]);
  if (error || !data) return { status: "error" };

  const now = new Date();
  let stores = data.map((row) => toView(row, now, stale));
  if (filters?.availableNow) stores = stores.filter((s) => s.seats.kind === "available");
  return { status: "ok", data: stores };
}

/** 探す画面の選択肢（エリア・ジャンル・こだわり条件）。すべてデータから作る */
export async function loadSearchOptions(): Promise<{ areas: { id: string; name: string }[]; genres: string[]; features: string[] }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { areas: [], genres: [], features: [] };
  const [areas, stores] = await Promise.all([
    supabase.from("areas").select("id,name").order("sort").returns<{ id: string; name: string }[]>(),
    supabase.from("stores").select("genre,features").eq("brand", currentBrand()).returns<{ genre: string; features: string[] }[]>(),
  ]);
  const rows = stores.data ?? [];
  const genres = [...new Set(rows.map((r) => r.genre))].sort((a, b) => a.localeCompare(b, "ja"));
  const count = new Map<string, number>();
  for (const r of rows) for (const f of r.features) count.set(f, (count.get(f) ?? 0) + 1);
  const features = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")).map(([f]) => f);
  return { areas: areas.data ?? [], genres, features };
}

// ---------- 店舗詳細 ----------

export type StoreDetail = {
  store: StoreView;
  menu: MenuItem[];
  plans: BudgetPlan[];
  specials: DailySpecial[];
  timeSales: TimeSale[];
  coupons: Coupon[];
};

export async function loadStoreDetail(id: string): Promise<LoadResult<StoreDetail | null>> {
  if (!UUID.test(id)) return { status: "ok", data: null };
  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "unconfigured" };

  const now = new Date();
  const today = tokyoNow(now).ymd;
  const [store, menu, plans, specials, sales, coupons, stale] = await Promise.all([
    supabase.from("stores").select(STORE_SELECT).eq("id", id).eq("brand", currentBrand()).limit(1).returns<StoreRow[]>(),
    supabase.from("menu_items").select("id,name,price").eq("store_id", id).eq("is_active", true).order("sort").returns<MenuItem[]>(),
    supabase.from("budget_plans").select("id,price,dishes,drinks,note,fee").eq("store_id", id).eq("is_active", true).order("sort").returns<BudgetPlan[]>(),
    supabase.from("daily_specials").select("id,store_id,name,price,note").eq("store_id", id).eq("special_date", today).returns<DailySpecial[]>(),
    supabase.from("time_sales").select("id,store_id,title,starts_at,ends_at").eq("store_id", id).gt("ends_at", now.toISOString()).order("starts_at").returns<TimeSale[]>(),
    supabase.from("coupons").select("id,store_id,title,conditions,kind,starts_at,ends_at").eq("store_id", id).eq("is_active", true).in("kind", ["normal", "rain"]).returns<Coupon[]>(),
    staleMinutes(supabase),
  ]);
  if (store.error) return { status: "error" };
  const row = store.data?.[0];
  if (!row) return { status: "ok", data: null };

  return {
    status: "ok",
    data: {
      store: toView(row, now, stale),
      menu: menu.data ?? [],
      plans: plans.data ?? [],
      specials: specials.data ?? [],
      timeSales: (sales.data ?? []).filter((s) => isWithin(s.starts_at, s.ends_at, now)),
      coupons: (coupons.data ?? []).filter((c) => isWithin(c.starts_at, c.ends_at, now)),
    },
  };
}

// ---------- お得（全店） ----------

export type Deals = { coupons: Coupon[]; timeSales: TimeSale[]; specials: DailySpecial[] };

export async function loadDeals(): Promise<LoadResult<Deals>> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "unconfigured" };
  const now = new Date();
  const today = tokyoNow(now).ymd;
  // stores!inner で掲載中の店舗のものだけに絞る（RLS で見えない店舗の行は出ない）
  const [coupons, sales, specials] = await Promise.all([
    supabase
      .from("coupons")
      .select("id,store_id,title,conditions,kind,starts_at,ends_at,stores!inner(name,brand)")
      .eq("is_active", true)
      .in("kind", ["normal", "rain"])
      .eq("stores.brand", currentBrand())
      .returns<Coupon[]>(),
    supabase
      .from("time_sales")
      .select("id,store_id,title,starts_at,ends_at,stores!inner(name,brand)")
      .gt("ends_at", now.toISOString())
      .eq("stores.brand", currentBrand())
      .order("ends_at")
      .returns<TimeSale[]>(),
    supabase
      .from("daily_specials")
      .select("id,store_id,name,price,note,stores!inner(name,brand)")
      .eq("special_date", today)
      .eq("stores.brand", currentBrand())
      .returns<DailySpecial[]>(),
  ]);
  if (coupons.error || sales.error || specials.error) return { status: "error" };
  return {
    status: "ok",
    data: {
      coupons: (coupons.data ?? []).filter((c) => isWithin(c.starts_at, c.ends_at, now)),
      timeSales: (sales.data ?? []).filter((s) => isWithin(s.starts_at, s.ends_at, now)),
      specials: specials.data ?? [],
    },
  };
}
