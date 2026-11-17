import type { RewardChainId } from '@astera/rules';
import type { RewardChainView } from '../api/schemas.js';
import type { PlanetGroup } from './directives.js';

/**
 * WHERE A REWARD GOAL IS PLAYED (plan 2026-11-06 §7.1 R6). The panel showed what a goal pays and not where
 * to go for it; each chain now names the place that moves it: the map for an act, its row for a building.
 */
export type RewardGate =
  | { kind: 'probe' | 'mine' | 'salvage' | 'pirate' | 'intel' }
  | { kind: 'build'; group: PlanetGroup; item: string };

const GATES: Record<RewardChainId, RewardGate | null> = {
  PROBE: { kind: 'probe' },
  MINE: { kind: 'mine' },
  SALVAGE: { kind: 'salvage' },
  PIRATE: { kind: 'pirate' },
  RAID: { kind: 'intel' },
  CORE: { kind: 'build', group: 'grow', item: 'CORE' },
  REFINERY: { kind: 'build', group: 'grow', item: 'REFINERY' },
  EXTRACTOR: { kind: 'build', group: 'grow', item: 'EXTRACTOR' },
  VAULT: { kind: 'build', group: 'grow', item: 'VAULT' },
  AEGIS: { kind: 'build', group: 'defend', item: 'AEGIS' },
  SHIPYARD: { kind: 'build', group: 'reach', item: 'SHIPYARD' },
  // Ships are built in the yard.
  SHIPS: { kind: 'build', group: 'reach', item: 'SHIPYARD' },
  SOCIAL: null,
};

export const rewardGate = (chain: RewardChainId): RewardGate | null => GATES[chain];

const ACTS: readonly string[] = ['PROBE', 'MINE', 'SALVAGE', 'PIRATE', 'RAID'];

/**
 * THE NEXT GOAL, DETERMINISTIC (§7.1). Nothing while a tier is waiting: the pod says that. Otherwise the act
 * closest to its next tier (the bigger prize on a tie), else the building with the fewest levels to go.
 */
export function nextRewardGoal<T extends RewardChainView>(chains: readonly T[]): { chain: T; left: number } | null {
  if (chains.some(chain => chain.tiers.some(tier => tier.state === 'claimable'))) return null;
  const open = chains.flatMap(chain => {
    const next = chain.tiers.find(tier => tier.state === 'locked');
    return next && chain.metric !== 'grant' ? [{ chain, left: Math.max(1, next.goal - chain.progress), prize: next.alloy + next.crystal, act: ACTS.includes(chain.id) }] : [];
  });
  const pool = open.some(goal => goal.act) ? open.filter(goal => goal.act) : open;
  const best = [...pool].sort((a, b) => a.left - b.left || b.prize - a.prize)[0];
  return best ? { chain: best.chain, left: best.left } : null;
}

interface Point { x: number; y: number; z: number }
interface Seen { id: string; isSelf: boolean; kind?: 'CAPITAL' | 'COLONY' | 'NEUTRAL' | undefined; intel: 'RESOLVED' | 'REMEMBERED' | 'UNKNOWN'; position: Point }

/** A probe goal's world: the nearest commander world not yet seen, else the nearest commander world. */
export function probeTarget(worlds: readonly Seen[], from: Point | undefined): string | null {
  if (!from) return null;
  const commanders = worlds.filter(world => !world.isSelf && world.kind !== 'NEUTRAL');
  const pool = commanders.some(world => world.intel === 'UNKNOWN') ? commanders.filter(world => world.intel === 'UNKNOWN') : commanders;
  const distance = (world: Seen) => Math.hypot(world.position.x - from.x, world.position.y - from.y, world.position.z - from.z);
  return [...pool].sort((a, b) => distance(a) - distance(b))[0]?.id ?? null;
}

/** A salvage goal's wreck: the one with the longest left to it. */
export function freshestWreck(wrecks: readonly { id: string; minutesLeft: number }[]): string | null {
  return [...wrecks].sort((a, b) => b.minutesLeft - a.minutesLeft)[0]?.id ?? null;
}

/** The nearest pirate a launch from here can reach (a pirate goal, a first hunt on landing). */
export function nearestPirate(pirates: readonly { id: string; reachMinutes: number | null }[] | undefined): { id: string; minutes: number } | null {
  let best: { id: string; minutes: number } | null = null;
  for (const pirate of pirates ?? []) {
    if (pirate.reachMinutes === null) continue;
    if (!best || pirate.reachMinutes < best.minutes) best = { id: pirate.id, minutes: pirate.reachMinutes };
  }
  return best;
}
