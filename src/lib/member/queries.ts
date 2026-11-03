import "server-only";
import type { Session } from "@/lib/auth";
import { isUnlocked, nextRank, rankFor, type Cosmetic, type Rank } from "./rank";

export type Profile = {
  member_seq: number;
  nickname: string;
  birth_month: number | null;
  adult_confirmed_at: string | null;
  equipped_title_id: string | null;
  equipped_frame_id: string | null;
  equipped_outfit_id: string | null;
};

export type MemberView = {
  profile: Profile;
  balance: number;
  earned: number;
  ranks: Rank[];
  rank: Rank | null;
  next: { rank: Rank; remaining: number } | null;
  cosmetics: (Cosmetic & { unlocked: boolean })[];
  equipped: { title: Cosmetic | null; frame: Cosmetic | null; outfit: Cosmetic | null };
};

/** マイページ用：プロフィール・ポイント・ランク・着せ替え。未登録なら null */
export async function loadMember(s: Session): Promise<MemberView | null> {
  const [profile, points, ranks, cosmetics, owned] = await Promise.all([
    s.supabase
      .from("profiles")
      .select("member_seq,nickname,birth_month,adult_confirmed_at,equipped_title_id,equipped_frame_id,equipped_outfit_id")
      .eq("user_id", s.userId)
      .maybeSingle(),
    s.supabase.from("my_points").select("balance,earned").eq("user_id", s.userId).maybeSingle(),
    s.supabase.from("ranks").select("id,name,animal,min_points,invite_only,point_rate,image_path,sort").order("sort").returns<Rank[]>(),
    s.supabase.from("cosmetics").select("id,kind,name,image_path,color,unlock_rank_id,sort").order("sort").returns<Cosmetic[]>(),
    s.supabase.from("user_cosmetics").select("cosmetic_id").eq("user_id", s.userId).returns<{ cosmetic_id: string }[]>(),
  ]);
  if (!profile.data) return null;

  const p = profile.data as Profile;
  const pts = (points.data ?? { balance: 0, earned: 0 }) as { balance: number; earned: number };
  const rankList = (ranks.data ?? []).map((r) => ({ ...r, point_rate: Number(r.point_rate) }));
  const rank = rankFor(rankList, pts.earned);
  const ownedSet = new Set((owned.data ?? []).map((o) => o.cosmetic_id));
  const list = (cosmetics.data ?? []).map((c) => ({ ...c, unlocked: isUnlocked(c, ownedSet, rankList, rank) }));
  const find = (id: string | null) => list.find((c) => c.id === id) ?? null;

  return {
    profile: p,
    balance: pts.balance,
    earned: pts.earned,
    ranks: rankList,
    rank,
    next: nextRank(rankList, pts.earned),
    cosmetics: list,
    equipped: { title: find(p.equipped_title_id), frame: find(p.equipped_frame_id), outfit: find(p.equipped_outfit_id) },
  };
}
