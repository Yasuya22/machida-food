import Link from "next/link";
import { BRANDS, currentBrand } from "@/config/brand";
import { Icon } from "@/components/ui/Icon";
import { BrandLogo } from "@/components/ui/BrandMark";
import { LoadError, SectionTitle } from "@/components/ui/Section";
import { AreaMap, type AreaCount } from "@/components/store/AreaMap";
import { StoreCard, StorePhotoCard } from "@/components/store/StoreCard";
import { CouponCard, SpecialCard, TimeSaleCard } from "@/components/store/DealCards";
import { loadDeals, loadStores } from "@/lib/stores/queries";
import { seatLevel } from "@/lib/stores/status";

// 空席などは常に最新を出すため、毎回サーバーで組み立てる
export const dynamic = "force-dynamic";

/**
 * ホーム。優先順位：①いま入れるお店（写真大）②今日のお得（テラコッタ）③エリアの地図 ④駅まわりのお店
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
  // エリアごとのお店の数（地図の名札に出す）
  const areaMap = new Map<string, AreaCount>();
  for (const s of all) {
    if (!s.area_id || !s.areaName) continue;
    const cur = areaMap.get(s.area_id) ?? { id: s.area_id, name: s.areaName, count: 0 };
    cur.count += 1;
    areaMap.set(s.area_id, cur);
  }
  const areas = [...areaMap.values()];

  return (
    <main>
      {/* ---------- 上：ロゴ・ひとこと・検索 ---------- */}
      <section className="bg-brand px-4 pb-6 pt-[calc(env(safe-area-inset-top)+16px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <BrandLogo name={brand.name} tagline={brand.tagline} />
          <h1 className="mt-6 font-display text-[27px] font-bold leading-snug">今日は、どこで食べる？</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-on-brand-soft">町田駅のまわりのお店の、いま空いている席と、今日だけのひと皿。</p>
          <form action="/search" method="get" className="mt-5">
            <label className="flex min-h-13 items-center gap-2 rounded-md bg-surface px-4 py-3 text-ink">
              <Icon name="search" className="h-5 w-5 text-muted" />
              <input name="q" type="search" placeholder="焼肉、原町田、カフェ…" className="w-full bg-transparent text-base outline-none placeholder:text-muted" enterKeyHint="search" aria-label="お店を検索" />
            </label>
          </form>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link href="/search?now=1" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md bg-accent-bright text-[15px] font-bold text-brand">
              <Icon name="seat" className="h-5 w-5" />
              いま入れるお店
            </Link>
            <a href="#area" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md border border-on-brand-soft/50 text-[15px] font-bold text-on-brand">
              <Icon name="map" className="h-5 w-5" />
              エリアから探す
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-md space-y-8 py-6">
        {deleted ? <p role="status" className="mx-4 rounded-md bg-accent-soft p-3 text-sm text-accent">退会の手続きが完了しました。ご利用ありがとうございました。</p> : null}

        {stores.status !== "ok" ? (
          <div className="px-4">
            <LoadError unconfigured={stores.status === "unconfigured"} />
          </div>
        ) : (
          <>
            {/* ---------- ① 今すぐ入れるお店 ---------- */}
            <section>
              <div className="px-4">
                <SectionTitle title="いま入れるお店" href="/search?now=1" />
              </div>
              {availableNow.length ? (
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                  {availableNow.map((s) => (
                    <StorePhotoCard key={s.id} store={s} />
                  ))}
                </div>
              ) : (
                <p className="mx-4 text-[15px] leading-relaxed text-muted">
                  いまは空席を出しているお店がありません。席の状況は、営業中にお店の人が更新しています。
                </p>
              )}
            </section>

            {/* ---------- ② 本日のお得情報 ---------- */}
            {d && dealCount > 0 ? (
              <section>
                <div className="px-4">
                  <SectionTitle title="今日のお得" href="/deals" more="ぜんぶ見る" />
                </div>
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

            {/* ---------- ③ エリアの地図 ---------- */}
            {areas.length ? (
              <section id="area" className="scroll-mt-4 px-4">
                <SectionTitle title="エリアから探す" />
                <AreaMap areas={areas} />
              </section>
            ) : null}

            {/* ---------- ④ 駅まわりのお店 ---------- */}
            {others.length ? (
              <section className="px-4">
                <SectionTitle title="駅まわりのお店" href="/search" />
                <ul>
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
