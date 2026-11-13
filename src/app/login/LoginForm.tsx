"use client";
import { useActionState } from "react";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="rounded-lg border border-ok/40 bg-ok-soft p-5 text-sm text-ok">
        <p className="font-bold">メールを送りました</p>
        <p className="mt-1 text-ink">届いたメールのリンクを、この端末で開くとログインできます。届かないときは迷惑メールのフォルダもご確認ください。</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1 text-sm">
        <span className="text-muted">メールアドレス</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="example@mail.com"
          className="w-full rounded-md border border-line bg-surface px-3 py-3 text-base"
        />
      </label>
      {state.status === "error" ? <p className="text-sm text-full">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-brand py-3 text-sm font-bold text-on-brand disabled:opacity-60">
        {pending ? "送信中…" : "ログイン用のリンクを送る"}
      </button>
      <p className="text-xs text-muted">パスワードは不要です。初めての方もこのまま会員登録に進めます。</p>
    </form>
  );
}
