import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import { BRANDS, currentBrand } from "@/config/brand";
import "./globals.css";

const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans-jp", display: "swap" });
const serif = Noto_Serif_JP({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-serif-jp", display: "swap" });

const brand = BRANDS[currentBrand()];

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s｜${brand.name}` },
  description: `${brand.tagline}。町田駅周辺の飲食店の空席・クーポン・スタンプ。`,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  robots: { index: false, follow: false },
  icons: { icon: "/icons/favicon-48.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: brand.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-brand={currentBrand()} className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
