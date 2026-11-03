"use server";
import { errorMessage, getSession, safeNext } from "@/lib/auth";

export type RegisterState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; points: number; coupons: number; cosmetics: number; next: string };

export async function register(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "ログインの有効期限が切れました。もう一度ログインしてください。" };

  const nickname = String(form.get("nickname") ?? "").trim();
  const monthRaw = String(form.get("birth_month") ?? "");
  const month = monthRaw ? Number(monthRaw) : null;
  const adult = form.get("adult") === "1";
  const agree = form.get("agree") === "1";
  const next = safeNext(String(form.get("next") ?? ""));

  if (nickname.length < 1 || [...nickname].length > 12) return { status: "error", message: "ニックネームは1〜12文字で入力してください。" };
  if (month !== null && !(Number.isInteger(month) && month >= 1 && month <= 12)) return { status: "error", message: "誕生月を選び直してください。" };
  if (!agree) return { status: "error", message: "利用規約とプライバシーポリシーへの同意が必要です。" };

  const { data, error } = await session.supabase.rpc("register_profile", {
    p_nickname: nickname,
    p_birth_month: month,
    p_adult: adult,
    p_agree: agree,
  });
  if (error) return { status: "error", message: errorMessage(error) };

  const r = (data ?? {}) as { status?: string; points?: number; coupons?: number; cosmetics?: number };
  return { status: "done", points: r.points ?? 0, coupons: r.coupons ?? 0, cosmetics: r.cosmetics ?? 0, next };
}
