import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "特典" };

export default function Page() {
  return (
    <main>
      <PageHeader title="特典" lead="スタンプと町田ポイント" />
      <div className="mx-auto max-w-md px-4 py-6">
        <ComingSoon step="6. 仕上げで作ります">お店ごとのスタンプカード、たまった特典、町田ポイントの履歴。</ComingSoon>
      </div>
    </main>
  );
}
