import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";

/** 運営アカウントだけが入れる。そうでなければ「ページが見つかりません」にする */
export async function requireAdmin() {
  const session = await requireSession("/admin");
  const { data } = await session.supabase.from("admins").select("user_id").eq("user_id", session.userId).maybeSingle();
  if (!data) notFound();
  return { session, db: session.supabase };
}
