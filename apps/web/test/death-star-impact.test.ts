import { describe, expect, it } from 'vitest';
import type { Contact, PendingThread } from '../src/api/schemas.js';
import {
  DEATH_STAR_IMPACT_MS,
  deathStarBurstLayout,
  deathStarImpactCandidates,
  isDeathStarImpactVisible,
  mergeRetainedDeathStarImpacts,
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
  coreTier: 4,
  coreLevel: 12,
  intel: 'RESOLVED' as const,
  satellites: [],
  shielded: false,
  stance: 'dark',
  state: { kind: 'NORMAL' },
  kind: 'COLONY',
  isOwned: false,
  isClanmate: false,
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
      intensity: 1,
    }]);
  });

  /**
   * A STRANGER'S EXPLOSION COMES OFF THE PUBLISHED MOMENT. D106.
   *
   * It used to be inferred from the shape of a bearing window — a `landing` flag
   * and wherever that window happened to stop — which meant only a client holding
   * the final window could reconstruct it at all, and it drew the blast at the
   * orbit the craft held rather than at the world. The server states the instant
   * and the place now, exactly as it states a bombardment, so every screen fires
   * the same effect at the same second whatever window it happens to hold.
   */
  it('takes a stranger’s explosion from the published moment, not from the window', () => {
    const base: Contact = {
      id: 'foreign',
      kind: 'death_star',
      from: { x: 0, y: 0, z: 0 },
      // Where the craft STOPS, which is in orbit and is not where the blast is.
      to: { x: 90, y: 90, z: 270 },
      startAt: new Date(9_000),
      endAt: path.arriveAt,
      landing: true,
    };
    expect(deathStarImpactCandidates([], [base], nodes)).toEqual([]);
    expect(
      deathStarImpactCandidates(
        [],
        [{ ...base, impact: { at: path.arriveAt, target: TARGET } }],
        nodes,
      ),
    ).toEqual([{
      id: 'foreign',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
      intensity: 1,
    }]);
  });

  it('keeps an out-of-sight strike effect-only and visibly fainter', () => {
    const contact: Contact = {
      id: 'distant-impact',
      kind: 'unknown',
      from: TARGET,
      to: TARGET,
      startAt: new Date(10_000),
      endAt: new Date(18_000),
      landing: true,
      effectOnly: true,
      impact: { at: path.arriveAt, target: TARGET },
    };

    expect(deathStarImpactCandidates([], [contact], nodes)).toEqual([{
      id: 'distant-impact',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
      intensity: 0.35,
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
      impact: { at: path.arriveAt, target: TARGET },
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

  it('retains a known impact when a resolving traffic refetch removes its mission', () => {
    const event = {
      id: 'mission-1',
      at: 10_000,
      position: toWorld(TARGET),
      radius: 1.4,
      intensity: 1,
    };
    expect(mergeRetainedDeathStarImpacts([], [event], 9_000)).toEqual([event]);
    // An interception removes the mission BEFORE its original arrival. A future
    // candidate that disappears must disappear with it or it detonates as a ghost.
    expect(mergeRetainedDeathStarImpacts([event], [], 9_999)).toEqual([]);
    expect(mergeRetainedDeathStarImpacts([event], [], 10_001)).toEqual([event]);
    expect(mergeRetainedDeathStarImpacts(
      [event],
      [],
      event.at + DEATH_STAR_IMPACT_MS,
    )).toEqual([]);
  });
});
