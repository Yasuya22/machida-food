/**
 * ランクと着せ替えの判定（画面用。DB側の rank_of / owns_cosmetic と同じ考え方）
 * - ランクは累計獲得ポイントで決まり、交換で使っても下がらない
 * - 招待制のランク（ブラック）はポイントでは到達しない
 * このファイルは他のファイルを読み込まない（自動テストを単体で動かすため）。
 */

export type Rank = {
  id: string;
  name: string;
  animal: string;
  min_points: number | null;
  invite_only: boolean;
  point_rate: number;
  image_path: string | null;
  sort: number;
};

export type Cosmetic = {
  id: string;
  kind: "title" | "frame" | "outfit";
  name: string;
  image_path: string | null;
  color: string | null;
  unlock_rank_id: string | null;
  sort: number;
};

export function rankFor(ranks: Rank[], earned: number): Rank | null {
  return (
    [...ranks]
      .filter((r) => !r.invite_only && r.min_points !== null && r.min_points <= earned)
      .sort((a, b) => (b.min_points ?? 0) - (a.min_points ?? 0))[0] ?? null
  );
}

/** 次のランクと、あと何ポイントか（招待制は対象外） */
export function nextRank(ranks: Rank[], earned: number): { rank: Rank; remaining: number } | null {
  const next = [...ranks]
    .filter((r) => !r.invite_only && r.min_points !== null && r.min_points > earned)
    .sort((a, b) => (a.min_points ?? 0) - (b.min_points ?? 0))[0];
  return next ? { rank: next, remaining: (next.min_points ?? 0) - earned } : null;
}

/** 使える（手に入れた・ランクで解放された）着せ替えか */
export function isUnlocked(c: Cosmetic, owned: Set<string>, ranks: Rank[], current: Rank | null): boolean {
  if (owned.has(c.id)) return true;
  if (!c.unlock_rank_id || !current) return false;
  const need = ranks.find((r) => r.id === c.unlock_rank_id);
  return !!need && need.sort <= current.sort;
}

/** 表示するキャラクター画像。衣装の画像に {rank} があれば、いまのランクの番号に置き換える */
export function characterImage(rank: Rank | null, outfit: Cosmetic | null): string | null {
  if (outfit?.image_path && rank) return outfit.image_path.replaceAll("{rank}", String(rank.sort));
  return rank?.image_path ?? null;
}
