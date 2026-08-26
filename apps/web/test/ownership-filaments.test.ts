import { describe, expect, it } from 'vitest';
import {
  filamentGeometry,
  ownershipPairs,
} from '../src/galaxy/OwnershipFilaments.js';
import type { PlanetNode } from '../src/galaxy/scene.js';

const node = ({
  id,
  playerId,
  owned = false,
  kind = 'COLONY',
  x = 0,
}: {
  id: string;
  playerId?: string;
  owned?: boolean;
  kind?: PlanetNode['kind'];
  x?: number;
}): PlanetNode => ({
  id,
  name: id,
  owner: playerId ?? 'Neutral',
  isClanmate: false,
  position: [x, 0, x * 0.25],
  radius: 0.5,
  weight: 1,
  coreTier: 1,
  coreLevel: 1,
  satellites: [],
  shielded: false,
  stance: owned ? 'self' : 'dark',
  state: { kind: 'NORMAL' },
  kind,
  isOwned: owned,
  isCapital: kind === 'CAPITAL',
  ...(playerId ? { controllerPlayerId: playerId } : {}),
});

const WORLDS = [
  node({ id: 'mine-capital', playerId: 'me', owned: true, kind: 'CAPITAL', x: 0 }),
  node({ id: 'mine-one', playerId: 'me', owned: true, x: 5 }),
  node({ id: 'mine-two', playerId: 'me', owned: true, x: 10 }),
  node({ id: 'their-capital', playerId: 'them', kind: 'CAPITAL', x: 20 }),
  node({ id: 'their-one', playerId: 'them', x: 25 }),
  node({ id: 'their-two', playerId: 'them', x: 30 }),
  node({ id: 'other-capital', playerId: 'other', kind: 'CAPITAL', x: 40 }),
  node({ id: 'neutral', kind: 'NEUTRAL', x: 50 }),
] satisfies readonly PlanetNode[];

describe('ownership topology', () => {
  /**
   * THE STAR OF WHOEVER IS FOCUSED, AND NOTHING WHEN NOBODY IS. Owner call.
   *
   * Drawing the caller's own worlds permanently made the threads furniture: on a
   * disc of three hundred worlds they were on screen while the player was doing
   * something else entirely. Focus is the primitive this map is built on, so the
   * threads answer the question focus asks — whose is this, and what else is
   * theirs — about the world under the player's finger.
   */
  it('draws nothing at all while no world is focused', () => {
    expect(ownershipPairs(WORLDS, null)).toEqual([]);
  });

  /**
   * A STAR FROM THE CAPITAL, NOT A COMPLETE GRAPH. Owner call.
   *
   * Joining every pair of four worlds is six strings, and six strings between four
   * points is a MESH — it reads as a network of routes, which is the one thing
   * this must not be. Threads out of a capital say the true thing instead: a
   * colony belongs to a capital.
   */
  it('runs one thread from the capital to each colony, and no others', () => {
    const pairs = ownershipPairs(WORLDS, 'mine-one');
    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => pair.from.id === 'mine-capital')).toBe(true);
    expect(pairs.every((pair) => pair.kind === 'own')).toBe(true);
    expect(new Set(pairs.map((pair) => pair.to.id))).toEqual(
      new Set(['mine-one', 'mine-two']),
    );
    // The colonies are never joined to each other.
    expect(pairs.some((pair) => pair.from.id === 'mine-one')).toBe(false);
  });

  /** Focusing the capital itself is the same question with the same answer. */
  it('answers the same way whichever of your worlds is focused', () => {
    const fromColony = ownershipPairs(WORLDS, 'mine-one');
    const fromCapital = ownershipPairs(WORLDS, 'mine-capital');
    expect(fromCapital.map((pair) => pair.key)).toEqual(fromColony.map((pair) => pair.key));
  });

  it('shows the foreign commander’s star, and only theirs, when one is focused', () => {
    const pairs = ownershipPairs(WORLDS, 'their-one');
    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => pair.kind === 'selected')).toBe(true);
    expect(pairs.every((pair) => pair.from.id === 'their-capital')).toBe(true);
    expect(new Set(pairs.map((pair) => pair.to.id))).toEqual(
      new Set(['their-one', 'their-two']),
    );
    // Nobody else's worlds join in — not the caller's, not a third commander's.
    const touched = new Set(pairs.flatMap((pair) => [pair.from.id, pair.to.id]));
    expect(touched.has('mine-capital')).toBe(false);
    expect(touched.has('other-capital')).toBe(false);
  });

  /** There is no commander for a caretaker world to belong to. */
  it('draws nothing for a neutral focus', () => {
    expect(ownershipPairs(WORLDS, 'neutral')).toEqual([]);
  });

  /** A commander holding one world has nothing to join it to. */
  it('draws nothing for a commander with no colonies', () => {
    expect(ownershipPairs(WORLDS, 'other-capital')).toEqual([]);
  });

  /**
   * A star drawn around the wrong centre would state a relationship that is not
   * there. A commander always has exactly one capital — it can be devastated but
   * never captured — so this is a guard rather than a case anybody reaches.
   */
  it('draws nothing for a set with no capital in it', () => {
    const orphans = [
      node({ id: 'a', playerId: 'me', owned: true }),
      node({ id: 'b', playerId: 'me', owned: true, x: 5 }),
    ];
    expect(ownershipPairs(orphans, 'a')).toEqual([]);
  });

  it('builds one curved multi-segment buffer without invalid coordinates', () => {
    const pairs = ownershipPairs(WORLDS, 'their-one');
    const geometry = filamentGeometry(pairs);
    expect(geometry).not.toBeNull();
    const positions = geometry!.getAttribute('position');
    const alphas = geometry!.getAttribute('aAlpha');
    expect(positions.count).toBeGreaterThan(pairs.length * 2);
    expect(alphas.count).toBe(positions.count);
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    expect(Array.from(alphas.array).every((alpha) => alpha > 0 && alpha < 1)).toBe(true);
    geometry!.dispose();
  });

  /**
   * A VEIL, NOT A ROAD. The first version separated the threads by a FIXED 0.055
   * world units while a near leg is 8.7 world units and a far one 74, so the fan
   * was 0.6% of the leg — sub-pixel at every camera distance, three additive lines
   * on the same pixels, one opaque stroke. Every offset is a share of the leg now,
   * and this is the property that says so: a long leg fans wider than a short one.
   */
  it('fans the threads by a share of the leg, not by a fixed distance', () => {
    const spreadOf = (x: number): number => {
      const geometry = filamentGeometry(ownershipPairs(
        [
          node({ id: 'cap', playerId: 'me', owned: true, kind: 'CAPITAL' }),
          node({ id: 'far', playerId: 'me', owned: true, x }),
        ],
        'far',
      ))!;
      const positions = geometry.getAttribute('position');
      let widest = 0;
      for (let i = 0; i < positions.count; i += 1) {
        widest = Math.max(widest, Math.abs(positions.getZ(i) - positions.getX(i) * 0.25));
      }
      geometry.dispose();
      return widest;
    };
    expect(spreadOf(40)).toBeGreaterThan(spreadOf(8));
  });

  /**
   * AND THE BUNDLE STAYS A BUNDLE. Halved once on the owner's note: the first
   * correction over-shot the motorway and the threads read as separate cables.
   * A near leg's whole fan is about eight screen pixels at the distances this map
   * is flown at, which is something you can see through rather than a ribbon.
   */
  it('keeps a near leg’s fan tight enough to read as one bundle', () => {
    const geometry = filamentGeometry(ownershipPairs(
      [
        node({ id: 'cap', playerId: 'me', owned: true, kind: 'CAPITAL' }),
        node({ id: 'near', playerId: 'me', owned: true, x: 8 }),
      ],
      'near',
    ))!;
    const positions = geometry.getAttribute('position');
    let widest = 0;
    for (let i = 0; i < positions.count; i += 1) {
      widest = Math.max(widest, Math.abs(positions.getZ(i) - positions.getX(i) * 0.25));
    }
    geometry.dispose();
    // A share of the leg, so the assertion is a share too.
    expect(widest / 8).toBeLessThan(0.05);
  });

  /**
   * Additive blending SUMS where threads overlap, and they overlap most where
   * every leg converges on the capital. The alpha has to be chosen for that
   * convergence rather than for one thread in open space.
   */
  it('keeps every thread faint enough that a crossing stays a crossing', () => {
    const geometry = filamentGeometry(ownershipPairs(WORLDS, 'their-one'))!;
    const alphas = Array.from(geometry.getAttribute('aAlpha').array);
    expect(Math.max(...alphas)).toBeLessThan(0.07);
    geometry.dispose();
  });

  it('allocates no geometry when a commander has only one world', () => {
    const single = [node({ id: 'home', playerId: 'me', owned: true, kind: 'CAPITAL' })];
    expect(filamentGeometry(ownershipPairs(single, 'home'))).toBeNull();
  });
});
