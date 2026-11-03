import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { requestOrigin } from "@/lib/origin";
import { createSupabaseServer } from "@/lib/supabase/server";

/** メールのリンクから戻ってきたときにログインを完了させる */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createSupabaseServer();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 会員登録がまだなら登録画面へ
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("user_id").eq("user_id", user.user?.id ?? "").maybeSingle();
      return NextResponse.redirect(new URL(profile ? next : `/register?next=${encodeURIComponent(next)}`, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=1", origin));
}
