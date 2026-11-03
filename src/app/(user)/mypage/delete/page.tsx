import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Flash, cardClass } from "@/components/ui/Flash";
import { requireSession } from "@/lib/auth";
import { deleteAccount } from "./actions";

export const metadata: Metadata = { title: "退会" };
export const dynamic = "force-dynamic";

export default async function DeletePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireSession("/mypage/delete");
  const { msg } = await searchParams;
  return (
    <main>
      <PageHeader title="退会" lead="アカウントと会員データの削除" />
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        <Flash msg={msg} />
        <section className={`${cardClass} space-y-2 text-sm`}>
          <p className="font-bold">退会すると、次のものがすべて削除され、元に戻せません。</p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted">
            <li>ログイン用のアカウント（メールアドレス）</li>
            <li>ニックネーム・誕生月などの登録情報</li>
            <li>町田ポイント・ランク・着せ替えアイテム</li>
            <li>スタンプカード・もらった特典・クーポン</li>
          </ul>
          <p className="text-xs text-muted">不正利用の防止のため、来店・クーポン利用の記録は、お名前や連絡先を含まない形で一定期間残ります。</p>
        </section>
        <form action={deleteAccount} className={`${cardClass} space-y-3`}>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirm" value="1" required className="mt-1 h-4 w-4" />
            上の内容を理解し、退会します
          </label>
          <button className="w-full rounded-xl bg-full py-3 text-sm font-bold text-white">退会する</button>
        </form>
        <Link href="/mypage" className="block text-center text-sm text-muted underline">マイページに戻る</Link>
      </div>
    </main>
  );
}
