/**
 * MACHIDA FOOD のロゴ（運営者支給のリスのシェフ。2026-11-13）
 * - ロゴ全体：public/brand/logo.webp（横600px）・logo-sm.webp（横300px）。背景は透明
 * - 顔だけの丸いマーク：public/brand/mark.webp（各画面の見出し・アプリのアイコンと同じ絵）
 * 元画像から作り直すときは、背景を透明にしてこのサイズで書き出す
 */
/* eslint-disable @next/next/no-img-element */

export function BrandLogo({ name, className = "w-28" }: { name: string; className?: string }) {
  return <img src="/brand/logo-sm.webp" alt={name} width={300} height={333} className={`h-auto ${className}`} />;
}

export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return <img src="/brand/mark.webp" alt="" width={192} height={192} className={`rounded-full ${className}`} aria-hidden="true" />;
}
