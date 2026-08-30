import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEATH_STAR,
  SENSOR,
  asteroidPosition,
  engagementEndsAt,
  radarContactRange,
  radarRange,
  sensorSphere,
} from '@astera/rules';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { miningRuns, missions, planets, strategicImpacts } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the durable sensor-history backfill', () => {
  it('uses the same finite Telescope ladder as the runtime rule', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migration = readFileSync(
      path.join(here, '../drizzle/0043_backfill_sensor_epochs.sql'),
      'utf8',
    );
    for (const level of [1, 2, 3, 4, 5]) {
      const reach = sensorSphere({ x: 0, y: 0, z: 0 }, level, 0).identify;
      const predicate = level === 5
        ? `WHEN "e"."level" >= 5 THEN ${String(reach)}`
        : `WHEN "e"."level" = ${String(level)} THEN ${String(reach)}`;
      expect(migration).toContain(predicate);
    }
    const base = sensorSphere({ x: 0, y: 0, z: 0 }, 0, 0).identify;
    expect(migration).toContain(`ELSE ${String(base)}`);
  });

  it('moves every live open epoch onto the new ladder at deployment time', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migration = readFileSync(
      path.join(here, '../drizzle/0045_refresh_sensor_radius_epochs.sql'),
      'utf8',
    );
    expect(migration).toContain('UPDATE "sensor_epochs"');
    expect(migration).toContain('SET "ends_at" = now()');
    for (const level of [1, 2, 3, 4, 5]) {
      const reach = sensorSphere({ x: 0, y: 0, z: 0 }, level, 0).identify;
      const predicate = level === 5
        ? `WHEN "e"."level" >= 5 THEN ${String(reach)}`
        : `WHEN "e"."level" = ${String(level)} THEN ${String(reach)}`;
      expect(migration).toContain(predicate);
    }
    expect(migration).toContain(`ELSE ${String(SENSOR.baseRadius)}`);
  });
});

/**
 * THE SENSOR HORIZON — WHO IS THERE TO SEE IT. D123.
 *
 * The disc was paying for the intel ladder and keeping the change. Every craft in
 * the galaxy was published to every commander at full composition, so the Telescope
 * sold nothing a logged-in player did not already have, Radar L4 and L5 sold
 * nothing at all, and the first real play session reported the predictable result:
 * no tactics, because there was no asymmetry left for one to live in.
 *
 * WHAT THIS FILE HOLDS is that the fog covers exactly two things — a raid in
 * transit and a scout in transit — and that everything the design calls a public
 * moment stays public. Both halves matter. A fog that swallowed engagements would
 * break D52's pillar and leave a dead galaxy; a fog that covered nothing is what
 * we had.
 */
describe('the sensor horizon', () => {
  let f: Fixture;
  /** The caller. */
  let mine: string;
  /** A raid between two other worlds, far from the caller. */
  let a: string;
  let b: string;

  beforeEach(async () => {
    f = await seedWorld(4);
    [mine, a, b] = f.planetIds as [string, string, string];

    /**
     * The caller at the origin; the fight a long way off along +x.
     *
     * The default pair sits at 1,600 → 1,900, so its midpoint at 1,750 is BEYOND
     * the telescope ceiling (1,600) and INSIDE the radar ceiling (2,200). That is
     * the CONTACT band, and it is also the proof that no amount of Telescope
     * erases the spherical horizon. `raidBetween` moves the pair for the tests
     * that need one of the other two zones.
     */
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, a, { x: 1600 });
    await placeAt(f.db, b, { x: 1900 });

    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await giveSatellite(f.db, mine, 'UPLINK');
    await setLevel(f.db, a, 'SHIPYARD', 3);
    await grant(f.db, a, 20_000, 5_000);
    // `grant` raises a Core to hold what it grants, so the whole world is levelled
    // back into one tier band — otherwise every launch below is refused for a
    // reason none of these tests are about. The helper documents this.
    await levelWorld(f.db, f.planetIds);
  });

  /** Where the caller's own eyes are, as the route would compute them. */
  const contacts = async () =>
    galaxyTraffic(f.db, f.seasonId, mine, f.clock.now(), f.playerIds[0] ?? null, [mine]);

  /** A raid between the two distant worlds, moved to the middle of its leg. */
  const distantRaid = async (fleet: Record<string, number> = { WASP: 30 }) => {
    await giveUnits(f.db, a, fleet);
    const launch = await launchAttack(f.db, a, b, fleet, f.clock);
    const now = f.clock.now().getTime();
    f.clock.set(new Date(now + (launch.arriveAt.getTime() - now) * 0.5));
    return launch;
  };

  /**
   * The same raid, with the two worlds moved so its midpoint lands where a test
   * needs it. The zone a craft is in is a distance, so a test about zones is a
   * test about where the craft is — and saying that with coordinates rather than
   * with instrument levels keeps the two halves of the model independent.
   */
  const raidBetween = async (fromX: number, toX: number) => {
    await placeAt(f.db, a, { x: fromX });
    await placeAt(f.db, b, { x: toX });
    return distantRaid();
  };

  /** Give the caller the eyes a test is about, and nothing else. */
  const eyes = async (telescope: number, radar: number) => {
    if (telescope > 0) await giveInstrument(f.db, mine, 'TELESCOPE', telescope);
    if (radar > 0) await giveInstrument(f.db, mine, 'RADAR', radar);
  };

  /* ── the horizon itself ────────────────────────────────────── */

  /**
   * D125 CHANGED WHAT "OUT OF REACH" MEANS, AND THIS IS THE HINGE.
   *
   * D123 dropped a far craft from the payload entirely, and the owner found the
   * hole in it: a player cannot tell "the galaxy is quiet" from "the galaxy is busy
   * and my instruments are too weak", so the Telescope ladder was invisible in a
   * second, quieter way. The contact comes back stripped of everything the
   * instrument sells — no kind, no mass, no route — and says only THERE IS
   * SOMETHING OUT THERE.
   */
  /**
   * ZONE ONE: NOTHING. The owner's rule, and a reversal of D125.
   *
   * D125 published every craft in the galaxy to everybody as an anonymous return,
   * on the argument that a player who sees nothing cannot tell a quiet galaxy from
   * a blind one. That argument is answered better by the RADAR circle: the ladder
   * is what buys the question mark, and outside it a craft simply does not exist
   * for you. "Benim için o yok."
   */
  it('shows nothing at all outside every circle', async () => {
    await distantRaid();
    expect(await contacts()).toEqual([]);
  });

  it('still shows nothing with a maxed telescope and no radar', async () => {
    await eyes(5, 0);
    await distantRaid();
    // 1,750 units out: past the telescope ceiling, and nothing detects it.
    expect(await contacts()).toEqual([]);
  });

  /**
   * ZONE TWO: A QUESTION MARK THAT MOVES.
   *
   * Everything the instrument sells is stripped — no kind, no mass, no route — and
   * what is left is a position and a heading. That is the advertisement for the
   * Telescope, written in the only language this game trusts (D124).
   */
  it('shows a question mark inside the radar circle', async () => {
    // Radar 3, so the rung under test is the one that opens the circle rather
    // than the one that also names what is in it.
    await eyes(0, 3);
    await raidBetween(1000, 1300);

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('unknown');
    expect(seen[0]).not.toHaveProperty('fleet');
    expect(seen[0]).not.toHaveProperty('route');
    expect(seen[0]).not.toHaveProperty('silhouette');
  });

  /**
   * ZONE THREE: THE CRAFT ITSELF.
   *
   * Inside telescope reach the eye has answered: it is a fleet, with these exact
   * hulls and counts. The ROUTE is still absent — you see what is out there, but
   * do not read where it came from or where it is going.
   */
  it('identifies the same craft once the telescope reaches it', async () => {
    await eyes(5, 5);
    // Brought inside the 1,600 ceiling: midpoint 1,150.
    await raidBetween(1000, 1300);

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind).toBe('fleet');
    expect(seen[0]?.mass).toBe('LIGHT');
    expect(seen[0]?.fleet).toEqual({ WASP: 30 });
    expect(seen[0]).not.toHaveProperty('route');
  });

  /**
   * NO AMOUNT OF TELESCOPE ERASES THE HORIZON. D126.
   *
   * The ceiling is 80% of the galaxy's radius, so even a maxed instrument at the
   * exact centre leaves an outer shell it cannot name. The radar still detects
   * there, which is the trade: reach bought by giving up detail.
   */
  it('keeps a shell it can detect but never identify', async () => {
    await eyes(5, 5);
    await distantRaid();

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind, 'the top rung erased the horizon').toBe('unknown');
  });

  it('returns different detail for two commanders looking at the same contact', async () => {
    const observer = f.planetIds[3]!;
    await placeAt(f.db, observer, { x: 0 });
    await giveSatellite(f.db, observer, 'UPLINK');
    await giveInstrument(f.db, observer, 'TELESCOPE', 5);
    await giveInstrument(f.db, observer, 'RADAR', 5);
    await eyes(0, 3);
    await raidBetween(1000, 1300);

    const bare = await contacts();
    const instrumented = await galaxyTraffic(
      f.db,
      f.seasonId,
      observer,
      f.clock.now(),
      f.playerIds[3] ?? null,
      [observer],
    );

    expect(bare).toHaveLength(1);
    expect(instrumented).toHaveLength(1);
    expect(instrumented[0]?.id).toBe(bare[0]?.id);
    expect(bare[0]?.kind).toBe('unknown');
    expect(bare[0]).not.toHaveProperty('mass');
    expect(instrumented[0]?.kind).toBe('fleet');
    expect(instrumented[0]?.mass).toBe('LIGHT');
    // Payload disclosure, not CSS, enforces the difference: Radar has no manifest,
    // while the observer whose Telescope reaches the craft gets the exact tally.
    expect(bare[0]).not.toHaveProperty('fleet');
    expect(instrumented[0]?.fleet).toEqual({ WASP: 30 });
  });

  it('combines Telescope sight from every controlled planet and colony', async () => {
    const colony = f.planetIds[3]!;
    await f.db.update(planets)
      .set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
      .where(eq(planets.id, colony));
    await placeAt(f.db, colony, { x: 1150 });
    await giveSatellite(f.db, colony, 'UPLINK');
    await giveInstrument(f.db, colony, 'TELESCOPE', 1);
    await raidBetween(1000, 1300);

    const capitalOnly = await galaxyTraffic(
      f.db,
      f.seasonId,
      mine,
      f.clock.now(),
      f.playerIds[0],
      [mine],
    );
    expect(capitalOnly).toEqual([]);

    const allControlledWorlds = await galaxyTraffic(
      f.db,
      f.seasonId,
      mine,
      f.clock.now(),
      f.playerIds[0],
      [mine, colony],
    );
    expect(allControlledWorlds).toHaveLength(1);
    expect(allControlledWorlds[0]?.kind).toBe('fleet');
    expect(allControlledWorlds[0]?.fleet).toEqual({ WASP: 30 });
  });

  /**
   * THE LADDER ONLY EVER ADDS, AND EVERY RUNG IS VISIBLE.
   *
   * Walked with a fixed radar so the craft is always on the disc, and the only
   * thing changing is whether the telescope can name it. Once it resolves it never
   * goes back — a ladder that flickered would be a ladder nobody could read.
   */
  it('identifies more at every level, so the ladder buys something visible', async () => {
    await eyes(0, 5);
    await raidBetween(1000, 1300);

    const identified: boolean[] = [];
    for (const level of [0, 1, 2, 3, 4, 5]) {
      await giveInstrument(f.db, mine, 'TELESCOPE', level);
      const seen = await contacts();
      expect(seen, `the radar lost the craft at telescope ${String(level)}`).toHaveLength(1);
      identified.push(seen[0]?.kind !== 'unknown');
    }
    expect(identified.at(0)).toBe(false);
    expect(identified.at(-1)).toBe(true);
    expect(identified.indexOf(true)).toBe(identified.lastIndexOf(false) + 1);
  });

  it('anonymises a scout on the same terms as a fleet', async () => {
    await eyes(0, 5);
    await placeAt(f.db, a, { x: 1000 });
    await placeAt(f.db, b, { x: 1300 });
    const launch = await launchProbe(f.db, a, b, f.clock);
    const now = f.clock.now().getTime();
    f.clock.set(new Date(now + (launch.arriveAt.getTime() - now) * 0.5));

    // A scout and a warship are indistinguishable out there, which is the point:
    // the neon that would name it IS the thing the Telescope sells.
    expect((await contacts()).map((c) => c.kind)).toEqual(['unknown']);
    await giveInstrument(f.db, mine, 'TELESCOPE', 5);
    expect((await contacts()).map((c) => c.kind)).toEqual(['probe']);
  });

  /**
   * RADAR L5 NAMES THE KIND WITHOUT NAMING THE CRAFT.
   *
   * The top of the ladder, and the first time it pays out on ordinary traffic
   * rather than only on a raid aimed at you: a maxed Radar tells a fleet from a
   * scout from a drill at the edge of its circle, long before the eye could. It is
   * a KIND and never a roster.
   */
  it('names the kind of a question mark at Radar 5, and not below', async () => {
    await eyes(0, 4);
    await raidBetween(1000, 1300);
    expect((await contacts())[0]?.silhouette).toBeUndefined();

    await giveInstrument(f.db, mine, 'RADAR', 5);
    const seen = await contacts();
    expect(seen[0]?.kind).toBe('unknown');
    expect(seen[0]?.silhouette).toBe('fleet');
    expect(seen[0]).not.toHaveProperty('fleet');
  });

  /** Radar L4 sizes a contact it cannot name; below it, nothing. */
  it('sizes a question mark at Radar 4, and not below', async () => {
    await eyes(0, 3);
    await raidBetween(1000, 1300);
    expect((await contacts())[0]?.mass).toBeUndefined();

    await giveInstrument(f.db, mine, 'RADAR', 4);
    expect((await contacts())[0]?.mass).toBe('LIGHT');
  });

  /**
   * THE MOMENT IS PUBLIC; THE SQUADRON STILL ANSWERS TO THE HORIZON. D52/D123.
   *
   * An out-of-range commander receives enough to draw the volley at the public
   * world and authoritative instant, but no real craft point, bearing, mass or
   * silhouette. Public spectacle must not become a back door through Telescope.
   */
  it('shows only the bombardment outside every sensor circle', async () => {
    const launch = await distantRaid();
    f.clock.set(new Date(launch.arriveAt.getTime() + 1));

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.effectOnly).toBe(true);
    expect(seen[0]?.kind).toBe('unknown');
    expect(seen[0]?.from).toEqual(seen[0]?.engagement?.target);
    expect(seen[0]?.to).toEqual(seen[0]?.engagement?.target);
    expect(seen[0]?.mass).toBeUndefined();
    expect(seen[0]?.silhouette).toBeUndefined();
    expect(seen[0]).not.toHaveProperty('fleet');
    expect(seen[0]?.engagement).toBeDefined();
    expect(seen[0]?.engagement?.endsAt.getTime())
      .toBe(engagementEndsAt(launch.arriveAt.getTime()));
  });

  it('shows a Radar contact beside the public bombardment, without a hull', async () => {
    await eyes(0, 3);
    const launch = await raidBetween(800, 1000);
    f.clock.set(new Date(launch.arriveAt.getTime() + 1));

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.effectOnly).toBeUndefined();
    expect(seen[0]?.kind).toBe('unknown');
    expect(seen[0]?.mass).toBeUndefined();
    expect(seen[0]?.silhouette).toBeUndefined();
    expect(seen[0]).not.toHaveProperty('fleet');
    expect(seen[0]?.from).not.toEqual(seen[0]?.to);
    expect(seen[0]?.engagement).toBeDefined();
  });

  it('lets upper Radar rungs describe the contact without turning it into sight', async () => {
    await eyes(0, 5);
    const launch = await distantRaid();
    f.clock.set(new Date(launch.arriveAt.getTime() + 1));

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.effectOnly).toBeUndefined();
    expect(seen[0]?.kind).toBe('unknown');
    expect(seen[0]?.mass).toBe('LIGHT');
    expect(seen[0]?.silhouette).toBe('fleet');
    expect(seen[0]).not.toHaveProperty('fleet');
    expect(seen[0]?.from).not.toEqual(seen[0]?.to);
    expect(seen[0]?.engagement).toBeDefined();
  });

  it('shows the exact fleet when Telescope identifies the engagement', async () => {
    await eyes(5, 0);
    const launch = await raidBetween(1000, 1300);
    f.clock.set(new Date(launch.arriveAt.getTime() + 1));

    const seen = await contacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.effectOnly).toBeUndefined();
    expect(seen[0]?.kind).toBe('fleet');
    expect(seen[0]?.mass).toBe('LIGHT');
    expect(seen[0]?.fleet).toEqual({ WASP: 30 });
    expect(seen[0]?.from).not.toEqual(seen[0]?.to);
    expect(seen[0]?.engagement).toBeDefined();
  });

  it('shows a strategic strike to the whole galaxy', async () => {
    const arriveAt = f.clock.now();
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: a,
      targetPlanetId: b,
      fleet: {},
      distance: 400,
      departAt: new Date(arriveAt.getTime() - 120_000),
      arriveAt,
    }).returning();
    await f.db.insert(strategicImpacts).values({
      seasonId: f.seasonId,
      missionId: mission!.id,
      attackerPlayerId: f.playerIds[1]!,
      defenderPlayerId: f.playerIds[2]!,
      targetPlanetId: b,
      outcome: 'FIRST_STRIKE',
      damage: 0,
      destroyedFleet: {},
      createdAt: arriveAt,
    });
    f.clock.set(new Date(arriveAt.getTime() + DEATH_STAR.impactSeconds * 500));

    const seen = await contacts();
    expect(seen.map((c) => c.kind)).toEqual(['unknown']);
    expect(seen[0]?.impact).toBeDefined();
    expect(seen[0]?.effectOnly).toBe(true);
    expect(seen[0]?.from).toEqual(seen[0]?.impact?.target);
    expect(seen[0]?.to).toEqual(seen[0]?.impact?.target);
    expect(seen[0]?.mass).toBeUndefined();
    expect(seen[0]?.silhouette).toBeUndefined();
    expect(seen[0]).not.toHaveProperty('fleet');

    await placeAt(f.db, mine, { x: 500 });
    await eyes(5, 0);
    const inSight = await contacts();
    expect(inSight.map((c) => c.kind)).toEqual(['death_star']);
    expect(inSight[0]?.impact).toBeDefined();
    expect(inSight[0]?.effectOnly).toBeUndefined();
  });

  /** D19 exposes the route after both craft sight and rock discovery are earned. */
  it('shows a discovered distant mining run in full, line and clock included', async () => {
    await eyes(5, 5);
    const rock = f.asteroids[0];
    if (!rock) throw new Error('private asteroid field is empty');
    const discoveredAt = rock.appearsAt + 0.01;
    f.clock.set(new Date(f.clock.now().getTime() + discoveredAt * 60_000));
    await placeAt(f.db, mine, asteroidPosition(rock, discoveredAt));
    await refreshSensorEpoch(f.db, mine, f.clock.now());

    const departAt = f.clock.now();
    const arriveAt = new Date(departAt.getTime() + 600_000);
    await f.db.insert(miningRuns).values({
      seasonId: f.seasonId,
      planetId: a,
      targetKind: 'asteroid',
      asteroidIndex: rock.index,
      status: 'outbound',
      craft: 2,
      holdEach: 1800,
      // Further out than the raid above, which the caller cannot see at all.
      // The rock the caller actually found, so the leg runs at their own eyes
      // rather than at a coordinate picked to be far from everything.
      interceptX: asteroidPosition(rock, discoveredAt).x,
      interceptY: asteroidPosition(rock, discoveredAt).y,
      interceptZ: asteroidPosition(rock, discoveredAt).z,
      departAt,
      arriveAt,
    });
    f.clock.set(new Date(departAt.getTime() + 300_000));

    const mining = (await contacts()).find((c) => c.kind === 'mining');
    expect(mining, 'the public race was swallowed by the fog').toBeDefined();
    expect(mining?.route, 'a race everybody can see keeps its whole line').toBeDefined();
    expect(mining?.minutesRemaining).toBeGreaterThan(0);
  });

  it('applies the Radar L4 mass reveal to mining contacts too', async () => {
    await eyes(0, 4);
    await placeAt(f.db, a, { x: 1_000 });
    const departAt = f.clock.now();
    const arriveAt = new Date(departAt.getTime() + 600_000);
    await f.db.insert(miningRuns).values({
      seasonId: f.seasonId,
      planetId: a,
      targetKind: 'asteroid',
      asteroidIndex: f.asteroids[0]!.index,
      status: 'outbound',
      craft: 2,
      holdEach: 1_800,
      interceptX: 1_300,
      interceptY: 0,
      interceptZ: 0,
      departAt,
      arriveAt,
    });
    f.clock.set(new Date(departAt.getTime() + 300_000));

    const [contact] = await contacts();
    expect(contact?.kind).toBe('unknown');
    expect(contact?.mass).toBe('LIGHT');
    expect(contact).not.toHaveProperty('craft');
    expect(contact).not.toHaveProperty('route');
  });

  /* ── a craft born inside the circle ────────────────────────── */

  /**
   * THE BUG THE OWNER FOUND BY PLAYING, AND THE REASON THE SHROUD IS GONE.
   *
   * "X gezegeninin telescope/radar menzilinde yaşayan Y gezegeni başka bir
   * gezegene filo gönderdiğinde, X hiçbir şey göremiyor." It was exactly true. The
   * departure shroud deleted every craft for the first 225 units of its leg — from
   * EVERYBODY, at every instrument level — so a fleet leaving a world 300 units
   * from a maxed Telescope was invisible for the first third of its flight, and a
   * probe (whose whole leg is nine seconds) was invisible for most of its life.
   *
   * The rule that replaced it has no memory of where a craft started. What decides
   * what you see is where the craft IS, relative to your own circles, and nothing
   * else. This test walks a leg from its first instant precisely because the old
   * rule could only fail at the beginning.
   */
  it('sees a craft from the instant it launches inside the circle', async () => {
    await eyes(5, 5);
    // Neighbours, both well inside the caller's telescope circle.
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, a, { x: 300 });
    await placeAt(f.db, b, { x: 900 });
    await giveUnits(f.db, a, { WASP: 30 });

    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;

    for (const share of [0.001, 0.05, 0.1, 0.25, 0.5, 0.9]) {
      f.clock.set(new Date(departAt + span * share));
      const seen = await contacts();
      expect(seen, `blind at ${String(share)} of the flight`).toHaveLength(1);
      expect(seen[0]?.kind).toBe('fleet');
    }
  });

  /**
   * AND A PROBE, WHICH IS WHERE THE OLD RULE HURT MOST.
   *
   * A probe's whole leg is seconds long, so a shroud measured in hundreds of units
   * covered most of it. Both legs are walked — out and home — because the owner's
   * report was specifically that a probe "disappears on the way back".
   */
  it('sees a probe on both legs when it flies inside the circle', async () => {
    await eyes(5, 5);
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, a, { x: 300 });
    await placeAt(f.db, b, { x: 900 });

    const launch = await launchProbe(f.db, a, b, f.clock);
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;

    for (const share of [0.01, 0.2, 0.5, 0.8]) {
      f.clock.set(new Date(departAt + span * share));
      const seen = await contacts();
      expect(seen.map((c) => c.kind), `outbound at ${String(share)}`).toEqual(['probe']);
    }
  });

  /* ── what sight says ───────────────────────────────────────── */

  it('keeps the size bucket and also names the exact hulls in sight', async () => {
    await eyes(5, 5);
    await placeAt(f.db, a, { x: 1000 });
    await placeAt(f.db, b, { x: 1300 });
    await distantRaid({ WASP: 2 });

    const [contact] = await contacts();
    expect(contact?.mass).toBe('LIGHT');
    expect(contact?.fleet).toEqual({ WASP: 2 });
  });

  it('reads a committed fleet as HEAVY', async () => {
    await eyes(5, 5);
    await placeAt(f.db, a, { x: 1000 });
    await placeAt(f.db, b, { x: 1300 });
    await distantRaid({ BULWARK: 30 });

    expect((await contacts())[0]?.mass).toBe('HEAVY');
  });

  /** The buckets are read off the constants, not off numbers typed in a test. */
  it('steps where the constants say it steps', () => {
    expect(SENSOR.massMedium).toBeLessThan(SENSOR.massHeavy);
    expect(SENSOR.baseRadius).toBeGreaterThan(0);
    expect(SENSOR.maxRadius).toBeGreaterThan(SENSOR.baseRadius);
  });

  /** Own craft are drawn from the owner's own payload; the horizon is irrelevant. */
  it('never applies the horizon to the caller’s own craft', async () => {
    await giveUnits(f.db, mine, { WASP: 30 });
    const [target] = await f.db.select().from(planets).where(eq(planets.id, b));
    expect(target).toBeDefined();
    const launch = await launchAttack(f.db, mine, b, { WASP: 30 }, f.clock);
    const now = f.clock.now().getTime();
    f.clock.set(new Date(now + (launch.arriveAt.getTime() - now) * 0.5));

    // Excluded because it is theirs, not because it is out of reach.
    expect(await contacts()).toEqual([]);
  });
});

/**
 * THE RADAR'S LONG CIRCLE, AND THE FACT THAT IT IS A CIRCLE. D126.
 *
 * `inbound` is the base product of `INTEL.radarContactRange`: something hostile is
 * coming for a world you hold, with no clock or bearing. L4 adds an EARLY size
 * estimate on this wide return; the tight `INTEL.radarRange` still sells the
 * countdown, and L5 keeps the exact roster and origin there.
 *
 * IT WAS SHIPPED TESTING THE LENGTH OF THE LEG, which is two opposite bugs in one
 * expression and this file exists to keep them out.
 *
 *   · TOO EARLY. A neighbour raiding from inside the radius was flagged at the
 *     instant of launch and stayed flagged for the entire flight. That is MORE
 *     than the timed ladder gives, and it is the thing D9 forbids in as many
 *     words: a forty-minute flight must not give forty minutes of warning.
 *   · NEVER. A raid launched from beyond the radius was never flagged at all —
 *     not when it was halfway, not in its final minute, not while it was standing
 *     over the world. The tier bought nothing against exactly the attacker a long
 *     reach is for.
 *
 * A radius is answered by WHERE THE CRAFT IS. Both halves are here.
 */
describe('the radar’s long circle', () => {
  let f: Fixture;
  /** The defender. Their radar is the one being asked. */
  let home: string;
  /** The attacker, far enough out that the leg is longer than any sense radius. */
  let far: string;
  /** A third world, so "aimed at somebody else" is a case and not a hypothetical. */
  let other: string;

  /**
   * DERIVED, BECAUSE IT WENT STALE. This was the literal `1100`, so the whole
   * suite failed the day the ladder moved — for a reason that had nothing to do
   * with what any of it was testing. What the tests actually need is a radius
   * SHORTER than the 3,000-unit leg, and that is asserted instead.
   */
  const SENSE_AT_L3 = radarContactRange(3);

  beforeEach(async () => {
    f = await seedWorld(4);
    [home, far, other] = f.planetIds as [string, string, string];

    await placeAt(f.db, home, { x: 0 });
    await placeAt(f.db, far, { x: 3000 });
    await placeAt(f.db, other, { x: 3200 });

    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    // The Uplink is the gate on both instruments that see (D25), so without it
    // the radar reports level 0 and this whole describe would test nothing.
    await giveSatellite(f.db, home, 'UPLINK');
    await giveInstrument(f.db, home, 'RADAR', 3);
    await setLevel(f.db, far, 'SHIPYARD', 3);
    await grant(f.db, far, 20_000, 5_000);
    await levelWorld(f.db, f.planetIds);
    expect(SENSE_AT_L3, 'the leg must outrun the radius').toBeLessThan(3000);
  });

  const seen = async () =>
    galaxyTraffic(f.db, f.seasonId, home, f.clock.now(), f.playerIds[0] ?? null, [home]);

  /** Fly a raid from `origin` to `target` and stop it at `share` of the way. */
  const raidTo = async (origin: string, target: string, share: number) => {
    await giveUnits(f.db, origin, { WASP: 30 });
    const launch = await launchAttack(f.db, origin, target, { WASP: 30 }, f.clock);
    const now = f.clock.now().getTime();
    f.clock.set(new Date(now + (launch.arriveAt.getTime() - now) * share));
    return launch;
  };

  /**
   * THE HALF THE OLD EXPRESSION COULD NEVER REACH. The leg is 3,000 long and the
   * radius is shorter than the 3,000-unit leg, so `mission.distance <= sense`
   * was false for the whole
   * flight — the defender got nothing while the fleet closed on them.
   */
  it('senses a raid from beyond the radius once it comes inside it', async () => {
    await raidTo(far, home, 0.8);
    const contact = (await seen())[0];
    expect(contact).toBeDefined();
    expect(contact?.inbound).toBe(true);
  });

  /** And is silent while the same raid is still outside the circle. */
  /**
   * AND OUTSIDE THE CIRCLE THERE IS NO CONTACT AT ALL, WHICH IS THE CHANGE.
   *
   * D125 published a craft at any distance as an anonymous return, so this used to
   * assert "a contact, without `inbound`". Under the owner's model the radar
   * circle is what buys the question mark: outside it a craft does not exist for
   * you. The absence IS the answer.
   */
  it('says nothing at all about the same raid while it is still outside', async () => {
    await raidTo(far, home, 0.1);
    expect(await seen()).toEqual([]);
  });

  /**
   * The circle is crossed once and the answer changes there — the property that
   * makes it a radius rather than a flag decided at launch.
   */
  it('turns on exactly once, on the way in', async () => {
    await giveUnits(f.db, far, { WASP: 30 });
    const launch = await launchAttack(f.db, far, home, { WASP: 30 }, f.clock);
    const depart = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - depart;

    const reads: boolean[] = [];
    for (const share of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      f.clock.set(new Date(depart + span * share));
      reads.push(Boolean((await seen())[0]?.inbound));
    }
    // Monotonic: false while far, true once near, and never back again.
    expect(reads).toEqual([...reads].sort((a, b) => Number(a) - Number(b)));
    expect(reads[0]).toBe(false);
    expect(reads.at(-1)).toBe(true);
  });

  /** Level zero has no Radar circle, so a zero radius senses nothing. */
  /**
   * NO RADAR, NO CIRCLE, AND SO NOTHING TO ATTRIBUTE.
   *
   * The ladder reaches from L1 now — the zeroes at L1 and L2 were inherited from
   * the pre-D49 minutes ladder and sold nothing — so the level that senses nothing
   * is the one nobody bought. The defender still has their naked eye, which is why
   * this puts the raid well outside it.
   */
  it('senses nothing at all with no radar installed', async () => {
    await giveInstrument(f.db, home, 'RADAR', 0);
    expect(radarContactRange(0)).toBe(0);
    await raidTo(far, home, 0.5);
    expect(await seen()).toEqual([]);
  });

  /**
   * IT IS ATTRIBUTED, AND ONLY TO THE WORLD BEING FLOWN AT. A raid crossing the
   * defender's neighbourhood on its way somewhere else is a contact like any
   * other; calling it inbound would turn the circle into a proximity alarm.
   */
  it('never marks a raid that is aimed at somebody else', async () => {
    await raidTo(far, other, 0.5);
    for (const contact of await seen()) expect(contact).not.toHaveProperty('inbound');
  });

  /** A fleet going home has stopped being a threat, and D126 excludes returns. */
  it('never marks a return leg', async () => {
    await giveUnits(f.db, far, { WASP: 30 });
    const launch = await launchAttack(f.db, far, home, { WASP: 30 }, f.clock);
    await f.db
      .update(missions)
      .set({ parentMissionId: launch.missionId })
      .where(eq(missions.id, launch.missionId));
    const now = f.clock.now().getTime();
    f.clock.set(new Date(now + (launch.arriveAt.getTime() - now) * 0.9));
    for (const contact of await seen()) expect(contact).not.toHaveProperty('inbound');
  });

  /**
   * THE PUBLIC CONTACT STILL HAS NO CLOCK. D126 currently merges detection and
   * timed-warning radii, but not their disclosure channels: the clock belongs to
   * the defender's private pending/notification payload.
   */
  it('at L3 carries no arrival, no size and no roster', async () => {
    /**
     * INSIDE THE CIRCLE AND OUTSIDE THE EYES. The leg is 3,000 long, so at 65%
     * the craft stands about 1,050 out — past `SENSOR.baseRadius` of 750, which
     * would identify it and hand over `mass` for a different and legitimate
     * reason, and inside the derived L3 Radar reach. That gap is the place the
     * public contact product can be read on its own.
     */
    await raidTo(far, home, 0.65);
    const contact = (await seen())[0];
    expect(contact?.kind).toBe('unknown');
    expect(contact?.inbound).toBe(true);
    expect(contact).not.toHaveProperty('mass');
    expect(contact).not.toHaveProperty('fleet');
    expect(contact).not.toHaveProperty('minutesRemaining');
    expect(contact).not.toHaveProperty('route');
    for (const level of [0, 1, 2, 3, 4, 5]) {
      expect(radarContactRange(level)).toBeGreaterThanOrEqual(radarRange(level));
    }
  });

  /**
   * L4's value is time, not an impossible monopoly on eyesight: it estimates the
   * force while it is still beyond the naked-eye/Telescope reach. Once the craft
   * comes inside that reach, every commander can judge the same silhouette.
   */
  it('at L4 estimates size before ordinary sight, without exposing a clock or roster', async () => {
    await giveInstrument(f.db, home, 'RADAR', 4);
    await raidTo(far, home, 0.65);

    const contact = (await seen())[0];
    expect(contact?.kind).toBe('unknown');
    expect(contact?.inbound).toBe(true);
    expect(contact?.mass).toBe('LIGHT');
    expect(contact).not.toHaveProperty('fleet');
    expect(contact).not.toHaveProperty('minutesRemaining');
    expect(contact).not.toHaveProperty('route');
  });
});
