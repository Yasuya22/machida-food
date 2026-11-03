import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadError, Section } from "@/components/ui/Section";
import { CouponCard, SpecialCard, TimeSaleCard } from "@/components/store/DealCards";
import { loadDeals } from "@/lib/stores/queries";

export const metadata: Metadata = { title: "お得" };
export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const result = await loadDeals();
  return (
    <main>
      <PageHeader title="お得" lead="クーポン・タイムセール・今日の限定" />
      <div className="mx-auto max-w-md space-y-8 px-4 py-6">
        {result.status !== "ok" ? (
          <LoadError unconfigured={result.status === "unconfigured"} />
        ) : (
          <>
            <Section title="タイムセール" note="開催中" isEmpty={result.data.timeSales.length === 0} empty="開催中のタイムセールはありません。">
              <div className="space-y-2">
                {result.data.timeSales.map((s) => (
                  <TimeSaleCard key={s.id} sale={s} showStore />
                ))}
              </div>
            </Section>

            <Section title="今日の限定メニュー" isEmpty={result.data.specials.length === 0} empty="今日の限定メニューはありません。">
              <div className="space-y-2">
                {result.data.specials.map((s) => (
                  <SpecialCard key={s.id} special={s} showStore />
                ))}
              </div>
            </Section>

            <Section title="クーポン" note={`${result.data.coupons.length}件`} isEmpty={result.data.coupons.length === 0} empty="使えるクーポンはありません。">
              <div className="space-y-2">
                {result.data.coupons.map((c) => (
                  <CouponCard key={c.id} coupon={c} showStore />
                ))}
                <p className="text-xs text-muted">
                  ご利用の際はお会計前にお店の方へお知らせください。内容・条件はお店の判断で変わることがあります。期限が過ぎたものは自動で表示されなくなります。
                </p>
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
