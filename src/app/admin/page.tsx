import type { Metadata } from "next";
import Link from "next/link";
import { Flash, buttonClass, cardClass, inputClass, subButtonClass } from "@/components/ui/Flash";
import { requireAdmin } from "@/lib/admin";
import * as A from "./actions";

export const metadata: Metadata = { title: "運営管理" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { pending: "審査中", approved: "掲載中", suspended: "停止中" };
const KIND_LABEL: Record<string, string> = { title: "称号", frame: "枠", outfit: "衣装" };

type StoreRow = { id: string; name: string; genre: string; status: string; brand: string; store_members: { user_id: string; role: string }[] };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const { db } = await requireAdmin();
  const [stores, areas, settings, ranks, cosmetics] = await Promise.all([
    db.from("stores").select("id,name,genre,status,brand,store_members(user_id,role)").order("created_at").returns<StoreRow[]>(),
    db.from("areas").select("id,name").order("sort").returns<{ id: string; name: string }[]>(),
    db.from("app_settings").select("key,value,note").order("key").returns<{ key: string; value: unknown; note: string | null }[]>(),
    db.from("ranks").select("id,name,animal,min_points,invite_only,point_rate,image_path,sort").order("sort").returns<{ id: string; name: string; animal: string; min_points: number | null; invite_only: boolean; point_rate: number; image_path: string | null; sort: number }[]>(),
    db.from("cosmetics").select("id,kind,name,color,unlock_rank_id,is_active,sort").order("kind").order("sort").returns<{ id: string; kind: string; name: string; color: string | null; unlock_rank_id: string | null; is_active: boolean; sort: number }[]>(),
  ]);

  // 担当者のニックネーム・会員番号（運営は会員情報を読める）
  const ids = [...new Set((stores.data ?? []).flatMap((s) => s.store_members.map((m) => m.user_id)))];
  const { data: people } = ids.length
    ? await db.from("profiles").select("user_id,nickname,member_seq").in("user_id", ids).returns<{ user_id: string; nickname: string; member_seq: number }[]>()
    : { data: [] as { user_id: string; nickname: string; member_seq: number }[] };
  const person = (id: string) => people?.find((p) => p.user_id === id);

  return (
    <main className="min-h-dvh">
      <header className="bg-brand px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <Link href="/mypage" className="text-xs text-on-brand-soft">← マイページ</Link>
          <p className="mt-2 text-[11px] tracking-[0.25em] text-accent-bright">ADMIN</p>
          <h1 className="font-display text-xl font-bold">運営管理</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-4 py-5">
        <Flash msg={msg} />

        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">加盟店</h2>
          {(stores.data ?? []).map((s) => (
            <div key={s.id} className={`${cardClass} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-xs text-muted">{s.genre}・{s.brand.toUpperCase()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "approved" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/store/${s.id}/manage`} className={subButtonClass}>店舗設定を開く</Link>
                {(["approved", "suspended", "pending"] as const).filter((st) => st !== s.status).map((st) => (
                  <form key={st} action={A.setStoreStatus}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="status" value={st} />
                    <button className={subButtonClass}>{st === "approved" ? "掲載する" : st === "suspended" ? "停止する" : "審査中に戻す"}</button>
                  </form>
                ))}
              </div>
              <ul className="space-y-1 border-t border-line pt-2 text-xs">
                {s.store_members.map((m) => {
                  const p = person(m.user_id);
                  return (
                    <li key={m.user_id} className="flex items-center justify-between">
                      <span>{m.role === "store_owner" ? "オーナー" : "スタッフ"}：{p ? `${p.nickname}（会員番号 ${String(p.member_seq).padStart(6, "0")}）` : "未登録の利用者"}</span>
                      <form action={A.removeMember}>
                        <input type="hidden" name="store_id" value={s.id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <button className="text-muted underline">外す</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
              <form action={A.addMember} className="flex gap-2">
                <input type="hidden" name="store_id" value={s.id} />
                <input name="member_seq" type="number" min={1} required placeholder="会員番号" className={inputClass} />
                <select name="role" className={`${inputClass} w-28`}>
                  <option value="store_staff">スタッフ</option>
                  <option value="store_owner">オーナー</option>
                </select>
                <button className={`${buttonClass} shrink-0 px-3`}>追加</button>
              </form>
            </div>
          ))}
          <form action={A.createStore} className={`${cardClass} space-y-2`}>
            <p className="font-bold">加盟店を追加（審査中として作成）</p>
            <input name="name" required placeholder="店名" className={inputClass} />
            <div className="grid grid-cols-3 gap-2">
              <input name="genre" required placeholder="ジャンル" className={inputClass} />
              <select name="area_id" className={inputClass}>
                <option value="">エリア</option>
                {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input name="walk_minutes" type="number" min={0} placeholder="徒歩(分)" className={inputClass} />
            </div>
            <button className={`${buttonClass} w-full`}>作成して店舗設定へ</button>
            <p className="text-[11px] text-muted">実在の店舗は、掲載の許可をいただいてから登録してください。</p>
          </form>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold">ポイントなどの設定値</h2>
          {(settings.data ?? []).map((s) => (
            <form key={s.key} action={A.saveSetting} className={`${cardClass} space-y-1`}>
              <input type="hidden" name="key" value={s.key} />
              <p className="text-xs text-muted">{s.note ?? s.key}</p>
              <div className="flex gap-2">
                <input name="value" defaultValue={String(s.value ?? "")} className={inputClass} />
                <button className={`${buttonClass} shrink-0`}>保存</button>
              </div>
            </form>
          ))}
          <p className="text-[11px] text-muted">初回登録特典のポイントなど景品にあたるものは、景品表示法の上限の確認が済むまで確定しないでください。</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold">ランク</h2>
          {(ranks.data ?? []).map((r) => (
            <form key={r.id} action={A.saveRank} className={`${cardClass} grid grid-cols-2 gap-2 text-xs text-muted`}>
              <input type="hidden" name="id" value={r.id} />
              <label className="space-y-1">名前<input name="name" defaultValue={r.name} className={inputClass} /></label>
              <label className="space-y-1">キャラクター<input name="animal" defaultValue={r.animal} className={inputClass} /></label>
              <label className="space-y-1">必要な累計pt{r.invite_only ? "（招待制）" : ""}<input name="min_points" type="number" defaultValue={r.min_points ?? ""} disabled={r.invite_only} className={inputClass} /></label>
              <label className="space-y-1">ポイント倍率<input name="point_rate" type="number" step="0.01" min={1} max={5} defaultValue={r.point_rate} className={inputClass} /></label>
              <label className="col-span-2 space-y-1">画像のパス<input name="image_path" defaultValue={r.image_path ?? ""} className={inputClass} /></label>
              <button className={`${buttonClass} col-span-2`}>保存</button>
            </form>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold">称号・枠・衣装</h2>
          <ul className={`${cardClass} space-y-1 text-sm`}>
            {(cosmetics.data ?? []).map((c) => (
              <li key={c.id} className={`flex items-center justify-between ${c.is_active ? "" : "text-muted line-through"}`}>
                <span>
                  <span className="mr-1 text-[10px] text-accent">{KIND_LABEL[c.kind]}</span>
                  {c.name}
                  <span className="ml-1 text-[11px] text-muted">{ranks.data?.find((r) => r.id === c.unlock_rank_id)?.name ?? "特典で配布"}</span>
                </span>
                <form action={A.toggleCosmetic}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={c.is_active ? "0" : "1"} />
                  <button className={subButtonClass}>{c.is_active ? "停止" : "公開"}</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={A.addCosmetic} className={`${cardClass} grid grid-cols-2 gap-2 text-xs text-muted`}>
            <label className="space-y-1">種類<select name="kind" className={inputClass}><option value="title">称号</option><option value="frame">枠</option><option value="outfit">衣装</option></select></label>
            <label className="space-y-1">名前<input name="name" required className={inputClass} /></label>
            <label className="space-y-1">解放されるランク
              <select name="unlock_rank_id" className={inputClass}>
                <option value="">特典で配布</option>
                {(ranks.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">枠の色（例 #D2AE58）<input name="color" className={inputClass} /></label>
            <label className="col-span-2 space-y-1">衣装の画像パス（{"{rank}"} がランク番号に置き換わる）<input name="image_path" className={inputClass} /></label>
            <button className={`${buttonClass} col-span-2`}>追加</button>
          </form>
          <p className="text-[11px] text-muted">着せ替えはお金で販売せず、くじ引き（ガチャ）にもしません。画像のアップロード機能は今後追加します。</p>
        </section>
      </div>
    </main>
  );
}
