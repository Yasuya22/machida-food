import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadError } from "@/components/ui/Section";
import { StoreCard } from "@/components/store/StoreCard";
import { Icon } from "@/components/ui/Icon";
import { loadSearchOptions, loadStores, type SearchFilters } from "@/lib/stores/queries";

export const metadata: Metadata = { title: "探す" };
export const dynamic = "force-dynamic";

/** 予算の上限の選択肢（予算目安の下限がこの金額以下のお店） */
const BUDGETS = [1000, 2000, 3000, 5000];
/** 人数の選択肢（最大人数がこの人数以上のお店） */
const PARTIES = [2, 4, 6, 10, 20];

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function list(v: string | string[] | undefined): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
}
function num(v: string | string[] | undefined): number | undefined {
  const n = Number(first(v));
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseFilters(p: Params): SearchFilters {
  return {
    q: first(p.q)?.trim() || undefined,
    area: first(p.area) || undefined,
    genre: first(p.genre) || undefined,
    budget: num(p.budget),
    party: num(p.party),
    features: list(p.f),
    availableNow: first(p.now) === "1",
  };
}

const selectClass = "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = parseFilters(await searchParams);
  const [options, result] = await Promise.all([loadSearchOptions(), loadStores(filters)]);
  const active =
    !!filters.q ||
    !!filters.area || !!filters.genre || !!filters.budget || !!filters.party || filters.features.length > 0 || filters.availableNow;

  return (
    <main>
      <PageHeader title="探す" lead="場所や予算で、お店をしぼる" />
      <div className="mx-auto max-w-md space-y-6 px-4 py-6">
        <form method="get" className="space-y-3">
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-line bg-surface px-3">
            <Icon name="search" className="h-5 w-5 text-muted" />
            <input name="q" type="search" defaultValue={filters.q ?? ""} placeholder="焼肉、原町田、カフェ…" className="w-full bg-transparent text-base outline-none" enterKeyHint="search" />
          </label>
          <label className="flex items-center gap-3 rounded-md bg-ok-soft px-3 py-2.5 text-sm font-bold text-ok">
            <input type="checkbox" name="now" value="1" defaultChecked={filters.availableNow} className="h-4 w-4 accent-[var(--c-ok)]" />
            今すぐ入れるお店だけ
          </label>

          {/* 細かい条件は畳んでおく（使っているときは開いたまま） */}
          <details open={!!(filters.area || filters.genre || filters.budget || filters.party || filters.features.length)} className="group rounded-md border border-line bg-surface">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
              条件をしぼる
              <Icon name="arrow" className="h-4 w-4 rotate-90 text-muted transition-transform group-open:-rotate-90" />
            </summary>
            <div className="space-y-4 border-t border-line p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted">
              エリア
              <select name="area" defaultValue={filters.area ?? ""} className={selectClass}>
                <option value="">すべて</option>
                {options.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              ジャンル
              <select name="genre" defaultValue={filters.genre ?? ""} className={selectClass}>
                <option value="">すべて</option>
                {options.genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              予算（1人）
              <select name="budget" defaultValue={filters.budget ?? ""} className={selectClass}>
                <option value="">指定なし</option>
                {BUDGETS.map((b) => (
                  <option key={b} value={b}>
                    {b.toLocaleString("ja-JP")}円まで
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              人数
              <select name="party" defaultValue={filters.party ?? ""} className={selectClass}>
                <option value="">指定なし</option>
                {PARTIES.map((n) => (
                  <option key={n} value={n}>
                    {n}名以上
                  </option>
                ))}
              </select>
            </label>
          </div>

          {options.features.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-xs text-muted">こだわり条件</legend>
              <div className="flex flex-wrap gap-2">
                {options.features.map((f) => (
                  <label key={f} className="cursor-pointer">
                    <input type="checkbox" name="f" value={f} defaultChecked={filters.features.includes(f)} className="peer sr-only" />
                    <span className="inline-flex min-h-9 items-center rounded-full border border-line px-3.5 text-sm text-muted transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-accent-bright">
                      {f}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
            </div>
          </details>

          <div className="flex gap-2">
            <button type="submit" className="min-h-12 flex-1 rounded-md bg-brand text-[15px] font-bold text-on-brand">
              この条件で探す
            </button>
            {active ? (
              <Link href="/search" className="inline-flex min-h-12 items-center rounded-md border border-line px-4 text-sm text-muted">
                クリア
              </Link>
            ) : null}
          </div>
        </form>

        <section className="space-y-2" aria-live="polite">
          {result.status === "ok" ? (
            <>
              <p className="text-sm">
                <span className="font-display text-lg font-bold">{result.data.length}</span>
                <span className="ml-1 text-muted">件（駅から近い順）</span>
              </p>
              {result.data.length === 0 ? (
                <p className="py-2 text-[15px] text-muted">
                  ぴったりのお店が見つかりませんでした。条件をひとつ外してみてください。
                </p>
              ) : (
                <ul className="border-t border-line">
                  {result.data.map((s) => (
                    <li key={s.id}>
                      <StoreCard store={s} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <LoadError unconfigured={result.status === "unconfigured"} />
          )}
          <p className="text-xs text-muted">※ 掲載中の店舗はすべてデモ用の架空店舗です。</p>
        </section>
      </div>
    </main>
  );
}
