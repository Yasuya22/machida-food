"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";
import { Icon } from "./Icon";

/**
 * 一般利用者の下部メニュー（ホーム／探す／お得／特典／マイページ）
 * 親指で押しやすいよう、1つのボタンを高さ64px・アイコン24px・文字12pxにしている。
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインメニュー" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
      <ul className="mx-auto grid max-w-md grid-cols-5 rounded-2xl border border-line/70 bg-surface/95 shadow-[0_8px_30px_rgb(30_43_36/0.14)] backdrop-blur">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {active ? <span className="absolute top-1.5 h-1 w-6 rounded-full bg-accent-bright" aria-hidden="true" /> : null}
                <Icon name={item.icon} className="h-6 w-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
