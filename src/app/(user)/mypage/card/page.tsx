import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { requireSession } from "@/lib/auth";
import { loadMember } from "@/lib/member/queries";
import { MemberQr } from "./MemberQr";

export const metadata: Metadata = { title: "会員証" };
export const dynamic = "force-dynamic";

export default async function CardPage() {
  const session = await requireSession("/mypage/card");
  const member = await loadMember(session);
  if (!member) redirect("/register?next=/mypage/card");

  return (
    <main className="min-h-dvh bg-brand text-on-brand">
      <div className="mx-auto max-w-md px-4 pb-10 pt-[calc(env(safe-area-inset-top)+16px)]">
        <Link href="/mypage" className="inline-flex items-center gap-1 text-sm text-on-brand-soft">
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          マイページ
        </Link>
        <div className="mt-6 rounded-lg border border-accent-bright/60 bg-surface p-6 text-ink shadow-card">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold tracking-[0.3em] text-accent">MEMBER CARD</p>
            <p className="text-xs text-muted">{member.rank ? `${member.rank.name}ランク` : ""}</p>
          </div>
          <p className="mt-1 font-display text-xl font-bold">{member.profile.nickname}</p>
          <div className="mt-5">
            <MemberQr />
          </div>
          <p className="mt-5 text-center text-xs text-muted">お会計のときに、この画面をお店の方に見せてください。</p>
        </div>
        <ul className="mt-6 space-y-1 text-xs text-on-brand-soft">
          <li>・QRコードには個人情報は入っていません（30秒ごとに切り替わる使い捨ての番号です）。</li>
          <li>・スクリーンショットは期限が切れると使えません。</li>
          <li>・来店スタンプは1店舗につき1日1回です。</li>
        </ul>
      </div>
    </main>
  );
}
