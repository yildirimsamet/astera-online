import { MULTI_WORLD } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  attackCommitments,
  battleReports,
  missions,
  notifications,
  planets,
  seasons,
  units,
} from '../src/db/schema.js';
import { forceRecoveryShield } from '../src/services/attackProtection.js';
import { hasHostileFlightWithClan } from '../src/services/clanCombat.js';
import { isHostileMission } from '../src/services/flight.js';
import { fleetTruthFor } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { recallFlight } from '../src/services/movement.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * CALLING A RAID BACK. Decision K8 (docs/ui-v2/gozlemevi.md), owner 2026-09-23.
 *
 * The transfer rule, applied to an attack: once, while it is still flying toward
 * the target; the way home takes as long as was already flown; the fuel paid at
 * launch stays spent; it always fits at home; there is no last-minute lock. No
 * battle happens, so no report is written and the hit does not count against the
 * repeat-attack limit. The defender is no longer warned of a fleet that is not
 * coming, and the galaxy watches it fly home like any other flight.
 */
describe('recalling an attack', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let me: string;
  let them: string;

  const worker = (): EventWorker =>
    new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

  const homeCount = async (planetId: string): Promise<number> => {
    const rows = await f.db.select().from(units).where(eq(units.planetId, planetId));
    return rows.filter((r) => r.location === 'home').reduce((n, r) => n + r.count, 0);
  };

  const raid = () => launchAttack(f.db, mine, theirs, { DART: 20 }, f.clock);

  /** Past the landing and the worker run: whatever was going to settle has settled. */
  const land = async (at: Date): Promise<void> => {
    f.clock.set(new Date(at.getTime() + 60_000));
    await worker().tick();
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    [me, them] = f.playerIds as [string, string];
    for (const id of [mine, theirs]) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 2);
      await grant(f.db, id, 300_000, 60_000);
    }
    // Far enough apart that the flight lasts long enough to turn around mid-way.
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, theirs, { x: 4_000 });
    for (const id of [mine, theirs]) await setLevel(f.db, id, 'CORE', 8);
    await fuelUp(f.db, mine, 200_000);
    f.clock.advance(250);
    await giveUnits(f.db, mine, { DART: 20 });
  });

  it('turns a raid around and brings every ship home, with no battle at the target', async () => {
    const launched = await raid();
    expect(await homeCount(mine)).toBe(0);

    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    await land(recall.arriveAt);

    expect(await homeCount(mine)).toBe(20);
    const reports = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(reports).toHaveLength(0);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(row!.status).toBe('resolved');
    expect(row!.loot).toBeNull();
  });

  it('takes exactly as long to come back as it had already flown', async () => {
    const departedAt = f.clock.now();
    const launched = await raid();
    f.clock.advance(3);
    const turnedAt = f.clock.now();
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);

    const flown = (turnedAt.getTime() - departedAt.getTime()) / 60_000;
    const back = (recall.arriveAt.getTime() - turnedAt.getTime()) / 60_000;
    expect(back).toBeCloseTo(flown, 6);
  });

  it('keeps the fuel paid at launch spent, and refunds none of it', async () => {
    const launched = await raid();
    const [afterLaunch] = await f.db.select().from(planets).where(eq(planets.id, mine));
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    await land(recall.arriveAt);

    const [afterLanding] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(row!.fuelPaid).toBeGreaterThan(0);
    expect(afterLanding!.deuterium).toBeLessThanOrEqual(afterLaunch!.deuterium + 1);
  });

  it('always fits at home, however full the hangar is', async () => {
    const launched = await raid();
    await setLevel(f.db, mine, 'HANGAR', 0);
    await giveUnits(f.db, mine, { DART: 400 });
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    await land(recall.arriveAt);
    expect(await homeCount(mine)).toBe(420);
  });

  it('lets a raid turn only once', async () => {
    const launched = await raid();
    f.clock.advance(1);
    await recallFlight(f.db, launched.missionId, f.clock, me);
    f.clock.advance(0.5);
    await expect(recallFlight(f.db, launched.missionId, f.clock, me))
      .rejects.toMatchObject({ code: 'NOT_RECALLABLE' });
  });

  it('still turns a second before it arrives: there is no last-minute lock', async () => {
    const launched = await raid();
    f.clock.set(new Date(launched.arriveAt.getTime() - 1_000));
    await expect(recallFlight(f.db, launched.missionId, f.clock, me)).resolves.toBeDefined();
  });

  it('refuses once the fleet has reached the target', async () => {
    const launched = await raid();
    f.clock.set(launched.arriveAt);
    await expect(recallFlight(f.db, launched.missionId, f.clock, me))
      .rejects.toMatchObject({ code: 'NOT_RECALLABLE' });
  });

  it('refuses another commander’s raid', async () => {
    const launched = await raid();
    f.clock.advance(1);
    await expect(recallFlight(f.db, launched.missionId, f.clock, them))
      .rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  });

  /*
    Since the clan ruleset the limit counts LAUNCHES (`attack_commitments`), so the turn has to hand
    the entry back. Older seasons count battle reports, which a turned raid never writes.
  */
  it('does not count against the repeat-attack limit, because nothing was fought', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.clanRulesetVersion });
    const launched = await raid();
    const before = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, launched.missionId));
    expect(before).toHaveLength(1);

    f.clock.advance(1);
    await recallFlight(f.db, launched.missionId, f.clock, me);
    const after = await f.db.select().from(attackCommitments)
      .where(eq(attackCommitments.missionId, launched.missionId));
    expect(after).toHaveLength(0);
  });

  it('stops warning the defender about a fleet that is no longer coming', async () => {
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    const launched = await raid();
    // Twenty seconds out: inside every radar circle, so the defender is being warned.
    f.clock.set(new Date(launched.arriveAt.getTime() - 20_000));
    expect((await pendingThreads(f.db, theirs, f.clock.now())).map((t) => t.kind)).toContain('incoming');

    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    expect((await pendingThreads(f.db, theirs, f.clock.now())).map((t) => t.kind)).not.toContain('incoming');

    // Every scheduled event runs, the radar warning included: none of it reaches the defender.
    await land(new Date(Math.max(recall.arriveAt.getTime(), launched.arriveAt.getTime())));
    const told = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, them),
      eq(notifications.kind, 'incoming_fleet'),
    ));
    expect(told).toHaveLength(0);
  });

  it('is not a hostile flight once it has turned', async () => {
    const launched = await raid();
    const [out] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(isHostileMission(out!)).toBe(true);
    f.clock.advance(1);
    await recallFlight(f.db, launched.missionId, f.clock, me);
    const [turned] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(isHostileMission(turned!)).toBe(false);
  });

  it('offers the recall on your own outbound raid, and names a turned one after where it turned back from', async () => {
    const launched = await raid();
    f.clock.advance(1);
    const [out] = await pendingThreads(f.db, mine, f.clock.now());
    expect(out!.recallable).toBe(true);

    await recallFlight(f.db, launched.missionId, f.clock, me);
    const [home] = await pendingThreads(f.db, mine, f.clock.now());
    expect(home!.recallable).toBeUndefined();
    expect(home!.leg).toBe('return');
    expect(home!.targetPlanetId).toBe(theirs);
    expect(home!.path!.departAt.getTime()).toBe(f.clock.now().getTime());
  });

  it('tells the owner it is home, from the world it turned back from, with nothing in the hold', async () => {
    const launched = await raid();
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    await land(recall.arriveAt);

    const [note] = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, me),
      eq(notifications.kind, 'fleet_returned'),
    ));
    expect(note!.payload).toMatchObject({ trip: 'raid', recalled: true, ships: 20, fromPlanetId: theirs, lootAlloy: 0 });
  });

  /**
   * A commander with a raid in the air collects no recovery shield — a shield earned
   * while attacking inverts the rule. A raid that turned is a fleet coming home, like
   * a return leg, and no longer stands in the way.
   */
  it('stops blocking the recovery shield once it has turned', async () => {
    const launched = await raid();
    f.clock.advance(1);
    const shield = () => f.db.transaction((tx) => forceRecoveryShield(tx, { playerId: me, planetId: mine, now: f.clock.now() }));
    expect(await shield()).toBeNull();
    await recallFlight(f.db, launched.missionId, f.clock, me);
    expect(await shield()).not.toBeNull();
  });

  it('is no longer a hostile flight between the two when a clan weighs a recruit', async () => {
    const launched = await raid();
    f.clock.advance(1);
    expect(await hasHostileFlightWithClan(f.db, me, [them])).toBe(true);
    await recallFlight(f.db, launched.missionId, f.clock, me);
    expect(await hasHostileFlightWithClan(f.db, me, [them])).toBe(false);
  });

  /** The Telescope reads a world's fleet as away; a turned raid is home when it lands, not a round trip later. */
  it('reads the turned fleet as home at its new landing', async () => {
    const launched = await raid();
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, me);
    const truth = await fleetTruthFor(f.db, [mine], f.clock.now());
    expect(truth.get(mine)).toEqual({ status: 'AWAY', expectedHomeAt: recall.arriveAt });
  });
});
