import type { MetadataRoute } from "next";
import { BRANDS, currentBrand } from "@/config/brand";

// スマホの「ホーム画面に追加」用の設定（PWA）
export default function manifest(): MetadataRoute.Manifest {
  const brand = BRANDS[currentBrand()];
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: brand.themeColor,
    background_color: brand.bgColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
