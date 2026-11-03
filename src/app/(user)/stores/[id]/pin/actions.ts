"use server";
import { errorMessage, getSession } from "@/lib/auth";

export type PinState = { status: "idle" } | { status: "ok"; lines: string[] } | { status: "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** スタッフがお客様のスマホで店舗PINを入力して、来店スタンプを付ける */
export async function stampByPin(_prev: PinState, form: FormData): Promise<PinState> {
  const s = await getSession();
  if (!s) return { status: "error", message: "ログインの有効期限が切れました。もう一度ログインしてください。" };
  const storeId = String(form.get("store_id") ?? "");
  const pin = String(form.get("pin") ?? "").trim();
  if (!UUID.test(storeId)) return { status: "error", message: "お店の情報が正しくありません。" };
  if (!/^[0-9]{4}$/.test(pin)) return { status: "error", message: "4桁の数字を入力してください。" };

  const { data, error } = await s.supabase.rpc("redeem_visit_by_pin", { p_store: storeId, p_pin: pin });
  if (error) return { status: "error", message: errorMessage(error) };
  const r = data as { status: string; remaining?: number; points?: number; first_visit?: boolean; hop_bonus?: boolean; reward_issued?: boolean };
  if (r.status === "wrong_pin") return { status: "error", message: `PINが違います（本日あと${r.remaining ?? 0}回まで）` };
  if (r.status === "already_stamped_today") return { status: "error", message: "本日はこのお店のスタンプを受け取り済みです（1店舗1日1回）。" };
  const lines = [`${r.points ?? 0}pt を受け取りました`];
  if (r.first_visit) lines.push("初めてのご来店です");
  if (r.hop_bonus) lines.push("はしごボーナス");
  if (r.reward_issued) lines.push("スタンプがたまり、特典を受け取りました");
  return { status: "ok", lines };
}
