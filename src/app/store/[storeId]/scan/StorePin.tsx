"use client";
import { useEffect, useState } from "react";

/**
 * 今日の店舗PIN（予備の来店認証）。お客様に見えないよう、押したときだけ10秒表示する。
 * お客様の画面「店舗PINでスタンプ」に、スタッフが入力する。
 */
export function StorePin({ pin }: { pin: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 10000);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <details className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <summary className="cursor-pointer text-sm font-bold">カメラが使えないとき（店舗PIN）</summary>
      <div className="mt-3 space-y-2 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>お客様のスマホで、このお店のページの「店舗PINでスタンプ」を開いてもらう</li>
          <li>スタッフがお客様のスマホに、下の今日のPINを入力する</li>
        </ol>
        <button
          onClick={() => setShown(true)}
          className="w-full rounded-md border border-brand py-3 font-display text-2xl font-bold tracking-[0.5em] text-brand"
          aria-live="polite"
        >
          {shown ? pin : "＊＊＊＊（押して表示）"}
        </button>
        <p className="text-xs text-muted">PINはお店ごとに毎日変わります。お客様に見せたり、店内に掲示したりしないでください。漏れたときはオーナーが「店舗設定」で作り直せます。</p>
      </div>
    </details>
  );
}
