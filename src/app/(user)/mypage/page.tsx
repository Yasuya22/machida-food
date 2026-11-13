import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { getSession } from "@/lib/auth";
import { loadMember } from "@/lib/member/queries";
import { characterImage } from "@/lib/member/rank";
import { publicImageUrl } from "@/lib/images";
import { equip, rename } from "./actions";

export const metadata: Metadata = { title: "マイページ" };
export const dynamic = "force-dynamic";

const SLOT_LABEL = { title: "称号", frame: "プロフィールの枠", outfit: "衣装" } as const;

export default async function MyPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const session = await getSession();

  if (!session) {
    return (
      <main>
        <PageHeader title="マイページ" lead="会員証、ポイント、あなたの相棒" />
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <div className="rounded-lg border border-line bg-surface p-5 text-center shadow-card">
            <p className="font-display text-lg font-bold">ログインすると使えます</p>
            <p className="mt-1 text-sm text-muted">お店で見せる会員証、来店スタンプ、町田ポイント、ランクごとの相棒キャラクター。</p>
            <Link href="/login?next=/mypage" className="mt-4 block rounded-md bg-brand py-3 text-sm font-bold text-on-brand">
              ログイン・会員登録
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const member = await loadMember(session);
  if (!member) redirect("/register?next=/mypage");

  const [stores, admin] = await Promise.all([
    session.supabase.from("store_members").select("store_id,role,stores(name)").eq("user_id", session.userId).returns<{ store_id: string; role: string; stores: { name: string } | null }[]>(),
    session.supabase.from("admins").select("user_id").eq("user_id", session.userId).maybeSingle(),
  ]);

  const { profile, rank, next, equipped } = member;
  const img = publicImageUrl(characterImage(rank, equipped.outfit));
  const frameColor = equipped.frame?.color ?? "var(--c-accent-bright)";
  const progress = next && rank?.min_points != null && next.rank.min_points != null
    ? Math.min(100, Math.round(((member.earned - rank.min_points) / (next.rank.min_points - rank.min_points)) * 100))
    : 100;

  return (
    <main>
      <section className="bg-brand px-4 pb-6 pt-[calc(env(safe-area-inset-top)+20px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold text-accent-bright">MACHIDA FOOD 会員</p>
            <p className="text-xs text-on-brand-soft">会員番号 {String(profile.member_seq).padStart(6, "0")}</p>
          </div>
          <div className="mt-3 flex flex-col items-center">
            <div className="relative flex h-72 w-full items-end justify-center rounded-lg border-2 bg-on-brand/5" style={{ borderColor: frameColor }}>
              {img ? (
                <Image src={img} alt={`${rank?.name ?? ""}ランクのキャラクター（${rank?.animal ?? ""}）`} width={280} height={340} className="h-[17.5rem] w-auto object-contain" priority unoptimized={img.startsWith("http")} />
              ) : null}
              {equipped.title ? (
                <span className="absolute left-3 top-3 rounded-full bg-accent-bright px-3 py-1 text-xs font-bold text-brand">{equipped.title.name}</span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{profile.nickname}</p>
            <p className="text-sm text-accent-bright">
              {rank ? `${rank.name}ランク・${rank.animal}` : "ランクなし"}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        {msg ? <p className="rounded-md bg-accent-soft p-3 text-sm text-accent">{msg}</p> : null}

        <Link href="/mypage/card" className="flex items-center justify-between rounded-lg bg-accent-bright px-5 py-4 font-bold text-brand shadow-card">
          会員証（QRコード）を表示
          <Icon name="arrow" className="h-5 w-5" />
        </Link>
        <Link href="/install" className="block text-center text-xs text-accent underline">ホーム画面に追加して、アプリとして使う</Link>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">町田ポイント</h2>
            <Link href="/rewards" className="text-xs text-accent underline">履歴</Link>
          </div>
          <p className="mt-1">
            <span className="font-display text-3xl font-bold text-brand">{member.balance.toLocaleString("ja-JP")}</span>
            <span className="ml-1 text-sm text-muted">pt</span>
          </p>
          <p className="text-xs text-muted">累計獲得 {member.earned.toLocaleString("ja-JP")}pt（ランクは累計で決まり、交換しても下がりません）</p>
          {next ? (
            <div className="mt-3">
              <div className="h-3 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent-bright" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {next.rank.name}ランク（{next.rank.animal}）まで あと{next.remaining.toLocaleString("ja-JP")}pt
              </p>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted">町田ポイントは換金・購入はできません。</p>
        </section>

        {/* ---------- ランクと特典（いまのランクを強調） ---------- */}
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">ランクと特典</h2>
          <ul className="space-y-2">
            {member.ranks.map((r) => {
              const current = rank?.id === r.id;
              const reached = !!rank && r.sort <= rank.sort;
              const unlocks = member.cosmetics.filter((c) => c.unlock_rank_id === r.id);
              const pic = publicImageUrl(r.image_path);
              return (
                <li key={r.id} className={`flex gap-3 rounded-lg border p-3 ${current ? "border-accent-bright bg-accent-soft/60 shadow-card" : "border-line/70 bg-surface"} ${reached || current ? "" : "opacity-75"}`}>
                  <div className={`flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-md ${current ? "bg-brand" : "bg-bg"}`}>
                    {pic ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pic} alt="" className={`h-[60px] w-auto object-contain ${reached ? "" : "grayscale"}`} loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold">{r.name}</p>
                      <span className="text-sm text-muted">{r.animal}</span>
                      {current ? <span className="rounded-full bg-accent-bright px-2 py-0.5 text-xs font-bold text-brand">いまのランク</span> : reached ? <span className="text-xs font-bold text-ok">達成</span> : null}
                    </div>
                    <p className="text-sm text-muted">
                      {r.invite_only ? "条件を満たした方へのご招待制" : `累計 ${(r.min_points ?? 0).toLocaleString("ja-JP")}pt から`}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      <li>・来店ポイント {Number(r.point_rate).toFixed(1).replace(/\.0$/, "")}倍</li>
                      {unlocks.length ? <li>・{unlocks.map((c) => c.name).join("・")} が解放</li> : null}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">ランクは累計獲得ポイントで決まり、ポイントを交換しても下がりません。特典の内容は変わることがあります。</p>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">着せ替え</h2>
          {(["title", "frame", "outfit"] as const).map((slot) => {
            const items = member.cosmetics.filter((c) => c.kind === slot);
            const current = equipped[slot]?.id ?? "";
            return (
              <form key={slot} action={equip} className="flex items-end gap-2">
                <input type="hidden" name="slot" value={slot} />
                <label className="flex-1 space-y-1 text-xs text-muted">
                  {SLOT_LABEL[slot]}
                  <select name="cosmetic_id" defaultValue={current} className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink">
                    <option value="">なし</option>
                    {items.map((c) => {
                      const need = member.ranks.find((r) => r.id === c.unlock_rank_id);
                      return (
                        <option key={c.id} value={c.id} disabled={!c.unlocked}>
                          {c.name}
                          {!c.unlocked ? `（${need ? `${need.name}で解放` : "未入手"}）` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <button className="rounded-md border border-brand px-3 py-2.5 text-sm font-bold text-brand">変更</button>
              </form>
            );
          })}
          <p className="text-xs text-muted">着せ替えアイテムはランクや特典で手に入ります（販売・くじ引きはありません）。</p>
        </section>

        {stores.data?.length || admin.data ? (
          <section className="space-y-2 rounded-lg border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-xl font-bold">お店・運営の方</h2>
            {(stores.data ?? []).map((m) => (
              <Link key={m.store_id} href={`/store/${m.store_id}`} className="flex items-center justify-between rounded-md border border-line px-4 py-3 text-sm">
                {m.stores?.name ?? "店舗"}の管理画面
                <span className="text-xs text-muted">{m.role === "store_owner" ? "オーナー" : "スタッフ"}</span>
              </Link>
            ))}
            {admin.data ? (
              <Link href="/admin" className="flex items-center justify-between rounded-md bg-brand px-4 py-3 text-sm font-bold text-on-brand">
                運営管理画面
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-3 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">登録情報</h2>
          <form action={rename} className="flex items-end gap-2">
            <label className="flex-1 space-y-1 text-xs text-muted">
              ニックネーム
              <input name="nickname" defaultValue={profile.nickname} maxLength={12} className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink" />
            </label>
            <button className="rounded-md border border-brand px-3 py-2.5 text-sm font-bold text-brand">変更</button>
          </form>
          <p className="text-xs text-muted">
            誕生月：{profile.birth_month ? `${profile.birth_month}月` : "未登録"}　／　20歳以上の確認：{profile.adult_confirmed_at ? "済み" : "なし"}
          </p>
          {session.email ? <p className="text-xs text-muted">ログイン中：{session.email}</p> : null}
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-md border border-line py-2.5 text-sm text-muted">ログアウト</button>
          </form>
          <Link href="/mypage/delete" className="block text-center text-xs text-muted underline">退会する</Link>
        </section>
      </div>
    </main>
  );
}
