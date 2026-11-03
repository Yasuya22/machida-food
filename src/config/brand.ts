/**
 * ブランドの切り替え。色はトークン（globals.css）、ここは名前など文字の設定だけ。
 * NIGHT は Phase 4 まで使わない（指示があるまで実装しない）。
 */
export type Brand = "food" | "night";

export const BRANDS: Record<Brand, { name: string; tagline: string; themeColor: string; bgColor: string }> = {
  food: {
    name: "MACHIDA FOOD",
    tagline: "町田の、いいお店に出会う",
    themeColor: "#1f4a36",
    bgColor: "#f6f2e8",
  },
  night: {
    name: "MACHIDA NIGHT",
    tagline: "",
    themeColor: "#141b2e",
    bgColor: "#0b0d14",
  },
};

export function currentBrand(): Brand {
  return process.env.NEXT_PUBLIC_BRAND === "night" ? "night" : "food";
}
