"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";
import { Icon } from "./Icon";

/**
 * 一般利用者の下部メニュー（ホーム／探す／お得／特典／マイページ）
 * 親指で押しやすいよう、1つのボタンを高さ64px・アイコン24px・文字12pxにしている。
 * 浮いたガラス風ではなく、画面の下にしっかり付いた帯にする（選んでいる項目は上に金の線）。
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインメニュー" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                {active ? <span className="absolute inset-x-3 top-0 h-[3px] bg-accent-bright" aria-hidden="true" /> : null}
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
