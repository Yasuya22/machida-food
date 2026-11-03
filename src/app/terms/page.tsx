import type { Metadata } from "next";
import { DraftDocument } from "@/components/ui/DraftDocument";

export const metadata: Metadata = { title: "利用規約（仮）" };

export default function TermsPage() {
  return (
    <DraftDocument
      title="利用規約"
      sections={[
        { heading: "1. このサービスについて", body: "MACHIDA FOOD は、YSY総合サービスが運営する、町田駅周辺の飲食店の情報・クーポン・スタンプを提供するサービスです。" },
        { heading: "2. 会員登録", body: "メールアドレスでログインし、ニックネーム等を登録して利用します。1人1アカウントとします。" },
        { heading: "3. 町田ポイント・特典", body: "町田ポイントは換金・譲渡・購入はできません。特典・クーポンの内容は各店舗・運営の判断で変更・終了することがあります。" },
        { heading: "4. 禁止事項", body: "不正な手段での特典の取得、会員証の使い回し、他の利用者や店舗への迷惑行為を禁止します。" },
        { heading: "5. 年齢", body: "お酒に関わる特典は20歳以上の方に限ります。" },
        { heading: "（未確定の項目）", body: "免責、退会、規約の変更手続き、準拠法・管轄などは、運営者の確認後に追記します。" },
      ]}
    />
  );
}
