import Link from "next/link";
import type { StoreView } from "@/lib/stores/queries";
import { yen } from "@/lib/stores/status";
import { Icon } from "@/components/ui/Icon";
import { OpenBadge, SeatBadge } from "./StatusBadges";
import { StoreThumb } from "./StoreThumb";

export function budgetLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${yen(min)}〜${yen(max)}`;
  return yen((min ?? max)!);
}

export function StoreCard({ store }: { store: StoreView }) {
  const budget = budgetLabel(store.price_min, store.price_max);
  return (
    <Link
      href={`/stores/${store.id}`}
      className="flex gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-accent-bright"
    >
      <StoreThumb name={store.name} genre={store.genre} cover={store.cover_path} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{store.name}</p>
        <p className="truncate text-xs text-muted">
          {store.genre}
          {store.areaName ? `・${store.areaName}` : ""}
          {store.walk_minutes != null ? `・徒歩${store.walk_minutes}分` : ""}
          {budget ? `・${budget}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <OpenBadge state={store.open} />
          <SeatBadge state={store.seats} />
        </div>
      </div>
      <Icon name="arrow" className="h-4 w-4 self-center text-muted" />
    </Link>
  );
}
