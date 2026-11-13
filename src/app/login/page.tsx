import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRANDS, currentBrand } from "@/config/brand";
import { getSession, safeNext } from "@/lib/auth";
import { BrandLogo } from "@/components/ui/BrandMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "ログイン" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSession()) redirect(next);
  const brand = BRANDS[currentBrand()];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <BrandLogo name={brand.name} className="mx-auto w-40" />
      <h1 className="mt-5 font-display text-2xl font-bold">ログイン・会員登録</h1>
      <p className="mt-1 text-sm text-muted">メールに届くリンクを押すだけで入れます。</p>
      {sp.error ? <p className="mt-4 rounded-md bg-full-soft p-3 text-sm text-full">リンクの有効期限が切れたか、すでに使われています。もう一度メールアドレスを入れてください。</p> : null}
      <div className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-card">
        <LoginForm next={next} />
      </div>
      <Link href="/" className="mt-6 text-center text-sm text-muted underline-offset-4 hover:underline">
        ホームへ戻る
      </Link>
    </main>
  );
}
