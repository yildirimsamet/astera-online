import { describe, expect, it } from 'vitest';
import type { Contact, PendingThread } from '../src/api/schemas.js';
import {
  DEATH_STAR_IMPACT_MS,
  deathStarBurstLayout,
  deathStarImpactCandidates,
  isDeathStarImpactVisible,
} from '../src/galaxy/DeathStarImpact.js';
import { toWorld, type PlanetNode } from '../src/galaxy/scene.js';

/** Where the strike lands, in GAME units. Everything world-unit is derived from it. */
const TARGET = { x: 100, y: 100, z: 300 };


const nodes: PlanetNode[] = [{
  id: 'target',
  name: 'Target',
  owner: 'Commander',
  position: toWorld(TARGET),
  radius: 1.4,
  weight: 3,
  satellites: [],
  shielded: false,
  stance: 'dark',
  state: { kind: 'NORMAL' },
  kind: 'COLONY',
  isOwned: false,
  isCapital: false,
}];

const path = {
  from: { x: 0, y: 0, z: 0 },
  // The expected position is DERIVED with `toWorld` rather than written out: the
  // game-unit-to-world-unit divisor is `SCALE`, and it moves whenever the design
  // distances do. A hand-computed triple silently becomes wrong on that day.
  to: TARGET,
  departAt: new Date(1_000),
  arriveAt: new Date(10_000),
};

describe('the public Death Star impact', () => {
  it('builds a stable but mission-specific multi-lobe explosion', () => {
    const first = deathStarBurstLayout('mission-a');
    expect(first).toHaveLength(22);
    expect(deathStarBurstLayout('mission-a')).toEqual(first);
    expect(deathStarBurstLayout('mission-b')).not.toEqual(first);
    expect(first[0]?.delay).toBe(0);
    for (const lobe of first) {
      expect(lobe.offset.every(Number.isFinite)).toBe(true);
      expect(lobe.delay).toBeGreaterThanOrEqual(0);
      expect(lobe.delay).toBeLessThan(0.18);
      expect(lobe.size).toBeGreaterThan(0);
      expect(lobe.drift).toBeGreaterThan(0);
    }
  });

  it('uses an owned mission exact arrival and the target world scale', () => {
    const pending: PendingThread[] = [{
      id: 'mission-1',
      kind: 'death_star',
      targetName: 'Target',
      minutesRemaining: 1,
      arriveAt: path.arriveAt,
      leg: 'outbound',
      path,
    }];
    expect(deathStarImpactCandidates(pending, [], nodes)).toEqual([{
      id: 'mission-1',
      at: 10_000,
      position: toWorld(path.to),
      radius: 1.4,
    }]);
  });

  it('only treats a foreign destination-clamped window as an impact', () => {
    const base: Contact = {
      id: 'foreign',
      kind: 'death_star',
      from: { x: 0, y: 0, z: 0 },
      to: path.to,
      startAt: new Date(9_000),
      endAt: path.arriveAt,
    };
    expect(deathStarImpactCandidates([], [base], nodes)).toEqual([]);
    expect(deathStarImpactCandidates([], [{ ...base, landing: true }], nodes)).toEqual([{
      id: 'foreign',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
    }]);
  });

  it('deduplicates the same mission and orders same-millisecond impacts by id', () => {
    const contacts: Contact[] = ['z-impact', 'a-impact'].map((id) => ({
      id,
      kind: 'death_star' as const,
      from: path.from,
      to: path.to,
      startAt: new Date(9_000),
      endAt: path.arriveAt,
      landing: true,
    }));
    expect(deathStarImpactCandidates([], contacts, nodes).map((event) => event.id)).toEqual([
      'a-impact',
      'z-impact',
    ]);
  });

  it('starts at the named millisecond and has a strict end edge', () => {
    expect(isDeathStarImpactVisible(10_000, 9_999)).toBe(false);
    expect(isDeathStarImpactVisible(10_000, 10_000)).toBe(true);
    expect(isDeathStarImpactVisible(10_000, 10_000 + DEATH_STAR_IMPACT_MS - 1)).toBe(true);
    expect(isDeathStarImpactVisible(10_000, 10_000 + DEATH_STAR_IMPACT_MS)).toBe(false);
  });
});
