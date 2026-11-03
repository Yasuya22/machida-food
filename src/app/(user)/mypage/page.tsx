import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "マイページ" };

export default function Page() {
  return (
    <main>
      <PageHeader title="マイページ" lead="会員証・ランク・着せ替え" />
      <div className="mx-auto max-w-md px-4 py-6">
        <ComingSoon step="2. ログイン・会員登録／3. 会員証QRで作ります">メールでログイン、会員証QR（30秒ごとに切り替え）、ランクとキャラクター、称号・枠・衣装。</ComingSoon>
      </div>
    </main>
  );
}
