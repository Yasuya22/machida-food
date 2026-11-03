/** 各画面の見出し（深緑の帯にゴールドの細線） */
export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="bg-brand px-4 pb-5 pt-[calc(env(safe-area-inset-top)+20px)] text-on-brand">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-bold tracking-wide">{title}</h1>
        {lead ? <p className="mt-1 text-sm text-on-brand-soft">{lead}</p> : null}
        <div className="mt-4 h-px w-12 bg-accent-bright" />
      </div>
    </header>
  );
}

/** 中身の準備中を示す枠（Phase 1 の各回で中身を作る） */
export function ComingSoon({ step, children }: { step: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-5 text-sm text-muted">
      <p className="mb-1 text-xs font-bold tracking-wider text-accent">{step}</p>
      {children}
    </div>
  );
}
