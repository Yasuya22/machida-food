"use client";
import Link from "next/link";
import { useActionState } from "react";
import { register, type RegisterState } from "./actions";

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, { status: "idle" });

  if (state.status === "done") {
    return (
      <div className="space-y-4 rounded-2xl border border-accent-bright bg-surface p-5 text-center shadow-card">
        <p className="text-xs font-bold tracking-widest text-accent">WELCOME</p>
        <p className="font-display text-xl font-bold">登録ありがとうございます</p>
        <ul className="space-y-1 text-sm">
          {state.points > 0 ? <li>町田ポイント {state.points.toLocaleString("ja-JP")}pt</li> : null}
          {state.coupons > 0 ? <li>初回来店クーポン {state.coupons}枚</li> : null}
          {state.cosmetics > 0 ? <li>着せ替えアイテム {state.cosmetics}点</li> : null}
        </ul>
        <p className="text-xs text-muted">初回登録特典の内容は予告なく変わることがあります。</p>
        <Link href={state.next} className="block rounded-xl bg-brand py-3 text-sm font-bold text-on-brand">
          はじめる
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1 text-sm">
        <span className="text-muted">ニックネーム（12文字まで・お店には表示されません）</span>
        <input name="nickname" required maxLength={12} className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base" />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted">誕生月（任意・誕生月の特典に使います）</span>
        <select name="birth_month" defaultValue="" className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base">
          <option value="">登録しない</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}月
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" name="adult" value="1" className="mt-1 h-4 w-4" />
        <span>
          20歳以上です
          <span className="block text-xs text-muted">お酒に関わる特典（はしごボーナスなど）は20歳以上の方だけが対象です。あとから変更はできません。</span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" name="agree" value="1" required className="mt-1 h-4 w-4" />
        <span>
          <Link href="/terms" target="_blank" className="text-accent underline">
            利用規約
          </Link>
          と
          <Link href="/privacy" target="_blank" className="text-accent underline">
            プライバシーポリシー
          </Link>
          に同意します
        </span>
      </label>

      {state.status === "error" ? <p className="text-sm text-full">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-on-brand disabled:opacity-60">
        {pending ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
