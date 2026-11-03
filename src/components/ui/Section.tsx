/** 画面内の区切り（見出し＋中身）。中身が空のときは empty の文言を出す */
export function Section({
  title,
  note,
  empty,
  isEmpty = false,
  children,
}: {
  title: string;
  note?: string;
  empty?: string;
  isEmpty?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {note ? <span className="text-xs text-muted">{note}</span> : null}
      </div>
      {isEmpty ? <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">{empty}</p> : children}
    </section>
  );
}

/** 読み込みに失敗・未設定のときの表示 */
export function LoadError({ unconfigured }: { unconfigured?: boolean }) {
  return (
    <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
      {unconfigured
        ? "データベースの接続先が未設定です（.env.local を設定してください）。"
        : "情報を読み込めませんでした。時間をおいて開き直してください。"}
    </p>
  );
}
