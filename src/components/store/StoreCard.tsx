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

/** 「町田駅から徒歩4分」（歩く人のアイコンつき） */
export function WalkLabel({ minutes, area }: { minutes: number | null; area?: string | null }) {
  if (minutes == null && !area) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Icon name="walk" className="h-4 w-4" />
      {area ? `${area}・` : ""}
      {minutes != null ? `駅から${minutes}分` : ""}
    </span>
  );
}

/** 一覧用（罫線で区切る行。写真小＋お店からの一言） */
export function StoreCard({ store }: { store: StoreView }) {
  const budget = budgetLabel(store.price_min, store.price_max);
  return (
    <Link href={`/stores/${store.id}`} className="flex gap-3 border-b border-line py-3.5 active:bg-surface/60">
      <StoreThumb name={store.name} genre={store.genre} cover={store.cover_path} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-accent">{store.genre}</p>
        <p className="truncate font-display text-[17px] font-bold leading-snug">{store.name}</p>
        {store.description ? <p className="mt-0.5 line-clamp-1 text-sm text-muted">「{store.description}」</p> : null}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          <WalkLabel minutes={store.walk_minutes} area={store.areaName} />
          {budget ? <span>{budget}</span> : null}
        </p>
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
  const budget = store.price_min != null ? `${yen(store.price_min)}〜` : null;
  const open = openLabel(store.open);
  return (
    <Link href={`/stores/${store.id}`} className="block w-[80%] shrink-0 snap-start overflow-hidden rounded-lg border border-line bg-surface active:opacity-95">
      <div className="relative">
        <StoreThumb name={store.name} genre={store.genre} cover={store.cover_path} size="card" />
        <div className="absolute left-3 top-3">
          <SeatBadge state={store.seats} large />
        </div>
      </div>
      <div className="space-y-1 p-3.5">
        <p className="text-xs font-bold text-accent">{store.genre}</p>
        <p className="truncate font-display text-lg font-bold leading-snug">{store.name}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          <WalkLabel minutes={store.walk_minutes} area={store.areaName} />
          {budget ? <span>{budget}</span> : null}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className={`text-sm font-bold ${open.tone === "warn" ? "text-sale" : open.tone === "ok" ? "text-ok" : "text-muted"}`}>{open.text}</span>
          <UpdatedAt state={store.seats} />
        </div>
      </div>
    </Link>
  );
}
