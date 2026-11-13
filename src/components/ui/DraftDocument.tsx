import Link from "next/link";

/**
 * 利用規約・プライバシーポリシーの「仮の文面」を表示する枠。
 * 本文の確定は運営者の確認後（CLAUDE.md：法的文書は承認なしに確定しない）。
 */
export function DraftDocument({ title, sections }: { title: string; sections: { heading: string; body: string }[] }) {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <p className="rounded-md bg-warn-soft p-3 text-sm font-bold text-warn">
        これは開発用の仮の文面です。内容は確定しておらず、公開前に運営者が確認・修正します。
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold">{title}（仮）</h1>
      <div className="mt-6 space-y-5 text-sm">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-bold">{s.heading}</h2>
            <p className="mt-1 text-muted">{s.body}</p>
          </section>
        ))}
      </div>
      <Link href="/" className="mt-8 inline-block text-sm text-accent underline">
        ホームへ戻る
      </Link>
    </main>
  );
}
