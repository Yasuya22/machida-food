"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";

/** 運営管理（運営アカウントだけ。DBのRLSでも is_admin() を確認している） */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optInt = (f: FormData, k: string) => {
  const v = str(f, k);
  const n = Number(v);
  return v && Number.isFinite(n) ? n : null;
};

function back(error: { message?: string } | null, ok: string): never {
  revalidatePath("/admin");
  redirect(`/admin?msg=${encodeURIComponent(error ? errorMessage(error) : ok)}`);
}

export async function setStoreStatus(form: FormData) {
  const { db } = await requireAdmin();
  const status = str(form, "status");
  if (!["pending", "approved", "suspended"].includes(status)) back(null, "状態の指定が正しくありません");
  const { error } = await db.from("stores").update({ status }).eq("id", str(form, "id"));
  back(error, "掲載状態を変更しました");
}

export async function createStore(form: FormData) {
  const { db } = await requireAdmin();
  const { data, error } = await db
    .from("stores")
    .insert({
      name: str(form, "name"),
      genre: str(form, "genre"),
      area_id: str(form, "area_id") || null,
      walk_minutes: optInt(form, "walk_minutes"),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) back(error, "");
  revalidatePath("/admin");
  redirect(`/store/${(data as { id: string }).id}/manage?msg=${encodeURIComponent("店舗を作成しました（審査中）。情報を入力してください")}`);
}

/** 会員番号で利用者を探し、店舗のオーナー・スタッフにする */
export async function addMember(form: FormData) {
  const { db } = await requireAdmin();
  const seq = optInt(form, "member_seq");
  const role = str(form, "role") === "store_owner" ? "store_owner" : "store_staff";
  const { data: profile } = await db.from("profiles").select("user_id,nickname").eq("member_seq", seq ?? -1).maybeSingle();
  if (!profile) back(null, "その会員番号の利用者が見つかりません");
  const p = profile as { user_id: string; nickname: string };
  const { error } = await db.from("store_members").upsert({ store_id: str(form, "store_id"), user_id: p.user_id, role }, { onConflict: "store_id,user_id" });
  back(error, `${p.nickname}さんを${role === "store_owner" ? "オーナー" : "スタッフ"}に登録しました`);
}

export async function removeMember(form: FormData) {
  const { db } = await requireAdmin();
  const { error } = await db.from("store_members").delete().eq("store_id", str(form, "store_id")).eq("user_id", str(form, "user_id"));
  back(error, "担当を外しました");
}

export async function saveSetting(form: FormData) {
  const { db } = await requireAdmin();
  const raw = str(form, "value");
  const n = Number(raw);
  const value = raw !== "" && Number.isFinite(n) ? n : raw;
  const { error } = await db.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", str(form, "key"));
  back(error, "設定を保存しました");
}

export async function saveRank(form: FormData) {
  const { db } = await requireAdmin();
  const { error } = await db
    .from("ranks")
    .update({
      name: str(form, "name"),
      animal: str(form, "animal"),
      min_points: optInt(form, "min_points"),
      point_rate: optInt(form, "point_rate") ?? 1,
      image_path: str(form, "image_path") || null,
    })
    .eq("id", str(form, "id"));
  back(error, "ランクを保存しました");
}

export async function addCosmetic(form: FormData) {
  const { db } = await requireAdmin();
  const { error } = await db.from("cosmetics").insert({
    kind: str(form, "kind"),
    name: str(form, "name"),
    color: str(form, "color") || null,
    image_path: str(form, "image_path") || null,
    unlock_rank_id: str(form, "unlock_rank_id") || null,
    sort: optInt(form, "sort") ?? 0,
  });
  back(error, "着せ替えアイテムを追加しました");
}

/** 衣装などの画像を登録した場所を保存する */
export async function saveCosmeticImage(form: FormData) {
  const { db } = await requireAdmin();
  const image = str(form, "image_path");
  if (!image.startsWith("cosmetics/")) back(null, "画像の場所が正しくありません");
  const { error } = await db.from("cosmetics").update({ image_path: image }).eq("id", str(form, "id"));
  back(error, "画像を保存しました");
}

export async function toggleCosmetic(form: FormData) {
  const { db } = await requireAdmin();
  const { error } = await db.from("cosmetics").update({ is_active: str(form, "active") === "1" }).eq("id", str(form, "id"));
  back(error, "着せ替えアイテムの公開を切り替えました");
}
