import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { cardClass } from "@/components/ui/Flash";
import { getSession } from "@/lib/auth";
import { minutesToLabel, tokyoNow } from "@/lib/stores/status";

export const metadata: Metadata = { title: "特典" };
export const dynamic = "force-dynamic";

type Card = { store_id: string; store_name: string; stamp_goal: number; stamp_reward: string | null; total_stamps: number; current_stamps: number };
type Reward = { id: string; title: string; issued_at: string; used_at: string | null; stores: { name: string } | null };
type MyCoupon = { coupon_id: string; coupons: { title: string; conditions: string | null; ends_at: string | null; store_id: string; stores: { name: string } | null } | null };
type Ledger = { id: string; delta: number; reason: string; created_at: string };

function dateLabel(iso: string) {
  const t = tokyoNow(new Date(iso));
  const [, m, d] = t.ymd.split("-");
  return `${Number(m)}/${Number(d)} ${minutesToLabel(t.minutes)}`;
}

export default async function RewardsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <main>
        <PageHeader title="特典" lead="スタンプと町田ポイント" />
        <div className="mx-auto max-w-md px-4 py-6">
          <div className={`${cardClass} text-center`}>
            <p className="font-display text-lg font-bold">ログインすると使えます</p>
            <p className="mt-1 text-sm text-muted">お店ごとのスタンプカード、たまった特典、町田ポイントの履歴。</p>
            <Link href="/login?next=/rewards" className="mt-4 block rounded-xl bg-brand py-3 text-sm font-bold text-on-brand">ログイン・会員登録</Link>
          </div>
        </div>
      </main>
    );
  }
  const db = session.supabase;
  const { data: profile } = await db.from("profiles").select("user_id").eq("user_id", session.userId).maybeSingle();
  if (!profile) redirect("/register?next=/rewards");

  const [cards, rewards, coupons, used, ledger] = await Promise.all([
    db.from("my_stamp_cards").select("store_id,store_name,stamp_goal,stamp_reward,total_stamps,current_stamps").eq("user_id", session.userId).returns<Card[]>(),
    db.from("stamp_rewards").select("id,title,issued_at,used_at,stores(name)").eq("user_id", session.userId).order("issued_at", { ascending: false }).returns<Reward[]>(),
    db.from("user_coupons").select("coupon_id,coupons(title,conditions,ends_at,store_id,stores(name))").eq("user_id", session.userId).returns<MyCoupon[]>(),
    db.from("coupon_redemptions").select("coupon_id").eq("user_id", session.userId).returns<{ coupon_id: string }[]>(),
    db.from("point_ledger").select("id,delta,reason,created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(30).returns<Ledger[]>(),
  ]);
  const usedSet = new Set((used.data ?? []).map((u) => u.coupon_id));
  const now = Date.now();
  const myCoupons = (coupons.data ?? []).filter((c) => c.coupons && !usedSet.has(c.coupon_id) && (!c.coupons.ends_at || Date.parse(c.coupons.ends_at) > now));

  return (
    <main>
      <PageHeader title="特典" lead="スタンプと町田ポイント" />
      <div className="mx-auto max-w-md space-y-8 px-4 py-6">
        <Section title="スタンプカード" isEmpty={(cards.data ?? []).length === 0} empty="まだスタンプはありません。お店で会員証を見せるとたまります（1店舗1日1回）。">
          <div className="space-y-3">
            {(cards.data ?? []).map((c) => (
              <Link key={c.store_id} href={`/stores/${c.store_id}`} className={`${cardClass} block`}>
                <div className="flex items-baseline justify-between">
                  <p className="font-bold">{c.store_name}</p>
                  <p className="text-xs text-muted">{c.current_stamps} / {c.stamp_goal}</p>
                </div>
                <div className="mt-2 grid grid-cols-10 gap-1" aria-label={`${c.stamp_goal}個中${c.current_stamps}個`}>
                  {Array.from({ length: c.stamp_goal }, (_, i) => (
                    <span key={i} className={`aspect-square rounded-full border ${i < c.current_stamps ? "border-accent bg-accent-bright" : "border-line"}`} />
                  ))}
                </div>
                {c.stamp_reward ? <p className="mt-2 text-xs text-muted">たまると「{c.stamp_reward}」・これまでの来店 {c.total_stamps}回</p> : null}
              </Link>
            ))}
          </div>
        </Section>

        <Section title="もらった特典" isEmpty={(rewards.data ?? []).length === 0 && myCoupons.length === 0} empty="使える特典はまだありません。">
          <div className="space-y-2">
            {myCoupons.map((c) => (
              <div key={c.coupon_id} className="relative overflow-hidden rounded-2xl border border-accent-bright/60 bg-surface p-4 shadow-card">
                <span className="absolute inset-y-0 left-0 w-1.5 bg-accent-bright" aria-hidden="true" />
                <p className="font-bold">{c.coupons!.title}</p>
                <p className="text-xs text-muted">{c.coupons!.stores?.name}{c.coupons!.conditions ? `・${c.coupons!.conditions}` : ""}</p>
                <p className="mt-1 text-[11px] text-muted">お会計のときに会員証を見せてください（お店の方が確定します）。</p>
              </div>
            ))}
            {(rewards.data ?? []).map((r) => (
              <div key={r.id} className={`${cardClass} ${r.used_at ? "opacity-60" : ""}`}>
                <p className="font-bold">{r.title}</p>
                <p className="text-xs text-muted">{r.stores?.name}・スタンプ特典・{dateLabel(r.issued_at)}{r.used_at ? "・使用済み" : ""}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="町田ポイントの履歴" isEmpty={(ledger.data ?? []).length === 0} empty="まだ履歴はありません。">
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
            {(ledger.data ?? []).map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p>{l.reason}</p>
                  <p className="text-[11px] text-muted">{dateLabel(l.created_at)}</p>
                </div>
                <span className={`font-bold ${l.delta > 0 ? "text-ok" : "text-full"}`}>{l.delta > 0 ? "+" : ""}{l.delta}pt</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted">町田ポイントは換金・購入はできません。ポイント交換は今後追加します。</p>
        </Section>
      </div>
    </main>
  );
}
