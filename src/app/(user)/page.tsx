import Link from "next/link";
import { BRANDS, currentBrand } from "@/config/brand";
import { LoadError, Section } from "@/components/ui/Section";
import { StoreCard } from "@/components/store/StoreCard";
import { TimeSaleCard } from "@/components/store/DealCards";
import { loadDeals, loadStores } from "@/lib/stores/queries";

// 空席などは常に最新を出すため、毎回サーバーで組み立てる
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const brand = BRANDS[currentBrand()];
  const [stores, deals] = await Promise.all([loadStores(), loadDeals()]);
  const availableNow = stores.status === "ok" ? stores.data.filter((s) => s.seats.kind === "available") : [];

  return (
    <main>
      <section className="bg-brand px-4 pb-8 pt-[calc(env(safe-area-inset-top)+28px)] text-on-brand">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-medium tracking-[0.3em] text-accent-bright">{brand.name}</p>
          <h1 className="mt-2 font-display text-[26px] font-bold leading-snug">{brand.tagline}</h1>
          <p className="mt-2 text-sm text-on-brand-soft">空席・クーポン・スタンプを、ひとつのアプリで。</p>
          <div className="mt-5 flex items-center gap-3">
            <Link href="/search?now=1" className="rounded-full bg-accent-bright px-4 py-2 text-sm font-bold text-brand">
              今すぐ入れるお店
            </Link>
            <Link href="/search" className="text-sm text-on-brand-soft underline-offset-4 hover:underline">
              条件で探す
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-md space-y-8 px-4 py-6">
        {deleted ? <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">退会の手続きが完了しました。ご利用ありがとうございました。</p> : null}
        {stores.status !== "ok" ? (
          <LoadError unconfigured={stores.status === "unconfigured"} />
        ) : (
          <>
            <Section
              title="今すぐ入れるお店"
              note={availableNow.length ? `${availableNow.length}店` : undefined}
              isEmpty={availableNow.length === 0}
              empty="いま空席情報が出ているお店はありません。営業時間外か、お店の更新を待っています。"
            >
              <ul className="space-y-2">
                {availableNow.map((s) => (
                  <li key={s.id}>
                    <StoreCard store={s} />
                  </li>
                ))}
              </ul>
            </Section>

            {deals.status === "ok" && deals.data.timeSales.length > 0 ? (
              <Section title="開催中のタイムセール">
                <div className="space-y-2">
                  {deals.data.timeSales.slice(0, 3).map((s) => (
                    <TimeSaleCard key={s.id} sale={s} showStore />
                  ))}
                </div>
              </Section>
            ) : null}

            <Section title="掲載中のお店" note={`${stores.data.length}店・駅から近い順`}>
              <ul className="space-y-2">
                {stores.data.map((s) => (
                  <li key={s.id}>
                    <StoreCard store={s} />
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted">※ 掲載中の店舗はすべてデモ用の架空店舗です。</p>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
