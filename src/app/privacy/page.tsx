import type { Metadata } from "next";
import { DraftDocument } from "@/components/ui/DraftDocument";

export const metadata: Metadata = { title: "プライバシーポリシー（仮）" };

export default function PrivacyPage() {
  return (
    <DraftDocument
      title="プライバシーポリシー"
      sections={[
        { heading: "1. 取得する情報", body: "メールアドレス、ニックネーム、誕生月（任意）、20歳以上かどうかの申告、来店・クーポン利用の記録、町田ポイントの履歴。位置情報は保存しません。" },
        { heading: "2. 利用目的", body: "ログイン、来店スタンプ・クーポン・ポイントの管理、特典のご案内、不正利用の防止、サービスの改善のため。" },
        { heading: "3. 店舗への提供", body: "店舗には、そのお店での来店・クーポン利用の記録だけが表示されます。メールアドレス・ニックネーム・誕生月は店舗に表示しません。" },
        { heading: "4. 会員証QRコード", body: "会員証QRコードには個人情報を含めず、30秒ごとに切り替わる使い捨ての番号だけを表示します。" },
        { heading: "（未確定の項目）", body: "第三者提供、外部サービス（データの保存先）、開示・削除の請求窓口、改定手続きなどは、運営者の確認後に追記します。" },
      ]}
    />
  );
}
