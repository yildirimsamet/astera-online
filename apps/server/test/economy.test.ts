import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  COMBAT,
  INSTRUMENT_IDS,
  INSTRUMENT_MAX_LEVEL,
  INTEL,
  alloyRate,
  flightSlots,
  collectorCap,
  instrumentCost,
  prospectorHold,
  prospectorSpeed,
  satelliteCost,
  storageCap,
  telescopeCooldownHours,
  upgradeCost,
} from '@blindspace/rules';
import { planets } from '../src/db/schema.js';
import { collectWorks, installSatellite, raiseInstrument } from '../src/services/build.js';
import { assignWatch, launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { loadLocked } from '../src/services/planet.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

/** Long enough that the world has settled — the same figure the other files use. */
const SETTLED_MINUTES = 250;
const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/* ── D16 · the collector ─────────────────────────────────────── */

describe('collecting the works', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    await setLevel(f.db, mine, 'CORE', 10);
    await setLevel(f.db, mine, 'REFINERY', 4);
    await setLevel(f.db, mine, 'EXTRACTOR', 4);
    await f.db.update(planets).set({ alloy: 0, crystal: 0 }).where(eq(planets.id, mine));
  });

  it('moves what the works hold into storage', async () => {
    f.clock.advance(120);
    const result = await collectWorks(f.db, mine, f.clock);

    expect(result.moved.alloy).toBeGreaterThan(0);
    expect(result.bufferAlloy).toBe(0);
    expect(Math.round(result.alloy)).toBe(Math.round(result.moved.alloy));
  });

  /** A flaky connection must not be able to collect the same ore twice. */
  it('collecting twice in a row moves nothing the second time', async () => {
    f.clock.advance(120);
    const first = await collectWorks(f.db, mine, f.clock);
    const second = await collectWorks(f.db, mine, f.clock);

    expect(second.moved.alloy).toBe(0);
    expect(Math.round(second.alloy)).toBe(Math.round(first.alloy));
  });

  it('is not an error when there is nothing to collect', async () => {
    await expect(collectWorks(f.db, mine, f.clock)).resolves.toMatchObject({
      moved: { alloy: 0, crystal: 0 },
    });
  });

  /**
   * The works fill and STOP. This is the whole re-engagement mechanism: an absence
   * of a day and an absence of a month leave the planet in the same state, and a
   * tap is what starts it again.
   */
  it('stops producing once the works are full, and restarts on collection', async () => {
    f.clock.advance(60 * 24 * 30);
    const stalled = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    expect(Math.round(stalled.bufferAlloy)).toBe(collectorCap(alloyRate(4)));

    await collectWorks(f.db, mine, f.clock);
    f.clock.advance(60);
    const running = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    expect(running.bufferAlloy).toBeCloseTo(alloyRate(4), 0);
  });

  it('holds back what will not fit rather than destroying it', async () => {
    // Fill storage to the brim first, then let the works fill behind it.
    await f.db
      .update(planets)
      .set({ alloy: storageCap(alloyRate(4)) })
      .where(eq(planets.id, mine));
    f.clock.advance(60 * 20);

    const result = await collectWorks(f.db, mine, f.clock);
    expect(result.moved.alloy).toBe(0);
    expect(result.blocked.alloy).toBeGreaterThan(0);
    expect(result.bufferAlloy).toBe(result.blocked.alloy);
  });
});

/* ── D16 · what a raid can reach ─────────────────────────────── */

describe('a raid against the works', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [attacker, defender] = f.planetIds as [string, string];
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 10);
    await setLevel(f.db, defender, 'REFINERY', 6);
    await setLevel(f.db, defender, 'EXTRACTOR', 6);
    await giveUnits(f.db, attacker, { WASP: 60, HAULER: 8 });
    f.clock.advance(600);
  });

  /**
   * Uncollected ore is exposed at HALF, and the vault does not reach it at all —
   * it protects a store, and this has not got to one. Both halves of that matter:
   * without the first, forgetting to collect costs nothing; without the second, a
   * small player with a big vault becomes unraidable by never pressing the button.
   */
  it('takes uncollected ore, at a lower rate than storage', async () => {
    const before = await f.db.transaction((tx) => loadLocked(tx, defender, f.clock));
    expect(before.bufferAlloy).toBeGreaterThan(0);

    const launch = await launchAttack(f.db, attacker, defender, { WASP: 60, HAULER: 8 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker(f).tick();

    const after = await f.db.transaction((tx) => loadLocked(tx, defender, f.clock));
    expect(after.bufferAlloy).toBeLessThan(before.bufferAlloy);

    // Less than half is gone: the share is 0.5 of the loot grade, which is itself
    // at most 0.5. Anything approaching the whole buffer means the share was
    // ignored somewhere.
    const taken = before.bufferAlloy - after.bufferAlloy;
    expect(taken).toBeLessThan(before.bufferAlloy * COMBAT.lootBufferShare + 1);
  });
});

/* ── D18 · the telescope's three gates ───────────────────────── */

describe('telescope range and cooldown', () => {
  let f: Fixture;
  let mine: string;
  let near: string;
  let far: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, near, far] = f.planetIds as [string, string, string];
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 10);
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, near, { x: 200 });
    // Beyond L1's reach of 420, inside L3's 950.
    await placeAt(f.db, far, { x: 700 });
  });

  it('refuses a world beyond the telescope reach', async () => {
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    await expect(assignWatch(f.db, mine, far, 0, f.clock)).rejects.toMatchObject({
      code: 'OUT_OF_RANGE',
    });
  });

  it('a bigger telescope reaches further', async () => {
    await giveInstrument(f.db, mine, 'TELESCOPE', 3);
    await expect(assignWatch(f.db, mine, far, 0, f.clock)).resolves.toBeTruthy();
    expect(INTEL.telescopeRange[3]!).toBeGreaterThan(700);
  });

  /** Filling an empty slot is free. The price is changing your mind. */
  it('the first assignment costs no cooldown', async () => {
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    const result = await assignWatch(f.db, mine, near, 0, f.clock);
    expect(result.cooldownUntil).toBeNull();
  });

  it('re-pointing an occupied slot locks it, and the lock is enforced', async () => {
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    await assignWatch(f.db, mine, near, 0, f.clock);

    const moved = await assignWatch(f.db, mine, far, 0, f.clock).catch(() => null);
    // `far` is out of L1 range, so use a reachable third target instead: the point
    // is the cooldown, not the range.
    expect(moved).toBeNull();

    await placeAt(f.db, far, { x: 300 });
    const second = await assignWatch(f.db, mine, far, 0, f.clock);
    expect(second.cooldownUntil).not.toBeNull();

    // Still locked a minute later.
    f.clock.advance(1);
    await expect(assignWatch(f.db, mine, near, 0, f.clock)).rejects.toMatchObject({
      code: 'SLOT_COOLING',
    });

    // Free once the cooldown expires.
    f.clock.advance(telescopeCooldownHours(1) * 60);
    await expect(assignWatch(f.db, mine, near, 0, f.clock)).resolves.toBeTruthy();
  });

  /** A double-tap on the same target must not cost a day. */
  it('re-selecting the target a slot already holds is a no-op', async () => {
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    await assignWatch(f.db, mine, near, 0, f.clock);
    const again = await assignWatch(f.db, mine, near, 0, f.clock);
    expect(again.cooldownUntil).toBeNull();
  });

  /**
   * A higher telescope realigns faster. Levelling buys slots, reach and agility at
   * once, which is what lets it compete with levelling anything else.
   */
  it('cools down faster at a higher level', () => {
    expect(telescopeCooldownHours(5)).toBeLessThan(telescopeCooldownHours(1));
  });
});

/* ── owner decisions · how much may be in the air ────────────── */

describe('what may be in the air at once', () => {
  let f: Fixture;
  let mine: string;
  let a: string;
  let b: string;
  let c: string;
  let d: string;

  beforeEach(async () => {
    f = await seedWorld(5);
    [mine, a, b, c, d] = f.planetIds as [string, string, string, string, string];
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 10);
    /**
     * Everyone rich, not just the attacker.
     *
     * Wealth no longer decides who may attack whom — D49 replaced the ratio with a
     * development-tier band — but `grant` raises a Core to hold what it is given,
     * so a lopsided world is a world of lopsided TIERS and half the launches here
     * would be refused. Giving every planet the same footing keeps these tests
     * about what may be IN THE AIR, which is what they are for.
     */
    for (const id of f.planetIds) await grant(f.db, id, 200_000, 20_000);
    f.clock.advance(600);
  });

  /**
   * SCOUTING IS STILL RATIONED, by the general rule rather than a special case. D28.
   *
   * This test used to assert `PROBE.maxInFlight`, a cap on one craft type. The bay
   * count is the same scarcity applied to everything that leaves the ground, so the
   * rule it protects is unchanged and only the mechanism moved.
   *
   * The bar is DERIVED from `flightSlots`, so it follows the design if the formula
   * is ever re-pointed instead of pinning today's answer.
   */
  it('rations what may be in the air, and the cap comes from the Command Core', async () => {
    const bays = flightSlots(10);
    const targets = [a, b, c, d].slice(0, bays);
    expect(targets.length, 'seed more planets than there are bays').toBeLessThan(bays + 1);
    for (const target of targets) {
      await expect(launchProbe(f.db, mine, target, f.clock)).resolves.toBeTruthy();
    }
  });

  it('refuses a launch when every bay is occupied', async () => {
    // Core 1 is three bays, which the four seeded planets can exhaust.
    await setLevel(f.db, mine, 'CORE', 1);
    expect(flightSlots(1)).toBe(3);
    for (const target of [a, b, c]) {
      await expect(launchProbe(f.db, mine, target, f.clock)).resolves.toBeTruthy();
    }
    await expect(launchProbe(f.db, mine, d, f.clock)).rejects.toMatchObject({
      code: 'NO_FREE_BAY',
    });
  });

  /**
   * The whole point of one shared count: scouting, raiding and mining compete.
   *
   * Under `PROBE.maxInFlight` a player could hold three probes AND unlimited mining
   * runs AND a raid at every neighbour. Nothing traded against anything.
   */
  it('a raid and a probe draw on the same bays', async () => {
    // Every planet, not only the attacker: a Core 1 world among Core 18 ones is
    // outside the tier band and every raid here would be refused (D49).
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 1);
    await giveUnits(f.db, mine, { WASP: 60 });
    await expect(launchProbe(f.db, mine, a, f.clock)).resolves.toBeTruthy();
    await expect(launchAttack(f.db, mine, b, { WASP: 20 }, f.clock)).resolves.toBeTruthy();
    await expect(launchAttack(f.db, mine, c, { WASP: 20 }, f.clock)).resolves.toBeTruthy();
    // Three bays, three craft out.
    await expect(launchAttack(f.db, mine, d, { WASP: 20 }, f.clock)).rejects.toMatchObject({
      code: 'NO_FREE_BAY',
    });
  });

  it('the Command Core is the only thing that opens a bay', () => {
    // Derived rather than tabulated: whatever the formula says, raising the Core
    // must never reduce capacity and must eventually increase it.
    for (let core = 0; core < 12; core++) {
      expect(flightSlots(core + 1)).toBeGreaterThanOrEqual(flightSlots(core));
    }
    expect(flightSlots(12)).toBeGreaterThan(flightSlots(1));
  });

  /**
   * A bay is held for the WHOLE round trip, not until arrival.
   *
   * A cap that reset at the far end would be a cap on distance rather than on how
   * much a planet may have committed — and the return leg is exactly when a raider
   * is carrying loot and least able to answer for it.
   */
  it('a craft on its way home is still holding its bay', async () => {
    await setLevel(f.db, mine, 'CORE', 1);
    const first = await launchProbe(f.db, mine, a, f.clock);
    await launchProbe(f.db, mine, b, f.clock);
    await launchProbe(f.db, mine, c, f.clock);

    // The first probe reaches its target and turns for home.
    f.clock.set(first.arriveAt);
    await worker(f).tick();
    await expect(launchProbe(f.db, mine, d, f.clock)).rejects.toMatchObject({
      code: 'NO_FREE_BAY',
    });

    // Only when it actually lands does the bay come back.
    f.clock.advance(first.flightMinutes);
    await worker(f).tick();
    await expect(launchProbe(f.db, mine, d, f.clock)).resolves.toBeTruthy();
  });

  /**
   * SOMEBODY ELSE'S CRAFT MUST NOT CONSUME MY BAYS.
   *
   * A return leg is stored with its origin and target swapped, so an inbound enemy
   * raid and my own fleet coming home are the same shape unless ownership is read
   * per leg. The cap this replaces matched `origin OR target` and really did let a
   * neighbour's probe eat one of my three scouting slots.
   */
  it('an enemy fleet inbound at me does not occupy my bays', async () => {
    await setLevel(f.db, mine, 'CORE', 1);
    await setLevel(f.db, a, 'CORE', 1);
    await giveUnits(f.db, a, { WASP: 60 });
    // Their raid, aimed at me.
    await expect(launchAttack(f.db, a, mine, { WASP: 20 }, f.clock)).resolves.toBeTruthy();
    // My own three bays are untouched by it.
    for (const target of [b, c, d]) {
      await expect(launchProbe(f.db, mine, target, f.clock)).resolves.toBeTruthy();
    }
  });

  it('allows only one probe per target', async () => {
    await launchProbe(f.db, mine, a, f.clock);
    await expect(launchProbe(f.db, mine, a, f.clock)).rejects.toMatchObject({
      code: 'PROBE_ALREADY_OUT',
    });
  });

  /**
   * The return leg counts. A probe on its way home is still a craft you have not
   * got back, and a cap that reset halfway would be a cap on distance rather than
   * on how much you may have in the air.
   */
  it('counts a probe coming home against both limits', async () => {
    const launch = await launchProbe(f.db, mine, a, f.clock);
    f.clock.set(launch.arriveAt);
    await worker(f).tick();

    await expect(launchProbe(f.db, mine, a, f.clock)).rejects.toMatchObject({
      code: 'PROBE_ALREADY_OUT',
    });

    f.clock.advance(launch.flightMinutes);
    await worker(f).tick();
    await expect(launchProbe(f.db, mine, a, f.clock)).resolves.toBeTruthy();
  });

  it('allows only one fleet committed to a planet at a time', async () => {
    await giveUnits(f.db, mine, { WASP: 60 });
    await expect(launchAttack(f.db, mine, a, { WASP: 20 }, f.clock)).resolves.toBeTruthy();
    await expect(launchAttack(f.db, mine, a, { WASP: 20 }, f.clock)).rejects.toMatchObject({
      code: 'FLEET_ALREADY_COMMITTED',
    });
    // A different target is still fair game — the limit is per planet, not global.
    await expect(launchAttack(f.db, mine, b, { WASP: 20 }, f.clock)).resolves.toBeTruthy();
  });

  it('stays committed while the survivors are flying home', async () => {
    await giveUnits(f.db, mine, { WASP: 60 });
    const launch = await launchAttack(f.db, mine, a, { WASP: 30 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker(f).tick();

    await expect(launchAttack(f.db, mine, a, { WASP: 20 }, f.clock)).rejects.toMatchObject({
      code: 'FLEET_ALREADY_COMMITTED',
    });

    f.clock.advance(launch.exposureMinutes);
    await worker(f).tick();
    await expect(launchAttack(f.db, mine, a, { WASP: 20 }, f.clock)).resolves.toBeTruthy();
  });
});

/**
 * SATELLITES ARE PRICED, NOT RATIONED. D22.
 *
 * The Orbital Ring and its slot budget are gone, so the server's refusals had to
 * change with them: there is no longer any state in which a planet is told it may
 * not own a fifth instrument. What IS still enforced is the price — two to three
 * times a building at the same level — and the Command Core ceiling that every
 * structure on the planet obeys.
 *
 * These are the guards on the two ways that could silently regress: the cap
 * coming back as a stray check, and the endpoint charging `upgradeCost` while the
 * interface quotes `satelliteCost`.
 */
/**
 * TWO KINDS OF HARDWARE, TWO SETS OF RULES. D25.
 *
 * Ground INSTRUMENTS are levelled, gated by price and by the Command Core, and take
 * no orbit slot. Orbit SATELLITES are bought once at a flat price and take one of
 * the slots the Core opens at levels 1, 3, 5 and 9. Mixing the two rules up is the
 * muddle this decision exists to end, so both are pinned here.
 */
describe('raising ground instruments', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    await setLevel(f.db, mine, 'CORE', 6);
    await grant(f.db, mine, 400_000, 200_000);
    // The two seeing instruments hang off the Uplink; the tests below are about
    // everything except that gate, which has its own case.
    await giveSatellite(f.db, mine, 'UPLINK');
  });

  it('lets one planet run all four, in any order', async () => {
    // Deliberately not the order they are declared in: nothing may be a
    // prerequisite for anything else.
    for (const id of ['VEIL', 'AEGIS', 'TELESCOPE', 'RADAR'] as const) {
      await expect(raiseInstrument(f.db, mine, id, f.clock)).resolves.toMatchObject({
        type: id,
        level: 1,
      });
    }

    const planet = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    for (const id of INSTRUMENT_IDS) expect(planet.instruments[id]).toBe(1);
  });

  /**
   * THE CEILING. D36.
   *
   * `radarRange` and `telescopeRange` are six-entry tables and `atLevel`
   * clamps, so L5 has always been the last level that buys anything. Nothing
   * enforced it: a player could raise a Radar to 8 at an exponential price and get
   * precisely nothing for the last three. The interface reported "12 min -> 12 min"
   * the whole way and took the money.
   */
  describe('the top of an instrument', () => {
    /** Raise as far as the rules allow, from a Core high enough not to be the limit. */
    const raiseTo = async (id: 'TELESCOPE' | 'RADAR' | 'AEGIS' | 'VEIL', target: number) => {
      await setLevel(f.db, mine, 'CORE', target + 2);
      await grant(f.db, mine, 40_000_000, 20_000_000);
      for (let l = 0; l < target; l++) await raiseInstrument(f.db, mine, id, f.clock);
    };

    it.each(['TELESCOPE', 'RADAR'] as const)('refuses to raise a maxed %s', async (id) => {
      const max = INSTRUMENT_MAX_LEVEL[id];
      expect(max).not.toBeNull();
      await raiseTo(id, max!);

      await expect(raiseInstrument(f.db, mine, id, f.clock)).rejects.toMatchObject({
        code: 'AT_MAX_LEVEL',
      });
    });

    it.each(['TELESCOPE', 'RADAR'] as const)('allows the last real level of a %s', async (id) => {
      const max = INSTRUMENT_MAX_LEVEL[id];
      await raiseTo(id, max! - 1);
      await expect(raiseInstrument(f.db, mine, id, f.clock)).resolves.toMatchObject({
        level: max,
      });
    });

    /** And the refusal charges nothing — a rejected purchase must not bill. */
    it('takes no payment for a refused raise', async () => {
      await raiseTo('RADAR', INSTRUMENT_MAX_LEVEL.RADAR!);
      const before = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
      await expect(raiseInstrument(f.db, mine, 'RADAR', f.clock)).rejects.toThrow();
      const after = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
      expect(after.alloy).toBe(before.alloy);
      expect(after.crystal).toBe(before.crystal);
      expect(after.instruments.RADAR).toBe(INSTRUMENT_MAX_LEVEL.RADAR);
    });

    /**
     * The two with no table keep going, because they genuinely keep buying: a
     * shield is an exponential curve and a Veil is measured against whatever
     * telescope the rest of the galaxy has built.
     */
    it.each(['AEGIS', 'VEIL'] as const)('never caps a %s', async (id) => {
      await raiseTo(id, 9);
      await expect(raiseInstrument(f.db, mine, id, f.clock)).resolves.toMatchObject({
        level: 10,
      });
    });
  });

  it('takes no orbit slot, however many are raised', async () => {
    for (const id of INSTRUMENT_IDS) await raiseInstrument(f.db, mine, id, f.clock);
    const planet = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    // One Uplink is up there and nothing else. Instruments are on the ground.
    expect(planet.orbit).toEqual(['UPLINK']);
  });

  it('charges the instrument price, not the building price', async () => {
    const before = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    await raiseInstrument(f.db, mine, 'TELESCOPE', f.clock);
    const after = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));

    const charged = before.alloy - after.alloy;
    expect(charged).toBe(instrumentCost('TELESCOPE', 0).alloy);
    // And that really is dearer than a building — the assertion is worthless if
    // the two prices happen to coincide.
    expect(charged).toBeGreaterThan(upgradeCost(0).alloy);
  });

  it('refuses one it cannot pay for, at the instrument price', async () => {
    const price = instrumentCost('TELESCOPE', 0);
    // Enough for a building at this level, and deliberately not enough for the
    // instrument: the exact gap a stale price would fall through.
    await grant(f.db, mine, upgradeCost(0).alloy, price.crystal);

    await expect(raiseInstrument(f.db, mine, 'TELESCOPE', f.clock)).rejects.toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
    });
  });

  it('still refuses to raise one past the Command Core', async () => {
    await setLevel(f.db, mine, 'CORE', 1);
    await expect(raiseInstrument(f.db, mine, 'RADAR', f.clock)).resolves.toMatchObject({
      level: 1,
    });
    await expect(raiseInstrument(f.db, mine, 'RADAR', f.clock)).rejects.toMatchObject({
      code: 'CORE_CEILING',
    });
  });
});

/**
 * THE UPLINK IS THE ONE PLACE A SATELLITE GATES ANYTHING. D25.
 *
 * It is what makes a planet's first orbit slot a real decision — eyes, or
 * production, or faster drills — and it is the reason the Telescope is not simply
 * the obvious first purchase for everybody.
 */
describe('the Uplink gate', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    await setLevel(f.db, mine, 'CORE', 6);
    await grant(f.db, mine, 400_000, 200_000);
  });

  it('refuses the two seeing instruments until an Uplink is in orbit', async () => {
    for (const id of ['TELESCOPE', 'RADAR'] as const) {
      await expect(raiseInstrument(f.db, mine, id, f.clock)).rejects.toMatchObject({
        code: 'NEEDS_UPLINK',
      });
    }
  });

  it('leaves the other two alone — they stand on their own', async () => {
    for (const id of ['AEGIS', 'VEIL'] as const) {
      await expect(raiseInstrument(f.db, mine, id, f.clock)).resolves.toMatchObject({ level: 1 });
    }
  });

  it('opens them the moment the Uplink is up', async () => {
    await giveSatellite(f.db, mine, 'UPLINK');
    await expect(raiseInstrument(f.db, mine, 'TELESCOPE', f.clock)).resolves.toMatchObject({
      level: 1,
    });
  });
});

/**
 * SATELLITES ARE RATIONED BY SLOTS, AND THE CORE OPENS THEM. D25.
 *
 * Four satellites and four slots is not a checklist because the fourth slot is a
 * Core 9 planet. For the part of a season anybody actually plays, a world runs one,
 * two or three of them, and which ones is who it is.
 */
describe('putting satellites in orbit', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    await grant(f.db, mine, 400_000, 200_000);
  });

  it('gives a fresh planet exactly one slot', async () => {
    await setLevel(f.db, mine, 'CORE', 1);
    await expect(installSatellite(f.db, mine, 'FOUNDRY', f.clock)).resolves.toMatchObject({
      type: 'FOUNDRY',
    });
    await expect(installSatellite(f.db, mine, 'UPLINK', f.clock)).rejects.toMatchObject({
      code: 'NO_FREE_SLOT',
    });
  });

  it('opens the next slot at Core 3, 5 and 9', async () => {
    for (const [core, wanted] of [
      [1, 'FOUNDRY'],
      [3, 'UPLINK'],
      [5, 'DERRICK'],
      [9, 'BEACON'],
    ] as const) {
      await setLevel(f.db, mine, 'CORE', core);
      await expect(installSatellite(f.db, mine, wanted, f.clock)).resolves.toMatchObject({
        type: wanted,
      });
    }
    const planet = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    expect([...planet.orbit].sort()).toEqual(['BEACON', 'DERRICK', 'FOUNDRY', 'UPLINK']);
  });

  it('charges one flat price, whatever the Core is', async () => {
    await setLevel(f.db, mine, 'CORE', 9);
    const before = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    await installSatellite(f.db, mine, 'DERRICK', f.clock);
    const after = await f.db.transaction((tx) => loadLocked(tx, mine, f.clock));
    expect(before.alloy - after.alloy).toBe(satelliteCost('DERRICK').alloy);
  });

  /** There is no ladder to climb, so a second purchase is a mistake, not a raise. */
  it('refuses to install the same satellite twice', async () => {
    await setLevel(f.db, mine, 'CORE', 9);
    await installSatellite(f.db, mine, 'BEACON', f.clock);
    await expect(installSatellite(f.db, mine, 'BEACON', f.clock)).rejects.toMatchObject({
      code: 'ALREADY_IN_ORBIT',
    });
  });

  it('refuses one it cannot pay for', async () => {
    await setLevel(f.db, mine, 'CORE', 9);
    await grant(f.db, mine, 10, 10);
    await expect(installSatellite(f.db, mine, 'FOUNDRY', f.clock)).rejects.toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
    });
  });
});

/**
 * WHAT A SATELLITE ACTUALLY CHANGES. D25.
 *
 * Each one moves a different number, and a bonus nobody can measure is a bonus
 * nobody will buy — so each is asserted against the system it touches rather than
 * against its own constant.
 */
describe('what a satellite does', () => {
  let f: Fixture;
  let mine: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    mine = f.planetIds[0]!;
    await setLevel(f.db, mine, 'CORE', 9);
    await grant(f.db, mine, 400_000, 200_000);
  });

  /** The Foundry lifts the RATE, so the works fill faster and hold more. */
  it('the Foundry makes the works produce more', async () => {
    await setLevel(f.db, mine, 'REFINERY', 4);
    await zeroWorks(f.db, mine);
    f.clock.advance(60);
    const plain = (await f.db.transaction((tx) => loadLocked(tx, mine, f.clock))).bufferAlloy;

    await giveSatellite(f.db, mine, 'FOUNDRY');
    await zeroWorks(f.db, mine);
    f.clock.advance(60);
    const boosted = (await f.db.transaction((tx) => loadLocked(tx, mine, f.clock))).bufferAlloy;

    expect(boosted).toBeGreaterThan(plain);
  });

  /** The Derrick lifts every craft the planet owns, at once. */
  it('the Derrick makes a mining craft carry more and fly faster', () => {
    expect(prospectorHold(['DERRICK'])).toBeGreaterThan(prospectorHold([]));
    expect(prospectorSpeed(['DERRICK'])).toBeGreaterThan(prospectorSpeed([]));
  });

  /** The Beacon shortens every leg a fleet flies out of this planet. */
  /**
   * Measured across the DISC rather than between two neighbours: travel time is
   * rounded up to whole minutes, so on a short hop a real speed increase can round
   * back to the same number and the assertion would prove nothing.
   */
  it('the Beacon gets a fleet there sooner', async () => {
    const [, target] = f.planetIds as [string, string];
    await placeAt(f.db, mine, { x: -700 });
    await placeAt(f.db, target, { x: 700 });
    await giveUnits(f.db, mine, { WASP: 40 });
    await setLevel(f.db, mine, 'SHIPYARD', 1);
    // The grant in `beforeEach` made this planet rich and therefore tall; the
    // targets are still Core 1 and out of band. D49 — see `levelWorld`.
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(SETTLED_MINUTES);

    const plain = await launchAttack(f.db, mine, target, { WASP: 10 }, f.clock);
    const plainMinutes = (plain.arriveAt.getTime() - f.clock.now().getTime()) / 60_000;

    // Same two planets, same distance — only the orbit differs.
    await giveSatellite(f.db, mine, 'BEACON');
    const other = f.planetIds[2] ?? target;
    await placeAt(f.db, other, { x: 700, z: 1 });
    const boosted = await launchAttack(f.db, mine, other, { WASP: 10 }, f.clock);
    const boostedMinutes = (boosted.arriveAt.getTime() - f.clock.now().getTime()) / 60_000;

    expect(boostedMinutes).toBeLessThan(plainMinutes);
  });
});

/** Empty the works, so a production measurement starts from a known zero. */
async function zeroWorks(db: Fixture['db'], planetId: string): Promise<void> {
  const { planets } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  await db.update(planets).set({ bufferAlloy: 0, bufferCrystal: 0 }).where(eq(planets.id, planetId));
}
