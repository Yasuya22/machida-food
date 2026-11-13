import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { cardClass } from "@/components/ui/Flash";
import { InstallButton } from "@/components/pwa/InstallButton";

export const metadata: Metadata = { title: "アプリとして使う" };

const STEPS = {
  iphone: ["Safari でこのページを開く", "画面下の「共有」ボタン（四角から上向きの矢印）を押す", "「ホーム画面に追加」を選び、「追加」を押す"],
  android: ["Chrome でこのページを開く", "上の「ホーム画面にインストール」を押す（出ないときは右上の︙メニューから「アプリをインストール」）", "「インストール」を押す"],
};

export default function InstallPage() {
  return (
    <main>
      <PageHeader title="アプリとして使う" lead="スマホのホーム画面に置いて、すぐ開けるように" />
      <div className="mx-auto max-w-md space-y-5 px-4 py-6">
        <InstallButton />
        {(["iphone", "android"] as const).map((k) => (
          <section key={k} className={cardClass}>
            <h2 className="font-display text-lg font-bold">{k === "iphone" ? "iPhone の場合" : "Android の場合"}</h2>
            <ol className="mt-2 space-y-2 text-sm">
              {STEPS[k].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
        ))}
        <p className="text-xs text-muted">追加すると、アドレスバーのない全画面で開きます。お店の情報は常に最新を表示するため、ご利用にはインターネット接続が必要です。</p>
      </div>
    </main>
  );
}
