import Link from "next/link";
import type { StoreView } from "@/lib/stores/queries";
import { openLabel, yen } from "@/lib/stores/status";
import { Icon } from "@/components/ui/Icon";
import { OpenBadge, SeatBadge, UpdatedAt } from "./StatusBadges";
import { StoreThumb } from "./StoreThumb";

export function budgetLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${yen(min)}〜${yen(max)}`;
  return yen((min ?? max)!);
}

/** 一覧用（写真小・横並び） */
export function StoreCard({ store }: { store: StoreView }) {
  const budget = budgetLabel(store.price_min, store.price_max);
  return (
    <Link href={`/stores/${store.id}`} className="flex gap-3 rounded-2xl border border-line/70 bg-surface p-3 shadow-card active:bg-bg">
      <StoreThumb name={store.name} genre={store.genre} cover={store.cover_path} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">{store.name}</p>
        <p className="truncate text-sm text-muted">
          {store.genre}
          {store.areaName ? `・${store.areaName}` : ""}
          {store.walk_minutes != null ? `・徒歩${store.walk_minutes}分` : ""}
        </p>
        {budget ? <p className="text-sm text-muted">予算 {budget}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <SeatBadge state={store.seats} />
          <OpenBadge state={store.open} />
        </div>
      </div>
      <Icon name="arrow" className="h-5 w-5 self-center text-muted" />
    </Link>
  );
}

/** ホーム用（写真大・横にめくるカード） */
export function StorePhotoCard({ store }: { store: StoreView }) {
  const budget = store.price_min != null ? `予算 ${yen(store.price_min)}〜` : null;
  const open = openLabel(store.open);
  return (
    <Link href={`/stores/${store.id}`} className="block w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl border border-line/70 bg-surface shadow-card active:opacity-95">
      <div className="relative">
        <StoreThumb name={store.name} genre={store.genre} cover={store.cover_path} size="card" />
        <div className="absolute left-3 top-3">
          <SeatBadge state={store.seats} large />
        </div>
      </div>
      <div className="space-y-1 p-4">
        <p className="truncate text-lg font-bold">{store.name}</p>
        <p className="truncate text-sm text-muted">
          {store.genre}
          {store.areaName ? `・${store.areaName}` : ""}
          {budget ? `・${budget}` : ""}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className={`text-sm font-bold ${open.tone === "warn" ? "text-sale" : open.tone === "ok" ? "text-ok" : "text-muted"}`}>{open.text}</span>
          <UpdatedAt state={store.seats} />
        </div>
      </div>
    </Link>
  );
}
