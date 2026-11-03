/**
 * 店舗の仮画像（写真の代わり）。ジャンル名から色を自動で決め、店名の1文字目を置く。
 * 架空店舗のため写真は使わない。写真の登録は「5. オーナー・運営画面」で追加する。
 */
import { publicImageUrl } from "@/lib/images";

const TONES = ["bg-tone-1", "bg-tone-2", "bg-tone-3", "bg-tone-4", "bg-tone-5"] as const;

function toneFor(genre: string): string {
  let h = 0;
  for (const ch of genre) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TONES[h % TONES.length] ?? TONES[0];
}

function initial(name: string): string {
  // 「炭火焼肉 まちだ苑」→「ま」のように、肩書き（最初の空白まで）を飛ばす
  const main = name.includes(" ") ? name.slice(name.indexOf(" ") + 1) : name;
  return [...main.trim()][0] ?? "・";
}

export function StoreThumb({ name, genre, cover, size = "md" }: { name: string; genre: string; cover?: string | null; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-40 w-full rounded-none" : "h-16 w-16 shrink-0 rounded-xl";
  const url = publicImageUrl(cover);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${box} object-cover`} loading="lazy" />;
  }
  const text = size === "lg" ? "text-6xl" : "text-2xl";
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${box} ${toneFor(genre)}`} aria-hidden="true">
      <span className="absolute inset-1.5 rounded-[inherit] border border-accent-bright/40" />
      <span className={`font-display font-bold text-on-brand ${text}`}>{initial(name)}</span>
    </div>
  );
}
