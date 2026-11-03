import type { Metadata, Viewport } from "next";
import { BRANDS, currentBrand } from "@/config/brand";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";


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
    <html lang="ja" data-brand={currentBrand()}>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
