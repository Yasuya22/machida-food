import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/origin";

/** ログアウト（フォームの POST で呼ぶ） */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/", requestOrigin(request)), { status: 303 });
}
