import { BrandSeal } from "./BrandMark";

/** 各画面の見出し（深緑の帯。右上に「町」の角印） */
export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="bg-brand px-4 pb-5 pt-[calc(env(safe-area-inset-top)+18px)] text-on-brand">
      <div className="mx-auto flex max-w-md items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold leading-tight">{title}</h1>
          {lead ? <p className="mt-1.5 text-sm text-on-brand-soft">{lead}</p> : null}
        </div>
        <BrandSeal className="mt-0.5 h-8 w-8 shrink-0 text-accent-bright/80" />
      </div>
    </header>
  );
}

/** 中身の準備中を示す枠（Phase 1 の各回で中身を作る） */
export function ComingSoon({ step, children }: { step: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface p-5 text-sm text-muted">
      <p className="mb-1 text-xs font-bold tracking-wider text-accent">{step}</p>
      {children}
    </div>
  );
}
