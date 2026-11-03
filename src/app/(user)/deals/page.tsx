import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "お得" };

export default function Page() {
  return (
    <main>
      <PageHeader title="お得" lead="クーポン・タイムセール・今日の限定" />
      <div className="mx-auto max-w-md px-4 py-6">
        <ComingSoon step="1. 店舗の検索・詳細で作ります">使えるクーポン、終了時刻つきのタイムセール、今日の限定メニュー（期限切れは自動で非表示）。</ComingSoon>
      </div>
    </main>
  );
}
