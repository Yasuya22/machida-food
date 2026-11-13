/**
 * 店舗の画像。写真が登録されていれば写真、なければジャンルの色と店名の1文字目で作った仮の絵。
 * デモの架空5店舗は AI 生成のイメージ写真（public/demo/）を使い、「イメージ」と表示する。実際の写真は店舗設定から登録する。
 */
import { isDemoImage, publicImageUrl } from "@/lib/images";

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

const BOX = {
  md: "h-20 w-20 shrink-0 rounded-md",
  card: "h-44 w-full",
  lg: "h-56 w-full",
} as const;

export function StoreThumb({ name, genre, cover, size = "md" }: { name: string; genre: string; cover?: string | null; size?: keyof typeof BOX }) {
  const url = publicImageUrl(cover);
  if (url) {
    // デモ用のイメージ写真（public/demo/）には「イメージ」と表示する（実際の料理と誤解されないように）
    const demo = isDemoImage(cover);
    return (
      <div className={`relative overflow-hidden ${BOX[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        {demo ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-2 py-0.5 text-xs text-white">イメージ</span> : null}
      </div>
    );
  }
  const big = size !== "md";
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${toneFor(genre)} ${BOX[size]}`} aria-hidden="true">
      {/* 濃淡・細い金の線と円で、写真が入るまでも上品に見せる */}
      <span className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/35" />
      <span className="absolute inset-2 rounded-[inherit] border border-accent-bright/35" />
      {big ? <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-accent-bright/20" /> : null}
      {big ? <span className="absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-white/5" /> : null}
      <span className={`relative font-display font-bold text-on-brand ${big ? "text-6xl" : "text-3xl"}`}>{initial(name)}</span>
      {big ? <span className="absolute bottom-3 right-4 text-xs tracking-[0.3em] text-accent-bright/90">{genre}</span> : null}
    </div>
  );
}
