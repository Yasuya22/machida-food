import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/ui/Icon";
import { LoadError, Section } from "@/components/ui/Section";
import { buttonClass, cardClass, outlineButtonClass } from "@/components/ui/Flash";
import { StoreThumb } from "@/components/store/StoreThumb";
import { OpenBadge, SeatPanel } from "@/components/store/StatusBadges";
import { budgetLabel } from "@/components/store/StoreCard";
import { CouponCard, SpecialCard, TimeSaleCard } from "@/components/store/DealCards";
import { loadStoreDetail } from "@/lib/stores/queries";
import { publicImageUrl } from "@/lib/images";
import { feeLabel, minutesToLabel, timeToMinutes, tokyoNow, yen, type StoreHours } from "@/lib/stores/status";

export const dynamic = "force-dynamic";

const getDetail = cache(loadStoreDetail);
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getDetail((await params).id);
  return { title: result.status === "ok" && result.data ? result.data.store.name : "お店" };
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

/** 曜日ごとの営業時間（月曜はじまり）。行がない曜日は定休日 */
function hoursRows(hours: StoreHours[]): { weekday: number; day: string; slots: string[]; lo: string[] }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const list = hours.filter((h) => h.weekday === d).sort((a, b) => timeToMinutes(a.opens) - timeToMinutes(b.opens));
    return {
      weekday: d,
      day: DAY_NAMES[d] ?? "",
      slots: list.map((h) => `${minutesToLabel(timeToMinutes(h.opens))}〜${minutesToLabel(timeToMinutes(h.closes))}`),
      lo: list.map((h) => (h.last_order ? `L.O. ${minutesToLabel(timeToMinutes(h.last_order))}` : "")),
    };
  });
}

/** 地図アプリで開くリンク（費用のかからない検索リンク。地図APIは導入時に選定する） */
function mapUrl(store: { name: string; address: string | null; lat: number | null; lng: number | null }): string {
  const q = store.lat != null && store.lng != null ? `${store.lat},${store.lng}` : `${store.name} ${store.address ?? "町田"}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 px-4 py-3 text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function dateLabel(ymd: string) {
  const [, m, d] = ymd.split("-");
  const wd = new Date(`${ymd}T00:00:00+09:00`).getUTCDay();
  return `${Number(m)}/${Number(d)}（${DAY_NAMES[(wd + 1) % 7] ?? ""}）`;
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
  const { store, menu, plans, specials, timeSales, coupons, photos, closedDays } = result.data;
  const budget = budgetLabel(store.price_min, store.price_max);
  const today = tokyoNow().weekday;
  const gallery = [
    ...(store.cover_path ? [{ id: "cover", path: store.cover_path, caption: null as string | null }] : []),
    ...photos,
  ];
  const hasDeals = timeSales.length + specials.length + coupons.length > 0;

  return (
    <main>
      {/* ---------- 写真ギャラリー（横にめくる） ---------- */}
      <div className="relative">
        {gallery.length ? (
          <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
            {gallery.map((p, i) => (
              <figure key={p.id} className="relative w-full shrink-0 snap-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicImageUrl(p.path) ?? ""} alt={p.caption ?? `${store.name}の写真`} className="h-64 w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                <figcaption className="absolute bottom-8 right-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white">
                  {i + 1} / {gallery.length}
                  {p.caption ? `・${p.caption}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <StoreThumb name={store.name} genre={store.genre} size="lg" />
        )}
        <Link
          href="/search"
          aria-label="探すに戻る"
          className="absolute left-3 top-[calc(env(safe-area-inset-top)+12px)] flex h-11 w-11 items-center justify-center rounded-full bg-surface/95 text-ink shadow-card"
        >
          <Icon name="arrow" className="h-5 w-5 rotate-180" />
        </Link>
      </div>

      <div className="mx-auto max-w-md space-y-8 px-4 pb-6">
        {/* ---------- 店名と、すぐ知りたいこと ---------- */}
        <header className={`relative z-10 -mt-6 ${cardClass}`}>
          <p className="text-sm text-muted">
            {store.genre}
            {store.areaName ? `・${store.areaName}` : ""}
            {store.walk_minutes != null ? `・町田駅から徒歩${store.walk_minutes}分` : ""}
          </p>
          <h1 className="mt-1 font-display text-[26px] font-bold leading-snug">{store.name}</h1>
          {store.description ? <p className="mt-2 text-[15px] text-muted">{store.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <OpenBadge state={store.open} />
            {budget ? <span className="text-sm text-muted">予算 {budget}</span> : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={mapUrl(store)} target="_blank" rel="noopener noreferrer" className={outlineButtonClass}>
              <Icon name="map" className="h-5 w-5" />
              地図で見る
            </a>
            <Link href="/mypage/card" className={buttonClass}>
              <Icon name="qr" className="h-5 w-5" />
              会員証
            </Link>
          </div>
        </header>

        <Section title="いまの空席">
          <div className={cardClass}>
            <SeatPanel state={store.seats} />
          </div>
        </Section>

        {hasDeals ? (
          <Section title="このお店のお得">
            <div className="space-y-3">
              {timeSales.map((x) => (
                <TimeSaleCard key={x.id} sale={x} />
              ))}
              {specials.map((x) => (
                <SpecialCard key={x.id} special={x} />
              ))}
              {coupons.map((c) => (
                <CouponCard key={c.id} coupon={c} />
              ))}
              {coupons.length ? <p className="text-xs text-muted">クーポンはお会計前にお店の方へお知らせください。内容・条件はお店の判断で変わることがあります。</p> : null}
            </div>
          </Section>
        ) : null}

        <Section title="予算別プラン" note="税込みの総額（1人あたり）" isEmpty={plans.length === 0} empty="プランの登録はまだありません。">
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id} className={cardClass}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-2xl font-bold text-brand">{yen(p.price)}</p>
                  <p className="text-[15px] font-bold">
                    料理{p.dishes}品{p.drinks > 0 ? `・ドリンク${p.drinks}杯` : ""}
                  </p>
                </div>
                {p.note ? <p className="mt-1 text-[15px] text-muted">{p.note}</p> : null}
                <p className="mt-2 inline-block rounded-md bg-accent-soft px-2 py-0.5 text-sm font-bold text-accent">{feeLabel(p.fee)}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------- 営業時間・定休日（今日を強調） ---------- */}
        <Section title="営業時間・定休日">
          <div className={`${cardClass} p-0`}>
            <ul className="divide-y divide-line">
              {hoursRows(store.store_hours).map((r) => {
                const isToday = r.weekday === today;
                return (
                  <li key={r.day} className={`flex items-start gap-3 px-4 py-2.5 text-[15px] ${isToday ? "bg-accent-soft/70" : ""}`}>
                    <span className={`w-10 shrink-0 font-bold ${isToday ? "text-accent" : "text-muted"}`}>
                      {r.day}
                      {isToday ? <span className="block text-xs">今日</span> : null}
                    </span>
                    {r.slots.length ? (
                      <span className="flex-1">
                        {r.slots.map((t, i) => (
                          <span key={t} className="block">
                            {t}
                            {r.lo[i] ? <span className="ml-2 text-sm text-muted">{r.lo[i]}</span> : null}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="flex-1 font-bold text-full">定休日</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {store.holiday_note || closedDays.length ? (
              <div className="space-y-1 border-t border-line px-4 py-3 text-sm">
                {store.holiday_note ? <p>定休日：{store.holiday_note}</p> : null}
                {closedDays.length ? <p className="text-full">臨時休業：{closedDays.slice(0, 5).map(dateLabel).join("、")}</p> : null}
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="メニュー" note="税込み" isEmpty={menu.length === 0} empty="メニューの登録はまだありません。">
          <ul className={`${cardClass} divide-y divide-line p-0`}>
            {menu.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-[15px]">
                <span>{m.name}</span>
                <span className="shrink-0 font-bold">{yen(m.price)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <section className={`${cardClass} space-y-3`}>
          <p className="text-base font-bold">来店スタンプ</p>
          <p className="text-[15px] text-muted">お会計のときに会員証のQRコードを見せてください。お店の端末で読み取れないときは、店舗PINでも押せます。</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/mypage/card" className={buttonClass}>会員証を表示</Link>
            <Link href={`/stores/${store.id}/pin`} className={outlineButtonClass}>店舗PINで押す</Link>
          </div>
        </section>

        <Section title="お店の情報">
          <dl className={`${cardClass} divide-y divide-line p-0`}>
            {store.address ? (
              <InfoRow label="住所">
                {store.address}
                <a href={mapUrl(store)} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-sm font-bold text-accent">
                  <Icon name="map" className="h-4 w-4" />
                  地図アプリで開く
                </a>
              </InfoRow>
            ) : null}
            {budget ? <InfoRow label="予算の目安">{budget}</InfoRow> : null}
            <InfoRow label="最大人数">{store.max_party}名まで</InfoRow>
            {store.payment_methods.length ? <InfoRow label="支払い">{store.payment_methods.join("・")}</InfoRow> : null}
            {store.features.length ? (
              <InfoRow label="こだわり">
                <div className="flex flex-wrap gap-1.5">
                  {store.features.map((f) => (
                    <span key={f} className="rounded-full border border-line px-2.5 py-0.5 text-sm">
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
          <p className="text-xs text-muted">※ このお店はデモ用の架空店舗です（地図の場所も仮です）。</p>
        </Section>
      </div>
    </main>
  );
}
