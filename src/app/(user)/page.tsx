import Link from "next/link";
import { BRANDS, currentBrand } from "@/config/brand";
import { Icon } from "@/components/ui/Icon";
import { LoadError } from "@/components/ui/Section";
import { StoreCard, StorePhotoCard } from "@/components/store/StoreCard";
import { CouponCard, SpecialCard, TimeSaleCard } from "@/components/store/DealCards";
import { loadDeals, loadStores } from "@/lib/stores/queries";
import { seatLevel } from "@/lib/stores/status";

// 空席などは常に最新を出すため、毎回サーバーで組み立てる
export const dynamic = "force-dynamic";

/** 見出し＋「もっと見る」 */
function Heading({ title, href, more = "もっと見る" }: { title: string; href?: string; more?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between px-4">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex min-h-10 items-center gap-0.5 text-sm text-muted">
          {more}
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * ホーム。優先順位：①今すぐ入れるお店（写真大）②本日のお得情報（テラコッタ）③おすすめ店舗
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const brand = BRANDS[currentBrand()];
  const [stores, deals] = await Promise.all([loadStores(), loadDeals()]);

  const all = stores.status === "ok" ? stores.data : [];
  // 空きあり → 残りわずか の順（どちらも「今すぐ入れる」）
  const rank = { plenty: 0, few: 1, full: 2, unknown: 3, closed: 4 } as const;
  const availableNow = all.filter((s) => s.seats.kind === "available").sort((a, b) => rank[seatLevel(a.seats)] - rank[seatLevel(b.seats)]);
  const others = all.filter((s) => s.seats.kind !== "available");
  const d = deals.status === "ok" ? deals.data : null;
  const dealCount = d ? d.timeSales.length + d.specials.length + Math.min(d.coupons.length, 1) : 0;

  return (
    <main>
      {/* ---------- ヒーロー：検索と、いちばん使う「今すぐ入れるお店」 ---------- */}
      <section className="bg-brand px-4 pb-6 pt-[calc(env(safe-area-inset-top)+24px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-bold tracking-[0.3em] text-accent-bright">{brand.name}</p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-snug">
            町田のおいしい、
            <br />
            今すぐ見つかる。
          </h1>
          <p className="mt-2 text-sm text-on-brand-soft">空席・限定メニュー・お得な特典をチェック</p>
          <form action="/search" method="get" className="mt-5">
            <label className="flex min-h-13 items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-ink shadow-card">
              <Icon name="search" className="h-5 w-5 text-muted" />
              <input name="q" type="search" placeholder="店名・ジャンル・エリアで検索" className="w-full bg-transparent text-base outline-none placeholder:text-muted" enterKeyHint="search" aria-label="お店を検索" />
            </label>
          </form>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link href="/search?now=1" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-bright text-[15px] font-bold text-brand">
              今すぐ入れるお店
            </Link>
            <Link href="/search" className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-on-brand-soft/60 text-[15px] font-bold text-on-brand">
              条件で探す
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-md space-y-8 py-6">
        {deleted ? <p role="status" className="mx-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">退会の手続きが完了しました。ご利用ありがとうございました。</p> : null}

        {stores.status !== "ok" ? (
          <div className="px-4">
            <LoadError unconfigured={stores.status === "unconfigured"} />
          </div>
        ) : (
          <>
            {/* ---------- ① 今すぐ入れるお店 ---------- */}
            <section>
              <Heading title="今すぐ入れるお店" href="/search?now=1" />
              {availableNow.length ? (
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                  {availableNow.map((s) => (
                    <StorePhotoCard key={s.id} store={s} />
                  ))}
                </div>
              ) : (
                <p className="mx-4 rounded-2xl border border-line/70 bg-surface p-4 text-[15px] text-muted">
                  いま空席情報が出ているお店はありません。営業時間外か、お店の更新を待っています。
                </p>
              )}
            </section>

            {/* ---------- ② 本日のお得情報 ---------- */}
            {d && dealCount > 0 ? (
              <section>
                <Heading title="本日のお得情報" href="/deals" more="すべて見る" />
                <div className="space-y-3 px-4">
                  {d.timeSales.slice(0, 2).map((s) => (
                    <TimeSaleCard key={s.id} sale={s} showStore />
                  ))}
                  {d.specials.slice(0, 2).map((s) => (
                    <SpecialCard key={s.id} special={s} showStore />
                  ))}
                  {d.coupons.slice(0, 1).map((c) => (
                    <CouponCard key={c.id} coupon={c} showStore />
                  ))}
                </div>
              </section>
            ) : null}

            {/* ---------- ③ おすすめ店舗 ---------- */}
            {others.length ? (
              <section>
                <Heading title="おすすめ店舗" href="/search" />
                <ul className="space-y-3 px-4">
                  {others.map((s) => (
                    <li key={s.id}>
                      <StoreCard store={s} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <p className="px-4 text-xs text-muted">※ 掲載中の店舗はすべてデモ用の架空店舗です。</p>
          </>
        )}
      </div>
    </main>
  );
}
