/** 処理結果の一言（URLの ?msg= で受け取る） */
export function Flash({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="status" className="mb-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">
      {msg}
    </p>
  );
}

export const inputClass = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";
export const buttonClass = "rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand";
export const subButtonClass = "rounded-xl border border-line px-3 py-2 text-xs text-muted";
export const cardClass = "rounded-2xl border border-line bg-surface p-4 shadow-card";
