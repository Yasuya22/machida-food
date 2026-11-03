import type { IconName } from "@/components/ui/Icon";

/** 下部メニューの並び（CLAUDE.md：ホーム／探す／お得／特典／マイページ） */
export const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/search", label: "探す", icon: "search" },
  { href: "/deals", label: "お得", icon: "tag" },
  { href: "/rewards", label: "特典", icon: "gift" },
  { href: "/mypage", label: "マイページ", icon: "user" },
];
