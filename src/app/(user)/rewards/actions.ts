"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage, requireSession } from "@/lib/auth";

/** 町田ポイントを交換品と交換する（残高・在庫・1人1回はDBの関数が確認する） */
export async function exchange(form: FormData) {
  const s = await requireSession("/rewards");
  const { data, error } = await s.supabase.rpc("exchange_points", { p_item: String(form.get("item_id") ?? "") });
  revalidatePath("/rewards");
  if (error) redirect("/rewards?msg=" + encodeURIComponent(errorMessage(error)) + "#exchange");
  const r = data as { title: string; points: number };
  redirect("/rewards?msg=" + encodeURIComponent(`「${r.title}」と交換しました（-${r.points}pt）。「もらった特典」に追加されています`) + "#exchange");
}
