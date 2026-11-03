"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function StoreTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="店舗管理メニュー" className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-t-xl px-4 py-2.5 text-sm font-bold ${active ? "bg-bg text-brand" : "text-on-brand-soft"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
