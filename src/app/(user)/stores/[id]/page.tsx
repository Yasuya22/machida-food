import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/ui/Icon";
import { LoadError, Section } from "@/components/ui/Section";
import { StoreThumb } from "@/components/store/StoreThumb";
import { OpenBadge, SeatPanel } from "@/components/store/StatusBadges";
import { budgetLabel } from "@/components/store/StoreCard";
import { CouponCard, SpecialCard, TimeSaleCard } from "@/components/store/DealCards";
import { loadStoreDetail } from "@/lib/stores/queries";
import { feeLabel, minutesToLabel, timeToMinutes, yen, type StoreHours } from "@/lib/stores/status";

export const dynamic = "force-dynamic";

const getDetail = cache(loadStoreDetail);
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getDetail((await params).id);
  return { title: result.status === "ok" && result.data ? result.data.store.name : "お店" };
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

/** 曜日ごとの営業時間（月曜はじまり）。行がない曜日は定休日 */
function hoursRows(hours: StoreHours[]): { day: string; text: string }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const slots = hours
      .filter((h) => h.weekday === d)
      .sort((a, b) => timeToMinutes(a.opens) - timeToMinutes(b.opens))
      .map((h) => {
        const lo = h.last_order ? `（L.O. ${minutesToLabel(timeToMinutes(h.last_order))}）` : "";
        return `${minutesToLabel(timeToMinutes(h.opens))}〜${minutesToLabel(timeToMinutes(h.closes))}${lo}`;
      });
    return { day: DAY_NAMES[d] ?? "", text: slots.length ? slots.join(" / ") : "定休日" };
  });
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 px-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function StorePage({ params }: Props) {
  const result = await getDetail((await params).id);
  if (result.status !== "ok") {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <LoadError unconfigured={result.status === "unconfigured"} />
      </main>
    );
  }
  if (!result.data) notFound();
  const { store, menu, plans, specials, timeSales, coupons } = result.data;
  const budget = budgetLabel(store.price_min, store.price_max);

  return (
    <main>
      <div className="relative">
        <StoreThumb name={store.name} genre={store.genre} cover={store.cover_path} size="lg" />
        <Link
          href="/search"
          aria-label="探すに戻る"
          className="absolute left-3 top-[calc(env(safe-area-inset-top)+12px)] flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow-card"
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
        </Link>
      </div>

      <div className="mx-auto max-w-md space-y-7 px-4 pb-6">
        <header className="relative z-10 -mt-6 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-xs text-muted">
            {store.genre}
            {store.areaName ? `・${store.areaName}` : ""}
            {store.walk_minutes != null ? `・町田駅から徒歩${store.walk_minutes}分` : ""}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-snug">{store.name}</h1>
          {store.description ? <p className="mt-2 text-sm text-muted">{store.description}</p> : null}
          <div className="mt-3">
            <OpenBadge state={store.open} />
          </div>
        </header>

        <Section title="いまの空席">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <SeatPanel state={store.seats} />
          </div>
        </Section>

        <Section title="予算別プラン" note="すべて税込みの総額（1人あたり）" isEmpty={plans.length === 0} empty="プランの登録はまだありません。">
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-xl font-bold text-brand">{yen(p.price)}</p>
                  <p className="text-sm font-bold">
                    料理{p.dishes}品{p.drinks > 0 ? `・ドリンク${p.drinks}杯` : ""}
                  </p>
                </div>
                {p.note ? <p className="mt-1 text-sm text-muted">{p.note}</p> : null}
                <p className="mt-2 inline-block rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">{feeLabel(p.fee)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="今日の限定メニュー" isEmpty={specials.length === 0} empty="今日の限定メニューはありません。">
          <div className="space-y-2">
            {specials.map((s) => (
              <SpecialCard key={s.id} special={s} />
            ))}
          </div>
        </Section>

        <Section title="タイムセール" isEmpty={timeSales.length === 0} empty="開催中のタイムセールはありません。">
          <div className="space-y-2">
            {timeSales.map((s) => (
              <TimeSaleCard key={s.id} sale={s} />
            ))}
          </div>
        </Section>

        <Section title="クーポン" isEmpty={coupons.length === 0} empty="使えるクーポンはありません。">
          <div className="space-y-2">
            {coupons.map((c) => (
              <CouponCard key={c.id} coupon={c} />
            ))}
            <p className="text-xs text-muted">ご利用の際はお会計前にお店の方へお知らせください。内容・条件はお店の判断で変わることがあります。</p>
          </div>
        </Section>

        <Section title="メニュー" note="税込み" isEmpty={menu.length === 0} empty="メニューの登録はまだありません。">
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
            {menu.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                <span>{m.name}</span>
                <span className="shrink-0 font-bold">{yen(m.price)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <section className="rounded-2xl border border-line bg-surface p-4 text-sm shadow-card">
          <p className="font-bold">来店スタンプ</p>
          <p className="mt-1 text-muted">お会計のときにマイページの会員証QRを見せてください。お店の端末で読み取れないときは、店舗PINでも押せます。</p>
          <div className="mt-3 flex gap-2">
            <Link href="/mypage/card" className="flex-1 rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-on-brand">会員証を表示</Link>
            <Link href={`/stores/${store.id}/pin`} className="flex-1 rounded-xl border border-brand py-2.5 text-center text-sm font-bold text-brand">店舗PINでスタンプ</Link>
          </div>
        </section>

        <Section title="お店の情報">
          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
            <InfoRow label="営業時間">
              <ul className="space-y-0.5">
                {hoursRows(store.store_hours).map((r) => (
                  <li key={r.day} className="flex gap-2">
                    <span className="w-4 shrink-0 text-muted">{r.day}</span>
                    <span className={r.text === "定休日" ? "text-muted" : ""}>{r.text}</span>
                  </li>
                ))}
              </ul>
            </InfoRow>
            {store.holiday_note ? <InfoRow label="定休日">{store.holiday_note}</InfoRow> : null}
            {store.address ? <InfoRow label="住所">{store.address}</InfoRow> : null}
            {budget ? <InfoRow label="予算の目安">{budget}</InfoRow> : null}
            <InfoRow label="最大人数">{store.max_party}名まで</InfoRow>
            {store.payment_methods.length ? <InfoRow label="支払い">{store.payment_methods.join("・")}</InfoRow> : null}
            {store.features.length ? (
              <InfoRow label="こだわり">
                <div className="flex flex-wrap gap-1">
                  {store.features.map((f) => (
                    <span key={f} className="rounded-full border border-line px-2 py-0.5 text-xs">
                      {f}
                    </span>
                  ))}
                </div>
              </InfoRow>
            ) : null}
            {store.parking ? <InfoRow label="駐車場">{store.parking}</InfoRow> : null}
            {store.stamp_reward ? (
              <InfoRow label="スタンプ">
                {store.stamp_goal}個で「{store.stamp_reward}」
              </InfoRow>
            ) : null}
          </dl>
          <p className="text-xs text-muted">※ このお店はデモ用の架空店舗です。</p>
        </Section>
      </div>
    </main>
  );
}
