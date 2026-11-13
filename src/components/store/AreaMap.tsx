import Link from "next/link";
import { AREA_MAP_POSITIONS } from "@/config/areaMap";

export type AreaCount = { id: string; name: string; count: number };

/**
 * 町田駅まわりの手描き風の地図。エリアの名札をタップすると、そのエリアで探す。
 * 地図APIは使わない（費用ゼロ・読み込みが速い）。正確な場所は店舗詳細の「地図アプリで開く」で見る。
 */
export function AreaMap({ areas }: { areas: AreaCount[] }) {
  const placed = areas.filter((a) => AREA_MAP_POSITIONS[a.name]);
  const others = areas.filter((a) => !AREA_MAP_POSITIONS[a.name]);
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <svg viewBox="0 0 340 230" className="block h-auto w-full" role="group" aria-label="町田駅まわりのエリア">
          {/* 紙の地図のような下地 */}
          <rect width="340" height="230" fill="var(--c-surface)" />
          {/* 大通り（手描き風のゆらぎ） */}
          <path d="M8 120c40-6 80 2 120-4s70-10 110-2 70 6 94 2" fill="none" stroke="var(--c-line)" strokeWidth="9" strokeLinecap="round" />
          <path d="M150 226c4-30-6-60 2-92s14-62 6-130" fill="none" stroke="var(--c-line)" strokeWidth="7" strokeLinecap="round" />
          {/* JR横浜線（南北） */}
          <path d="M214 4c-6 40-10 70-20 100s-12 70-30 124" fill="none" stroke="var(--c-muted)" strokeWidth="3" />
          <path d="M214 4c-6 40-10 70-20 100s-12 70-30 124" fill="none" stroke="var(--c-surface)" strokeWidth="1.5" strokeDasharray="5 5" />
          <text x="222" y="20" fontSize="9" fill="var(--c-muted)">JR横浜線</text>
          {/* 小田急線（東西） */}
          <path d="M4 196c50-22 100-48 150-72s110-44 182-60" fill="none" stroke="var(--c-brand)" strokeWidth="3" opacity="0.55" />
          <path d="M4 196c50-22 100-48 150-72s110-44 182-60" fill="none" stroke="var(--c-surface)" strokeWidth="1.5" strokeDasharray="5 5" />
          <text x="10" y="186" fontSize="9" fill="var(--c-muted)" transform="rotate(-24 10 186)">小田急線</text>
          {/* 町田駅 */}
          <g>
            <rect x="160" y="98" width="62" height="28" rx="4" fill="var(--c-brand)" />
            <text x="191" y="117" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--c-on-brand)" style={{ fontFamily: "var(--font-display)" }}>
              町田駅
            </text>
          </g>
          {/* エリアの名札（タップでそのエリアを探す） */}
          {placed.map((a) => {
            const p = AREA_MAP_POSITIONS[a.name]!;
            const w = Math.max(64, a.name.length * 13 + 42);
            return (
              <a key={a.id} href={`/search?area=${a.id}`} aria-label={`${a.name}のお店（${a.count}店）`}>
                <rect x={p.x - w / 2} y={p.y - 15} width={w} height="30" rx="15" fill="var(--c-surface)" stroke="var(--c-accent-bright)" strokeWidth="2" />
                <text x={p.x - 6} y={p.y + 5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--c-ink)">
                  {a.name}
                </text>
                <text x={p.x + w / 2 - 12} y={p.y + 4.5} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--c-accent)">
                  {a.count}
                </text>
              </a>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">名札の数字はお店の数。イメージ図なので、距離や向きは実際と違います。</p>
        {others.map((a) => (
          <Link key={a.id} href={`/search?area=${a.id}`} className="inline-flex min-h-9 items-center rounded-full border border-accent-bright px-3 text-sm font-bold">
            {a.name}
            <span className="ml-1.5 text-accent">{a.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
