"use client";
import Link from "next/link";
import { useActionState } from "react";
import { stampByPin, type PinState } from "./actions";

export function PinForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState<PinState, FormData>(stampByPin, { status: "idle" });

  if (state.status === "ok") {
    return (
      <div className="space-y-3 rounded-2xl bg-ok-soft p-5 text-center text-ok shadow-card" role="status">
        <p className="font-display text-xl font-bold">来店スタンプを押しました</p>
        <ul className="text-sm text-ink">{state.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <Link href="/rewards" className="block rounded-xl bg-brand py-3 text-sm font-bold text-on-brand">スタンプカードを見る</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <input type="hidden" name="store_id" value={storeId} />
      <label className="block space-y-2 text-center text-sm">
        <span className="font-bold">お店の方が入力してください</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-surface px-3 py-4 text-center font-display text-3xl tracking-[0.6em]"
          aria-label="店舗PIN（4桁）"
        />
      </label>
      {state.status === "error" ? <p className="text-center text-sm text-full">{state.message}</p> : null}
      <button disabled={pending} className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-on-brand disabled:opacity-60">
        {pending ? "確認中…" : "確定する"}
      </button>
    </form>
  );
}
