import { BRANDS, currentBrand } from "@/config/brand";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/ui/PageHeader";

// 空席などは常に最新を出すため、毎回サーバーで組み立てる
export const dynamic = "force-dynamic";

type StoreRow = { id: string; name: string; genre: string; walk_minutes: number | null; areas: { name: string } | null };

async function loadStores(): Promise<{ status: "ok"; stores: StoreRow[] } | { status: "unconfigured" | "error" }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { status: "unconfigured" };
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, genre, walk_minutes, areas(name)")
    .order("walk_minutes", { ascending: true })
    .returns<StoreRow[]>();
  if (error || !data) return { status: "error" };
  return { status: "ok", stores: data };
}

export default async function HomePage() {
  const brand = BRANDS[currentBrand()];
  const result = await loadStores();

  return (
    <main>
      <section className="bg-brand px-4 pb-8 pt-[calc(env(safe-area-inset-top)+28px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-medium tracking-[0.3em] text-accent-bright">{brand.name}</p>
          <h1 className="mt-2 font-display text-[26px] font-bold leading-snug">{brand.tagline}</h1>
          <p className="mt-2 text-sm text-on-brand-soft">空席・クーポン・スタンプを、ひとつのアプリで。</p>
          <div className="mt-5 h-px w-12 bg-accent-bright" />
        </div>
      </section>

      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <section aria-labelledby="stores-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="stores-heading" className="font-display text-lg font-bold">
              掲載中のお店
            </h2>
            {result.status === "ok" ? <span className="text-xs text-muted">{result.stores.length}店</span> : null}
          </div>

          {result.status === "ok" ? (
            <ul className="space-y-2">
              {result.stores.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">
                      {s.genre}
                      {s.areas ? `・${s.areas.name}` : ""}
                      {s.walk_minutes != null ? `・町田駅から徒歩${s.walk_minutes}分` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">デモ</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
              {result.status === "unconfigured"
                ? "データベースの接続先が未設定です（.env.local を設定してください）。"
                : "お店の情報を読み込めませんでした。時間をおいて開き直してください。"}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted">※ 表示中の店舗はすべてデモ用の架空店舗です。</p>
        </section>

        <ComingSoon step="1. 店舗の検索・詳細で作ります">
          エリア・ジャンル・予算で探す、空席（最終更新時刻つき）、今日の限定メニュー、タイムセール。
        </ComingSoon>
      </div>
    </main>
  );
}
