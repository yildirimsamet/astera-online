import { describe, expect, it } from 'vitest';
import type { RewardChainView } from '../src/api/schemas.js';
import { freshestWreck, nextRewardGoal as pick, probeTarget, rewardGate } from '../src/lib/rewardGates.js';

const nextRewardGoal = (chains: RewardChainView[]) => { const goal = pick(chains); return goal && { id: goal.chain.id, left: goal.left }; };

type State = 'locked' | 'claimable' | 'claimed';
const chain = (id: string, metric: string, progress: number, tiers: [number, number, State][]): RewardChainView => ({
  id, metric, scope: 'season', progress, tiers: tiers.map(([goal, alloy, state]) => ({ id: `${id}:${String(goal)}`, goal, alloy, crystal: 0, state })),
});

/** WHERE A GOAL IS PLAYED (plan 2026-11-06 §7.1): each chain names the place that moves it. */
describe('where each reward goal is played', () => {
  it('sends an action to the map and a building to its own row', () => {
    expect(rewardGate('PROBE')).toEqual({ kind: 'probe' });
    expect(rewardGate('MINE')).toEqual({ kind: 'mine' });
    expect(rewardGate('SALVAGE')).toEqual({ kind: 'salvage' });
    expect(rewardGate('PIRATE')).toEqual({ kind: 'pirate' });
    expect(rewardGate('RAID')).toEqual({ kind: 'intel' });
    expect(rewardGate('REFINERY')).toEqual({ kind: 'build', group: 'grow', item: 'REFINERY' });
    expect(rewardGate('AEGIS')).toEqual({ kind: 'build', group: 'defend', item: 'AEGIS' });
    expect(rewardGate('SHIPS')).toEqual({ kind: 'build', group: 'reach', item: 'SHIPYARD' });
    expect(rewardGate('SOCIAL')).toBeNull();
  });
});

describe('the next reward goal', () => {
  it('names the action closest to its next tier, the bigger prize on a tie', () => {
    const goals = [
      chain('PROBE', 'count', 1, [[1, 100, 'claimed'], [3, 200, 'locked']]),
      chain('MINE', 'count', 0, [[2, 300, 'locked']]),
      chain('RAID', 'count', 0, [[4, 150, 'locked']]),
      chain('CORE', 'level', 3, [[4, 900, 'locked']]),
    ];
    expect(nextRewardGoal(goals)).toEqual({ id: 'MINE', left: 2 });
    expect(nextRewardGoal([goals[0]!, goals[2]!])).toEqual({ id: 'PROBE', left: 2 });
    expect(nextRewardGoal([chain('RAID', 'count', 0, [[1, 150, 'locked']]), chain('PIRATE', 'count', 0, [[1, 400, 'locked']])])).toEqual({ id: 'PIRATE', left: 1 });
  });

  it('falls back to the building with the fewest levels to go', () => {
    expect(nextRewardGoal([chain('CORE', 'level', 3, [[5, 900, 'locked']]), chain('VAULT', 'level', 0, [[1, 200, 'locked']])])).toEqual({ id: 'VAULT', left: 1 });
  });

  it('says nothing while a tier is waiting, or when every goal is met', () => {
    expect(nextRewardGoal([chain('PROBE', 'count', 1, [[1, 100, 'claimable'], [3, 200, 'locked']])])).toBeNull();
    expect(nextRewardGoal([chain('PROBE', 'count', 3, [[1, 100, 'claimed'], [3, 200, 'claimed']])])).toBeNull();
  });
});

describe('the place a gate opens', () => {
  const at = (x: number) => ({ x, y: 0, z: 0 });
  it('probes the nearest commander world not yet seen, else the nearest commander world', () => {
    const worlds = [
      { id: 'me', isSelf: true, kind: 'CAPITAL' as const, intel: 'UNKNOWN' as const, position: at(0) },
      { id: 'free', isSelf: false, kind: 'NEUTRAL' as const, intel: 'UNKNOWN' as const, position: at(1) },
      { id: 'seen', isSelf: false, kind: 'CAPITAL' as const, intel: 'RESOLVED' as const, position: at(2) },
      { id: 'dark', isSelf: false, kind: 'COLONY' as const, intel: 'UNKNOWN' as const, position: at(9) },
    ];
    expect(probeTarget(worlds, at(0))).toBe('dark');
    expect(probeTarget(worlds.filter(world => world.id !== 'dark'), at(0))).toBe('seen');
    expect(probeTarget([worlds[0]!], at(0))).toBeNull();
  });

  it('salvages the freshest wreck', () => {
    expect(freshestWreck([{ id: 'old', minutesLeft: 10 }, { id: 'new', minutesLeft: 80 }])).toBe('new');
    expect(freshestWreck([])).toBeNull();
  });
});
