"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage, requireSession } from "@/lib/auth";

const SLOTS = { title: "equipped_title_id", frame: "equipped_frame_id", outfit: "equipped_outfit_id" } as const;

/** 称号・枠・衣装を付け替える（持っていない物はDBのトリガーが拒否する） */
export async function equip(form: FormData) {
  const s = await requireSession("/mypage");
  const slot = String(form.get("slot")) as keyof typeof SLOTS;
  if (!(slot in SLOTS)) return;
  const id = String(form.get("cosmetic_id") ?? "");
  const { error } = await s.supabase
    .from("profiles")
    .update({ [SLOTS[slot]]: id || null })
    .eq("user_id", s.userId);
  if (error) redirect(`/mypage?msg=${encodeURIComponent(errorMessage(error))}`);
  revalidatePath("/mypage");
  redirect("/mypage?msg=" + encodeURIComponent("付け替えました"));
}

/** ニックネームの変更 */
export async function rename(form: FormData) {
  const s = await requireSession("/mypage");
  const nickname = String(form.get("nickname") ?? "").trim();
  if (nickname.length < 1 || [...nickname].length > 12) redirect("/mypage?msg=" + encodeURIComponent("ニックネームは1〜12文字です"));
  const { error } = await s.supabase.from("profiles").update({ nickname }).eq("user_id", s.userId);
  if (error) redirect(`/mypage?msg=${encodeURIComponent(errorMessage(error))}`);
  revalidatePath("/mypage");
  redirect("/mypage?msg=" + encodeURIComponent("ニックネームを変更しました"));
}
