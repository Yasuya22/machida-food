"use server";
import { headers } from "next/headers";
import { safeNext } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

/** メールアドレスにログイン用のリンクを送る（パスワードは使わない） */
export async function sendLoginLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "メールアドレスの形式を確認してください。" };

  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "error", message: "データベースの接続先が未設定です。" };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const next = safeNext(String(form.get("next") ?? ""));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) {
    return {
      status: "error",
      message: error.status === 429 ? "送信回数の上限に達しました。しばらく待ってからお試しください。" : "メールを送れませんでした。時間をおいてお試しください。",
    };
  }
  return { status: "sent" };
}
