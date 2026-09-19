import { describe, expect, it } from 'vitest';
import { generateGalaxy, pickSpawnSlot, type PlanetSlot } from '../src/galaxy.js';
import { GALAXY, MULTI_WORLD, SERVERS } from '../src/constants.js';
import { selectNeutralSlots } from '../src/strategic.js';

/**
 * THE GALAXY IS LAYERED, RIM TO CORE. Owner instruction, 2026-09-18:
 * commanders on the outside, the server's commanders just inside them, then T1,
 * T2 and T3 at the centre. Every commander therefore stands the same distance
 * from the prize, and the walk inward is the progression.
 */

const R = GALAXY.radius;
const radiusOf = (slot: PlanetSlot): number => Math.hypot(slot.x, slot.y, slot.z);
const botStart = MULTI_WORLD.capitalSlots;
const botEnd = MULTI_WORLD.capitalSlots + MULTI_WORLD.botSlots;
const SEEDS = [1, 6, 18, 4242, 8331];

function octantCounts(slots: readonly PlanetSlot[]): number[] {
  const octants = Array.from({ length: 8 }, () => 0);
  for (const slot of slots) {
    const octant = (slot.x >= 0 ? 1 : 0) | (slot.y >= 0 ? 2 : 0) | (slot.z >= 0 ? 4 : 0);
    octants[octant] = (octants[octant] ?? 0) + 1;
  }
  return octants;
}

function centroidDistance(slots: readonly PlanetSlot[]): number {
  const sum = slots.reduce(
    (at, slot) => ({ x: at.x + slot.x, y: at.y + slot.y, z: at.z + slot.z }),
    { x: 0, y: 0, z: 0 },
  );
  return Math.hypot(sum.x, sum.y, sum.z) / slots.length;
}

function fill(slots: readonly PlanetSlot[], count: number): PlanetSlot[] {
  const occupied = new Set<number>();
  const placed: PlanetSlot[] = [];
  while (placed.length < count) {
    const next = pickSpawnSlot(slots, occupied);
    if (!next) throw new Error('ran out of slots');
    occupied.add(next.index);
    placed.push(next);
  }
  return placed;
}

describe('galaxy scale', () => {
  it('seats a thousand commanders in a sphere of radius 3000', () => {
    expect(SERVERS.capacity).toBe(1000);
    expect(GALAXY.radius).toBe(3000);
    expect(MULTI_WORLD.capitalSlots).toBe(SERVERS.capacity);
  });

  it('reserves room for up to a hundred server commanders on their own addresses', () => {
    expect(MULTI_WORLD.botSlots).toBe(100);
    expect(MULTI_WORLD.neutralSlotPool).toBe(botEnd + 600);
  });

  it('orders the strata strictly from rim to core with no overlap', () => {
    const { commander, bot, neutral, t1 } = GALAXY.strata;
    expect(commander.outer).toBe(1);
    expect(commander.inner).toBe(bot.outer);
    expect(bot.inner).toBeGreaterThan(neutral.outer);
    expect(t1.outer).toBeLessThanOrEqual(neutral.outer);
    expect(t1.inner).toBeGreaterThan(GALAXY.strata.t2Share);
    expect(GALAXY.strata.t2Share).toBeGreaterThan(GALAXY.strata.t3Outer);
    expect(GALAXY.strata.t3Outer).toBeGreaterThan(GALAXY.strata.t3Share);
  });

  /** Owner instruction, 2026-09-19: a wider commander shell, everything inside it moved in. */
  it('gives commanders the outer thirty-five percent of the radius', () => {
    expect(GALAXY.strata.commander).toEqual({ inner: 0.65, outer: 1 });
    expect(GALAXY.strata.bot).toEqual({ inner: 0.58, outer: 0.65 });
    expect(GALAXY.strata.neutral.outer).toBe(0.56);
  });
});

describe('layered slot generation', () => {
  it.each(SEEDS)('puts every address in its own band for seed %i', (seed) => {
    const slots = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots;
    expect(slots).toHaveLength(MULTI_WORLD.neutralSlotPool);
    for (const slot of slots) {
      const share = radiusOf(slot) / R;
      const band = slot.index < botStart
        ? GALAXY.strata.commander
        : slot.index < botEnd ? GALAXY.strata.bot : GALAXY.strata.neutral;
      expect(share, `slot ${String(slot.index)}`).toBeGreaterThanOrEqual(band.inner - 1e-9);
      expect(share, `slot ${String(slot.index)}`).toBeLessThanOrEqual(band.outer + 1e-9);
    }
  });

  it('keeps the capital prefix identical whatever pool is generated after it', () => {
    const capitals = generateGalaxy(4242, MULTI_WORLD.capitalSlots).slots;
    const withBots = generateGalaxy(4242, botEnd).slots;
    const whole = generateGalaxy(4242, MULTI_WORLD.neutralSlotPool).slots;
    expect(withBots.slice(0, capitals.length)).toEqual(capitals);
    expect(whole.slice(0, withBots.length)).toEqual(withBots);
  });

  it('honours a custom layout so a small simulated galaxy is layered too', () => {
    const slots = generateGalaxy(7, 200, { capitalSlots: 50, botSlots: 10 }).slots;
    for (const slot of slots) {
      const share = radiusOf(slot) / R;
      if (slot.index < 50) expect(share).toBeGreaterThanOrEqual(GALAXY.strata.commander.inner - 1e-9);
      else if (slot.index < 60) {
        expect(share).toBeGreaterThanOrEqual(GALAXY.strata.bot.inner - 1e-9);
        expect(share).toBeLessThanOrEqual(GALAXY.strata.bot.outer + 1e-9);
      } else expect(share).toBeLessThanOrEqual(GALAXY.strata.neutral.outer + 1e-9);
    }
  });

  it.each(SEEDS)('spreads the commander shell over the whole sphere for seed %i', (seed) => {
    const slots = generateGalaxy(seed, MULTI_WORLD.capitalSlots).slots;
    const octants = octantCounts(slots);
    expect(Math.min(...octants)).toBeGreaterThanOrEqual(95);
    expect(Math.max(...octants)).toBeLessThanOrEqual(155);
    const moments = (['x', 'y', 'z'] as const).map(
      (axis) => slots.reduce((sum, slot) => sum + slot[axis] ** 2, 0),
    );
    expect(Math.max(...moments) / Math.min(...moments)).toBeLessThan(1.2);

    // The first fifty commanders do not bunch on one face of the shell.
    const first = fill(slots, 50);
    expect(Math.min(...octantCounts(first))).toBeGreaterThanOrEqual(3);
    expect(centroidDistance(first)).toBeLessThan(R * 0.1);
  });
});

describe('server commanders between the commanders and T1', () => {
  it.each(SEEDS)('scatters bots evenly around the shell for seed %i', (seed) => {
    const bots = generateGalaxy(seed, botEnd).slots.filter((slot) => slot.index >= botStart);
    expect(bots).toHaveLength(MULTI_WORLD.botSlots);

    // A small roster (today's eight) already covers opposite sides of the galaxy…
    const eight = fill(bots, 8);
    expect(centroidDistance(eight)).toBeLessThan(R * GALAXY.strata.bot.inner * 0.3);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(eight.some((slot) => slot[axis] < 0)).toBe(true);
      expect(eight.some((slot) => slot[axis] > 0)).toBe(true);
    }

    // …and a full one leaves no octant without its share.
    const all = fill(bots, MULTI_WORLD.botSlots);
    expect(Math.min(...octantCounts(all))).toBeGreaterThanOrEqual(6);
  });

  it.each(SEEDS)('sits every bot deeper than every commander and above every neutral for seed %i', (seed) => {
    const slots = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots;
    const neutrals = selectNeutralSlots(seed, slots);
    const commanders = slots.filter((slot) => slot.index < botStart).map(radiusOf);
    const bots = slots.filter((slot) => slot.index >= botStart && slot.index < botEnd).map(radiusOf);
    const neutralRadii = neutrals.map((entry) => radiusOf(entry.slot));
    expect(Math.max(...bots)).toBeLessThanOrEqual(Math.min(...commanders) + 1e-9);
    expect(Math.min(...bots)).toBeGreaterThan(Math.max(...neutralRadii));
  });
});

describe('neutral tiers deepen toward the core', () => {
  it.each(SEEDS)('orders T1 outside T2 outside T3 for seed %i', (seed) => {
    const slots = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots;
    const neutrals = selectNeutralSlots(seed, slots);
    const radii = (tier: 1 | 2 | 3): number[] => neutrals
      .filter((entry) => entry.tier === tier)
      .map((entry) => radiusOf(entry.slot));
    const [t1, t2, t3] = [radii(1), radii(2), radii(3)];
    expect(t1).toHaveLength(MULTI_WORLD.neutralCounts[1]);
    expect(t2).toHaveLength(MULTI_WORLD.neutralCounts[2]);
    expect(t3).toHaveLength(MULTI_WORLD.neutralCounts[3]);

    expect(Math.min(...t1)).toBeGreaterThan(Math.max(...t2));
    expect(Math.min(...t2)).toBeGreaterThan(Math.max(...t3));

    const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
    expect(Math.abs(mean(t2) - R * GALAXY.strata.t2Share)).toBeLessThan(GALAXY.minSeparation);
    expect(Math.abs(mean(t3) - R * GALAXY.strata.t3Share)).toBeLessThan(GALAXY.minSeparation);
    for (const radius of t1) {
      expect(radius).toBeGreaterThan(R * GALAXY.strata.t1.inner - GALAXY.minSeparation);
      expect(radius).toBeLessThanOrEqual(R * GALAXY.strata.t1.outer + 1e-9);
    }
  });

  it('doubles the neutral field for a thousand seats', () => {
    expect(MULTI_WORLD.neutralCounts).toEqual({ 1: 76, 2: 38, 3: 16 });
  });

  /**
   * THE LAYERING IS BUILT, NOT HOPED FOR. Matched to the nearest address alone, one
   * galaxy in ten put a T3 outside a T2 once the counts doubled; each tier now
   * draws from its own band. Live seasons roll their seed, so many are checked.
   */
  /**
   * AND EVERY GALAXY CAN BE BUILT AT ALL. A pool of 700 failed to place on some
   * seeds — `generateGalaxy` threw and the season could not open. Seeds are hashed
   * the way live seasons roll them, not counted, so they spread like real ones.
   */
  it('keeps every tier in order and at its full count across many galaxies', () => {
    for (let i = 1; i <= 60; i++) {
      const seed = (i * 2654435761) >>> 0;
      const neutrals = selectNeutralSlots(seed, generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots);
      const radii = (tier: 1 | 2 | 3): number[] => neutrals
        .filter((entry) => entry.tier === tier)
        .map((entry) => radiusOf(entry.slot));
      const [t1, t2, t3] = [radii(1), radii(2), radii(3)];
      expect([t1.length, t2.length, t3.length], `seed ${String(seed)}`).toEqual([76, 38, 16]);
      expect(Math.min(...t1), `seed ${String(seed)}`).toBeGreaterThan(Math.max(...t2));
      expect(Math.min(...t2), `seed ${String(seed)}`).toBeGreaterThan(Math.max(...t3));
    }
  }, 120_000);

  it('draws neutrals only from addresses past every capital and bot seat', () => {
    const neutrals = selectNeutralSlots(8331, generateGalaxy(8331, MULTI_WORLD.neutralSlotPool).slots);
    expect(neutrals).toHaveLength(130);
    expect(neutrals.every((entry) => entry.slot.index >= botEnd)).toBe(true);
  });
});
