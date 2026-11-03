"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/auth";
import { requireStoreAccess } from "@/lib/store/access";

/** 処理後に元の画面へ戻し、結果の一言を出す */
function back(path: string, msg: string): never {
  revalidatePath(path);
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const n = Number(f.get(k));
  return Number.isInteger(n) ? n : NaN;
};
/** <input type="datetime-local"> の値を日本時間として扱う */
const tokyoDateTime = (v: string) => (v ? new Date(`${v}:00+09:00`).toISOString() : null);

// ---------- 来店処理（会員証の読み取り） ----------

export type RedeemResult = { ok: boolean; title: string; lines: string[] };

const TOKEN = /^[0-9a-f]{32}$/;

export async function redeem(storeId: string, token: string, couponId: string | null): Promise<RedeemResult> {
  const { session, canRedeem } = await requireStoreAccess(storeId);
  if (!canRedeem) return { ok: false, title: "この操作はできません", lines: ["来店処理はお店のオーナー・スタッフのアカウントで行ってください。"] };
  const t = token.trim().toLowerCase();
  if (!TOKEN.test(t)) return { ok: false, title: "会員証を読み取れません", lines: ["MACHIDA FOOD の会員証QRか確認してください。"] };

  if (couponId) {
    const { data, error } = await session.supabase.rpc("redeem_coupon", { p_token: t, p_coupon: couponId });
    if (error) return { ok: false, title: "クーポンを使えません", lines: [errorMessage(error)] };
    const r = data as { title: string; points: number };
    revalidatePath(`/store/${storeId}/logs`);
    return { ok: true, title: "クーポンを使用済みにしました", lines: [`「${r.title}」`, `お客様に ${r.points}pt を付けました`] };
  }

  const { data, error } = await session.supabase.rpc("redeem_visit", { p_token: t, p_store: storeId });
  if (error) return { ok: false, title: "スタンプを付けられません", lines: [errorMessage(error)] };
  const r = data as { status: string; points?: number; first_visit?: boolean; hop_bonus?: boolean; stamp_count?: number; reward_issued?: boolean };
  revalidatePath(`/store/${storeId}/logs`);
  if (r.status === "already_stamped_today") {
    return { ok: false, title: "本日はスタンプ済みです", lines: ["来店スタンプは1店舗につき1日1回です。"] };
  }
  const lines = [`お客様に ${r.points ?? 0}pt を付けました`];
  if (r.first_visit) lines.push("初めてのご来店です");
  if (r.hop_bonus) lines.push("はしごボーナス対象");
  if (r.reward_issued) lines.push("スタンプがたまり、特典を発行しました");
  return { ok: true, title: "来店スタンプを付けました", lines };
}

// ---------- 空席 ----------

export async function updateSeats(form: FormData) {
  const storeId = str(form, "store_id");
  const { session } = await requireStoreAccess(storeId);
  const free: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("seat_")) free[k.slice(5)] = Number(v);
  }
  const wait = int(form, "wait");
  const { error } = await session.supabase.rpc("update_seats", { p_store: storeId, p_free: free, p_wait: Number.isNaN(wait) ? 0 : wait });
  back(`/store/${storeId}`, error ? errorMessage(error) : "空席を更新しました");
}

// ---------- 今日の限定メニュー ----------

export async function addSpecial(form: FormData) {
  const storeId = str(form, "store_id");
  const { session } = await requireStoreAccess(storeId);
  const name = str(form, "name");
  const price = int(form, "price");
  if (!name || Number.isNaN(price) || price < 0) back(`/store/${storeId}/deals`, "名前と価格（税込み）を入力してください");
  const { error } = await session.supabase.from("daily_specials").insert({
    store_id: storeId,
    name,
    price,
    note: str(form, "note") || null,
    ...(str(form, "date") ? { special_date: str(form, "date") } : {}),
  });
  back(`/store/${storeId}/deals`, error ? errorMessage(error) : "限定メニューを登録しました");
}

export async function deleteSpecial(form: FormData) {
  const storeId = str(form, "store_id");
  const { session } = await requireStoreAccess(storeId);
  const { error } = await session.supabase.from("daily_specials").delete().eq("id", str(form, "id")).eq("store_id", storeId);
  back(`/store/${storeId}/deals`, error ? errorMessage(error) : "限定メニューを取り消しました");
}

// ---------- タイムセール ----------

export async function addTimeSale(form: FormData) {
  const storeId = str(form, "store_id");
  const { session } = await requireStoreAccess(storeId);
  const title = str(form, "title");
  const starts = tokyoDateTime(str(form, "starts_at"));
  const ends = tokyoDateTime(str(form, "ends_at"));
  if (!title || !starts || !ends || ends <= starts) back(`/store/${storeId}/deals`, "内容と、開始・終了の日時（終了は開始より後）を入力してください");
  const { error } = await session.supabase.from("time_sales").insert({ store_id: storeId, title, starts_at: starts, ends_at: ends });
  back(`/store/${storeId}/deals`, error ? errorMessage(error) : "タイムセールを登録しました");
}

/** 今すぐ終了（記録は残す） */
export async function endTimeSale(form: FormData) {
  const storeId = str(form, "store_id");
  const { session } = await requireStoreAccess(storeId);
  const id = str(form, "id");
  const now = new Date();
  const { data } = await session.supabase.from("time_sales").select("starts_at").eq("id", id).eq("store_id", storeId).maybeSingle();
  const starts = (data as { starts_at: string } | null)?.starts_at;
  // 開始前のものは取り消し、開始後のものは終了時刻を今にする
  const { error } =
    starts && Date.parse(starts) > now.getTime()
      ? await session.supabase.from("time_sales").delete().eq("id", id).eq("store_id", storeId)
      : await session.supabase.from("time_sales").update({ ends_at: now.toISOString() }).eq("id", id).eq("store_id", storeId);
  back(`/store/${storeId}/deals`, error ? errorMessage(error) : "タイムセールを終了しました");
}
