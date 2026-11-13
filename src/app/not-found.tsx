import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-2xl font-bold">ページが見つかりません</p>
      <p className="text-sm text-muted">お店の掲載が終わったか、アドレスが間違っている可能性があります。</p>
      <Link href="/" className="rounded-md bg-brand px-5 py-3 text-sm font-bold text-on-brand">
        ホームへ戻る
      </Link>
    </main>
  );
}
