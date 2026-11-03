import { test } from "node:test";
import assert from "node:assert/strict";
import { characterImage, isUnlocked, nextRank, rankFor, type Cosmetic, type Rank } from "./rank.ts";

const r = (sort: number, name: string, min: number | null, invite = false): Rank => ({
  id: `r${sort}`, name, animal: "", min_points: min, invite_only: invite, point_rate: 1, image_path: `/characters/rank-${sort}.webp`, sort,
});
const ranks = [r(0, "ブロンズ", 0), r(1, "シルバー", 1000), r(2, "ゴールド", 3000), r(3, "プラチナ", 6000), r(4, "ブラック", null, true)];

test("ランクは累計獲得ポイントで決まる（招待制には到達しない）", () => {
  assert.equal(rankFor(ranks, 0)?.name, "ブロンズ");
  assert.equal(rankFor(ranks, 2999)?.name, "シルバー");
  assert.equal(rankFor(ranks, 3000)?.name, "ゴールド");
  assert.equal(rankFor(ranks, 999999)?.name, "プラチナ");
});

test("次のランクまでのポイント", () => {
  assert.deepEqual(nextRank(ranks, 2600), { rank: ranks[2], remaining: 400 });
  assert.equal(nextRank(ranks, 7000), null);
});

test("着せ替え：持っているもの・ランクで解放されたものだけ使える", () => {
  const gold: Cosmetic = { id: "c1", kind: "frame", name: "ゴールドの枠", image_path: null, color: null, unlock_rank_id: "r2", sort: 3 };
  const black: Cosmetic = { ...gold, id: "c2", name: "黒龍の枠", unlock_rank_id: "r4" };
  const chef: Cosmetic = { ...gold, id: "c3", kind: "outfit", name: "コック衣装", unlock_rank_id: null };
  const silver = rankFor(ranks, 1500);
  assert.equal(isUnlocked(gold, new Set(), ranks, silver), false);
  assert.equal(isUnlocked(gold, new Set(), ranks, rankFor(ranks, 3000)), true);
  assert.equal(isUnlocked(black, new Set(), ranks, rankFor(ranks, 999999)), false);
  assert.equal(isUnlocked(chef, new Set(["c3"]), ranks, silver), true);
});

test("キャラクター画像：衣装の {rank} をいまのランクに置き換える", () => {
  const chef: Cosmetic = { id: "c3", kind: "outfit", name: "コック衣装", image_path: "/characters/chef-{rank}.webp", color: null, unlock_rank_id: null, sort: 2 };
  assert.equal(characterImage(rankFor(ranks, 3500), chef), "/characters/chef-2.webp");
  assert.equal(characterImage(rankFor(ranks, 3500), null), "/characters/rank-2.webp");
});
