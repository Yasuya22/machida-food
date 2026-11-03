"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** ブラウザ用の Supabase クライアント（会員証QRの更新など、画面で動く処理に使う） */
export function createSupabaseBrowser() {
  const env = supabaseEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.key);
}
