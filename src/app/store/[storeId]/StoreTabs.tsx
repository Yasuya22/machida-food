"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export type StoreTab = { href: string; label: string; icon: IconName; main?: boolean };

/**
 * 店舗管理のメニュー。よく使う3つ（来店処理・空席更新・セール登録）は大きなボタン、
 * 記録・店舗設定は小さく並べる。
 */
export function StoreTabs({ tabs }: { tabs: StoreTab[] }) {
  const pathname = usePathname();
  const main = tabs.filter((t) => t.main);
  const sub = tabs.filter((t) => !t.main);
  return (
    <nav aria-label="店舗管理メニュー" className="mt-4 space-y-2 pb-4">
      <div className="grid grid-cols-3 gap-2">
        {main.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-[15px] font-bold transition-colors ${
                active ? "bg-accent-bright text-brand shadow-card" : "bg-on-brand/10 text-on-brand"
              }`}
            >
              <Icon name={t.icon} className="h-7 w-7" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="flex gap-2">
        {sub.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${
                active ? "bg-on-brand text-brand" : "border border-on-brand-soft/40 text-on-brand-soft"
              }`}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
