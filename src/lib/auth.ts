import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type Session = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServer>>>;
  userId: string;
  email: string | null;
};

/** ログイン中なら Supabase クライアントと利用者IDを返す。未ログイン・未設定なら null */
export async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id, email: data.user.email ?? null };
}

/** ログインが必要な画面・処理で使う。未ログインならログイン画面へ */
export async function requireSession(next: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}

/** 戻り先は同じサイト内のパスだけ許す（外部への転送を防ぐ） */
export function safeNext(next: string | null | undefined, fallback = "/mypage"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** DBの関数が返すエラーを日本語に */
const MESSAGES: Record<string, string> = {
  not_signed_in: "ログインしてください。",
  not_registered: "会員登録を済ませてください。",
  terms_not_agreed: "利用規約とプライバシーポリシーへの同意が必要です。",
  not_store_member: "このお店の操作権限がありません。",
  store_not_active: "このお店は現在掲載されていません。",
  invalid_or_expired_token: "会員証の有効期限が切れています。お客様に画面を更新してもらい、もう一度読み取ってください。",
  coupon_not_found: "クーポンが見つかりません。",
  coupon_not_available: "このクーポンは現在使えません（期間外または停止中）。",
  coupon_not_granted: "このお客様はこのクーポンを持っていません。",
  coupon_sold_out: "このクーポンは上限枚数に達しました。",
  coupon_already_used: "このお客様はこのクーポンを使用済みです。",
  seat_type_mismatch: "席の情報が一致しません。画面を開き直してください。",
  cosmetic_not_owned: "まだ解放されていないアイテムです。",
  cosmetic_wrong_slot: "装備する場所が違います。",
  only_admin_can_change_status: "掲載状態は運営だけが変更できます。",
};

export function errorMessage(err: { message?: string } | null | undefined): string {
  const key = err?.message ?? "";
  for (const [k, v] of Object.entries(MESSAGES)) if (key.includes(k)) return v;
  if (key.includes("row-level security") || key.includes("permission denied")) return "この操作の権限がありません。";
  return "うまく処理できませんでした。時間をおいてもう一度お試しください。";
}
