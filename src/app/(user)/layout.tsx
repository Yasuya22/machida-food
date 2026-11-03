import { BottomNav } from "@/components/ui/BottomNav";

/** 一般利用者向けの画面（下部メニューつき） */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </>
  );
}
