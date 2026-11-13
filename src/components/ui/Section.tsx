import Link from "next/link";
import { Icon } from "./Icon";

/**
 * 見出し（明朝の見出し＋右に小さな補足・リンク、下に品書きのような二重線）
 * 全画面の見出しをこれにそろえる
 */
export function SectionTitle({ title, note, href, more = "もっと見る" }: { title: string; note?: string; href?: string; more?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-end justify-between gap-2 pb-1.5">
        <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
        {href ? (
          <Link href={href} className="inline-flex min-h-9 items-center gap-0.5 text-sm font-bold text-accent">
            {more}
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        ) : note ? (
          <span className="text-xs text-muted">{note}</span>
        ) : null}
      </div>
      <div className="rule-double" aria-hidden="true" />
    </div>
  );
}

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
    <section>
      <SectionTitle title={title} note={note} />
      {isEmpty ? <p className="py-2 text-[15px] text-muted">{empty}</p> : children}
    </section>
  );
}

/** 読み込みに失敗・未設定のときの表示 */
export function LoadError({ unconfigured }: { unconfigured?: boolean }) {
  return (
    <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
      {unconfigured
        ? "データベースの接続先が未設定です（.env.local を設定してください）。"
        : "うまく読み込めませんでした。電波のよいところで、もう一度開いてみてください。"}
    </p>
  );
}
