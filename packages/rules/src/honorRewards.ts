import { honorInteger, honorNumber } from './honor.js';
import { seasonRankRewardProgram } from './seasonRankRewards.js';
import type { Resources } from './types.js';

export function honorResourceValue(r: Resources): number {
  return honorNumber(honorInteger(r.alloy) + 2n * honorInteger(r.crystal) + 32n * honorInteger(r.deuterium));
}

/** Nominal package is already doubled and, if applicable, split across tied ranks. */
export function honorReward(nominal: Resources, microHonor: number): Resources {
  const value = BigInt(honorResourceValue(nominal)), score = honorInteger(microHonor, true);
  const budget = score > 0n ? 200n * score / 1_000_000n : 0n;
  const numerator = budget < value ? budget : value;
  const component = (n: number): number => value === 0n ? 0 : honorNumber(BigInt(n) * numerator / value);
  return { alloy: component(nominal.alloy), crystal: component(nominal.crystal), deuterium: component(nominal.deuterium) };
}

export interface HonorRankReward {
  actor: string;
  honor: number;
  rank: number;
  nominal: Resources;
  reward: Resources;
}

/** Competition rank: 1,1,3. Identity sorts display only and cannot choose a better prize. */
export function honorRankRewards(entries: readonly { actor: string; honor: number }[]): HonorRankReward[] {
  const seen = new Set<string>();
  for (const row of entries) {
    honorInteger(row.honor, true);
    if (!row.actor || seen.has(row.actor)) throw new Error('Invalid Honor ranking identity');
    seen.add(row.actor);
  }
  const sorted = [...entries].sort((a, b) => a.honor > b.honor ? -1 : a.honor < b.honor ? 1 : a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0);
  const program = seasonRankRewardProgram(1);
  if (!program) throw new Error('Missing frozen Honor reward basis');
  const result: HonorRankReward[] = [];
  for (let start = 0; start < sorted.length;) {
    const first = sorted[start];
    if (!first) break;
    let end = start + 1;
    while (sorted[end]?.honor === first.honor) end++;
    const tiers = program.tiers.filter(t => t.place > start && t.place <= end);
    const count = BigInt(end - start);
    const component = (key: keyof Resources): number => honorNumber(tiers.reduce((n, tier) => n + 2n * BigInt(tier.reward[key]), 0n) / count);
    const nominal = { alloy: component('alloy'), crystal: component('crystal'), deuterium: component('deuterium') };
    for (const row of sorted.slice(start, end)) {
      result.push({ ...row, rank: start + 1, nominal, reward: honorReward(nominal, row.honor) });
    }
    start = end;
  }
  return result;
}

/** Preserves the old Dominion entitlement; never adds the two resource packages. */
export function selectSeasonReward(dominion: Resources, honor: Resources): { ranking: 'DOMINION' | 'HONOR'; reward: Resources } {
  return honorResourceValue(honor) > honorResourceValue(dominion)
    ? { ranking: 'HONOR', reward: { ...honor } }
    : { ranking: 'DOMINION', reward: { ...dominion } };
}
