"use server";
import { redirect } from "next/navigation";
import { errorMessage, requireSession } from "@/lib/auth";

/** 退会（アカウントと会員データの削除）。DBの関数が本人確認と削除を行う */
export async function deleteAccount(form: FormData) {
  const s = await requireSession("/mypage/delete");
  if (form.get("confirm") !== "1") redirect("/mypage/delete?msg=" + encodeURIComponent("確認のチェックを入れてください"));
  const { error } = await s.supabase.rpc("delete_my_account");
  if (error) redirect("/mypage/delete?msg=" + encodeURIComponent(errorMessage(error)));
  await s.supabase.auth.signOut();
  redirect("/?deleted=1");
}
