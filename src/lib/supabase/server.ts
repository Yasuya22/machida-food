import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * サーバー（Server Component・Server Action）用の Supabase クライアント。
 * ログイン中の人の権限で動くので、RLS がそのまま効く。
 * 接続先が未設定のときは null を返す（画面は「準備中」を表示する）。
 */
export async function createSupabaseServer() {
  const env = supabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component からは書き込めない。ログイン状態の更新は middleware で行う（「2. ログイン」で追加）
        }
      },
    },
  });
}
