/**
 * MACHIDA FOOD のマーク（判子のような角印に「町」）と、文字のロゴ
 * 色はトークンから取るので、NIGHT でもそのまま差し替わる
 */
export function BrandSeal({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="6" y="6" width="28" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <text
        x="20"
        y="28.5"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill="currentColor"
        style={{ fontFamily: "var(--font-display)" }}
      >
        町
      </text>
    </svg>
  );
}

export function BrandLogo({ name, tagline }: { name: string; tagline?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandSeal className="h-10 w-10 text-accent-bright" />
      <div className="leading-tight">
        <p className="text-[13px] font-bold tracking-[0.18em] text-on-brand">{name}</p>
        {tagline ? <p className="text-xs text-on-brand-soft">{tagline}</p> : null}
      </div>
    </div>
  );
}
