/**
 * Supabase の接続先。どちらも画面側に置いてよい公開用の値。
 * service_role キーはこのアプリ（画面側）では絶対に使わない。
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
