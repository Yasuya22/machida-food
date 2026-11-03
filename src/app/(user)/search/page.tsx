import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "探す" };

export default function Page() {
  return (
    <main>
      <PageHeader title="探す" lead="エリア・ジャンル・予算・こだわり条件から" />
      <div className="mx-auto max-w-md px-4 py-6">
        <ComingSoon step="1. 店舗の検索・詳細で作ります">今すぐ入れるお店、予算別プラン、子連れOK・個室などの条件で絞り込み。</ComingSoon>
      </div>
    </main>
  );
}
