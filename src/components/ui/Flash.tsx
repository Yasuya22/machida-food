/** 処理結果の一言（URLの ?msg= で受け取る） */
export function Flash({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="status" className="mb-4 rounded-md bg-accent-soft p-3 text-sm text-accent">
      {msg}
    </p>
  );
}

/*
 * 全画面で共通の部品の見た目（ボタンの高さ・角丸・余白をここで統一する）
 * - 主ボタン：高さ48px・角丸12px・太字15px（指で押しやすい大きさ）
 * - 副ボタン：高さ40px以上
 */
export const inputClass = "min-h-11 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[15px] text-ink";
export const buttonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-5 text-[15px] font-bold text-on-brand active:opacity-90 disabled:opacity-50";
export const goldButtonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent-bright px-5 text-[15px] font-bold text-brand active:opacity-90";
export const outlineButtonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-brand px-5 text-[15px] font-bold text-brand active:bg-brand/5";
export const subButtonClass = "inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm text-muted";
export const cardClass = "rounded-lg border border-line/70 bg-surface p-4 shadow-card";
