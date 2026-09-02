import { and, eq, inArray } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, SERVERS, radarLead, radarRange } from '@astera/rules';
import {
  buildings,
  clanMemberships,
  clans,
  miningRuns,
  missions,
  notifications,
  planets,
  players,
  scheduledEvents,
  notificationKind,
} from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchAttack } from '../src/services/mission.js';
import { inboundRadarLead, wakeInboundRadarWarnings } from '../src/services/radar.js';
import { assignWatch, launchProbe } from '../src/services/intel.js';
import { launchMining } from '../src/services/mining.js';
import { activeAsteroids, generateGalaxy } from '@astera/rules';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  makeAccount,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  truncateAll,
  type Fixture,
} from './helpers.js';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';

/**
 * WHAT THE GAME TELLS YOU IT DID. D45.
 *
 * Nothing in this suite existed, and that is why every bug it now pins shipped.
 * `notify()` was tested as a CRUD list — rows go in, rows come out, another
 * player's rows do not — and not once as the thing it actually is: the only
 * mechanism by which a player learns that the world moved while they were not
 * looking. So an attacker was never told the outcome of their own raid, a probe
 * came home in silence, a mining run reported a payload the client could not
 * read, and a redelivered radar warning wrote itself twice. All four passed a
 * green build.
 */

const silent = pino({ level: 'silent' });
const makeWorker = (f: Fixture): EventWorker =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

const minutesBefore = (at: Date, minutes: number): Date =>
  new Date(at.getTime() - minutes * 60_000);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

async function newsFor(f: Fixture, playerId: string) {
  return f.db
    .select()
    .from(notifications)
    .where(eq(notifications.playerId, playerId));
}

const kindsFor = async (f: Fixture, playerId: string): Promise<string[]> =>
  (await newsFor(f, playerId)).map((n) => n.kind);

/** Give one test commander an active public identity without exercising clan admission. */
async function affiliate(f: Fixture, playerIndex: number, tag: string): Promise<void> {
  const at = f.clock.now();
  const [clan] = await f.db.insert(clans).values({
    seasonId: f.seasonId,
    name: `${tag} Fleet`,
    nameKey: `${tag.toLowerCase()} fleet`,
    tag,
    createdAt: at,
  }).returning({ id: clans.id });
  await f.db.insert(clanMemberships).values({
    seasonId: f.seasonId,
    clanId: clan!.id,
    playerId: f.playerIds[playerIndex]!,
    role: 'LEADER',
    slot: 0,
    joinedAt: at,
    matureAt: at,
    aidPolicyChangedAt: at,
  });
}

describe('a raid tells both sides', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [attacker, defender] = f.planetIds as [string, string];
    await setLevel(f.db, attacker, 'CORE', 6);
    await setLevel(f.db, defender, 'CORE', 6);
    await giveSatellite(f.db, defender, 'UPLINK');
    await grant(f.db, defender, 30_000, 3_000);
  });

  it('tells the defender what was taken and the attacker what it cost', async () => {
    await affiliate(f, 0, 'WAR');
    await affiliate(f, 1, 'GRD');
    await giveUnits(f.db, attacker, { DART: 40 });
    f.clock.advance(300);
    const launch = await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    const worker = makeWorker(f);
    await worker.tick();

    const [raided] = await newsFor(f, f.playerIds[1]!).then((rows) =>
      rows.filter((r) => r.kind === 'raided'),
    );
    expect(raided).toBeDefined();
    expect(raided!.refId).toBe(launch.missionId);
    expect(raided!.payload).toMatchObject({
      grade: expect.any(String) as string,
      originPlanetId: attacker,
      originUsername: expect.any(String) as string,
      originClanTag: 'WAR',
      originPlanetName: expect.any(String) as string,
    });

    const [result] = await newsFor(f, f.playerIds[0]!).then((rows) =>
      rows.filter((r) => r.kind === 'raid_result'),
    );
    expect(result, 'the attacker was told nothing at all').toBeDefined();
    expect(result!.refId).toBe(launch.missionId);
    expect(result!.payload).toMatchObject({
      targetPlanetId: defender,
      targetUsername: expect.any(String) as string,
      targetClanTag: 'GRD',
      targetPlanetName: expect.any(String) as string,
    });

    const [returnMission] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'return'), eq(missions.parentMissionId, launch.missionId)));
    expect(returnMission, 'the surviving raid had no return leg').toBeDefined();
    f.clock.set(settledAt(returnMission!.arriveAt));
    await worker.tick();
    const returned = (await newsFor(f, f.playerIds[0]!))
      .find((row) => row.kind === 'fleet_returned');
    expect(returned?.payload).toMatchObject({ fromClanTag: 'GRD' });
  });

  /**
   * THE CASE THE WHOLE KIND EXISTS FOR.
   *
   * No survivors means no return leg, and the return leg used to be the ONLY thing
   * that ever told an attacker anything. So the most expensive event in the game
   * produced no notification, no stream event, and therefore not even a refetch —
   * measured, on a fleet annihilated by ground defence.
   */
  it('tells an attacker whose fleet was annihilated', async () => {
    await giveUnits(f.db, attacker, { DART: 3 });
    await giveUnits(f.db, defender, { THORN: 60 });
    f.clock.advance(300);
    const launch = await launchAttack(f.db, attacker, defender, { DART: 3 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await makeWorker(f).tick();

    const rows = await newsFor(f, f.playerIds[0]!);
    const result = rows.find((r) => r.kind === 'raid_result');
    expect(result).toBeDefined();
    expect(result!.payload).toMatchObject({ shipsHome: 0 });
  });

  /** Idempotent by `(player, kind, refId)`, so a redelivered arrival says it once. */
  it('says it once however many times the arrival is delivered', async () => {
    await giveUnits(f.db, attacker, { DART: 40 });
    f.clock.advance(300);
    const launch = await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));

    const worker = makeWorker(f);
    await worker.tick();
    await f.db
      .update(scheduledEvents)
      .set({ status: 'pending', claimedAt: null })
      .where(
        and(
          eq(scheduledEvents.kind, 'mission_arrival'),
          eq(scheduledEvents.refId, launch.missionId),
        ),
      );
    await worker.tick();

    const rows = await newsFor(f, f.playerIds[1]!);
    expect(rows.filter((r) => r.kind === 'raided')).toHaveLength(1);
  });
});

/**
 * THE RADAR LADDER, READ WHEN IT FIRES RATHER THAN WHEN THE FLEET LEFT. D45.
 *
 * The level used to be frozen into the event's payload at launch, which was wrong
 * in both directions and measurably so — see each case below. D9 is unchanged
 * throughout: the warning fires at `arriveAt − lead`, never at launch.
 */
describe('the radar warning', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [attacker, defender] = f.planetIds as [string, string];
    // Far enough apart that a Wasp flight is longer than the longest radar lead,
    // so every rung of the ladder is reachable inside one flight.
    await placeAt(f.db, defender, { x: 4000 });
    await setLevel(f.db, attacker, 'CORE', 6);
    await setLevel(f.db, defender, 'CORE', 6);
    await giveSatellite(f.db, defender, 'UPLINK');
    await grant(f.db, defender, 30_000, 3_000);
    await giveUnits(f.db, attacker, { DART: 40 });
    f.clock.advance(300);
  });

  const launch = () => launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);

  /**
   * THE WARNING THIS LEVEL ACTUALLY BUYS ON THIS LEG, IN MINUTES.
   *
   * Every case below used to name a fixed marker — twelve minutes out, eight, five
   * — which read correctly while a Wasp crossing this leg took an hour and became
   * nonsense at D63's speeds, where the whole flight is thirteen minutes and Radar
   * L5 buys 1.6 of them. All six failed at once, and none of them because the
   * radar had changed.
   *
   * The lead is what the ladder sells (D49: a RADIUS, not a countdown), so it is
   * what the markers are expressed in. The helper below reads the same endpoint
   * clearances as the server, so the test cannot drift back to centre distance.
   */
  const leadFor = async (missionId: string, level: number): Promise<number> => {
    const [row] = await f.db.select().from(missions).where(eq(missions.id, missionId));
    const [worldRows, coreRows] = await Promise.all([
      f.db.select().from(planets)
        .where(inArray(planets.id, [row!.originPlanetId, row!.targetPlanetId])),
      f.db.select({ planetId: buildings.planetId, level: buildings.level })
        .from(buildings)
        .where(and(
          inArray(buildings.planetId, [row!.originPlanetId, row!.targetPlanetId]),
          eq(buildings.type, 'CORE'),
        )),
    ]);
    const worldById = new Map(worldRows.map((world) => [world.id, world]));
    const coreById = new Map(coreRows.map((building) => [building.planetId, building.level]));
    const origin = worldById.get(row!.originPlanetId)!;
    const target = worldById.get(row!.targetPlanetId)!;
    const oneWay = (row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000;
    return inboundRadarLead(radarRange(level), {
      from: origin,
      to: target,
      originCoreLevel: coreById.get(origin.id) ?? 1,
      targetCoreLevel: coreById.get(target.id) ?? 1,
      oneWayMinutes: oneWay,
    });
  };

  it('warns at the lead the level buys, and not before', async () => {
    await giveInstrument(f.db, defender, 'RADAR', 3);
    const { arriveAt, missionId } = await launch();
    const lead = await leadFor(missionId, 3);
    const worker = makeWorker(f);

    // Three times this defender's reach: the event is due, but they have not
    // bought a warning this early.
    f.clock.set(minutesBefore(arriveAt, lead * 3));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual([]);

    // Still outside the circle, and still not theirs.
    f.clock.set(minutesBefore(arriveAt, lead * 1.5));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual([]);

    // Inside it.
    f.clock.set(minutesBefore(arriveAt, lead * 0.5));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual(['incoming_fleet']);
  });

  it('waits for the drawn fleet to enter the shell instead of using centre-to-centre distance', async () => {
    /*
      THE LEG HAS TO OUTRUN THE CIRCLE, or there is no crossing to measure. It was
      800 units against a Radar 3 that reached 190; the ladder reaches 1,300 now,
      so a leg shorter than that saturates and both leads become the whole flight.
      Stated as a multiple of the radius rather than as a literal, so the next
      table change cannot quietly turn this into a test of nothing.
    */
    const leg = radarRange(3) * 2;
    await placeAt(f.db, attacker, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, defender, { x: leg, y: 0, z: 0 });
    await setLevel(f.db, attacker, 'CORE', 12);
    await setLevel(f.db, defender, 'CORE', 12);
    await giveInstrument(f.db, defender, 'RADAR', 3);
    const { arriveAt, missionId } = await launch();
    const visualLead = await leadFor(missionId, 3);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, missionId));
    const oneWay = (row!.arriveAt.getTime() - row!.departAt.getTime()) / 60_000;
    const centreLead = radarLead(radarRange(3), row!.distance, oneWay);
    expect(centreLead).toBeGreaterThan(visualLead);

    // At the old calculation's crossing the marker is still outside the shell.
    f.clock.set(minutesBefore(arriveAt, (centreLead + visualLead) / 2));
    await makeWorker(f).tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual([]);

    f.clock.set(minutesBefore(arriveAt, visualLead * 0.5));
    await makeWorker(f).tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual(['incoming_fleet']);
  });

  /**
   * THE LADDER IS A LADDER — EACH RUNG WARNS AT ITS OWN CIRCLE, NOT A WIDER ONE.
   *
   * `LEAD_TOLERANCE` exists to absorb the gap between an event's scheduled instant
   * and the moment a worker claims it. At half a minute it was thirty times the
   * poll interval, which was merely generous until D63 — and then Radar L3's lead
   * fell to 0.65 minutes on a long leg, so the tolerance was 77% of the whole
   * warning and an L3 defender received most of L4's. The ladder is what the radar
   * is sold on, so it gets an assertion rather than a comment.
   *
   * Written against the leads the rules compute, so it holds at any hull speed.
   */
  it('gives each rung its own circle, and never a wider one', async () => {
    await giveInstrument(f.db, defender, 'RADAR', 3);
    const { arriveAt, missionId } = await launch();
    const low = await leadFor(missionId, 3);
    const high = await leadFor(missionId, 5);
    expect(high, 'a higher rung must buy more warning').toBeGreaterThan(low);

    const worker = makeWorker(f);
    // Standing where a Radar 5 would already have spoken, an L3 must not.
    f.clock.set(minutesBefore(arriveAt, high * 0.9));
    await worker.tick();
    expect(
      await kindsFor(f, f.playerIds[1]!),
      'an L3 defender was warned at an L5 distance',
    ).toEqual([]);

    // And at its own circle it does.
    f.clock.set(minutesBefore(arriveAt, low * 0.5));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual(['incoming_fleet']);
  });

  /**
   * A DEFENDER WHO BUYS A RADAR MID-FLIGHT IS WARNED BY IT.
   *
   * No radar at launch meant no event was ever scheduled, so installing one while
   * a fleet was in the air bought nothing — while `pendingThreads`, which reads
   * the live level, put "inbound fleet" on their strip. One fact, two surfaces,
   * opposite answers.
   */
  it('is bought by a radar installed while the fleet is in the air', async () => {
    const { arriveAt, missionId } = await launch();
    const lead = await leadFor(missionId, 5);
    const worker = makeWorker(f);

    // Outside even the widest reach, and with no radar to hear it anyway.
    f.clock.set(minutesBefore(arriveAt, lead * 3));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual([]);

    await giveInstrument(f.db, defender, 'RADAR', 5);
    f.clock.set(minutesBefore(arriveAt, lead * 0.5));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual(['incoming_fleet']);
  });

  /**
   * AND A LONGER LEAD CANNOT BE BOUGHT RETROACTIVELY.
   *
   * Radar 5 sells twelve minutes of warning. Installed with eight minutes to run,
   * it can only give eight — the warning still fires at `arriveAt − lead` for
   * every lead the ladder sells, and the ones already past are past.
   */
  it('gives the richer payload to a level raised mid-flight', async () => {
    await affiliate(f, 0, 'WAR');
    await giveInstrument(f.db, defender, 'RADAR', 3);
    const { arriveAt, missionId } = await launch();

    await giveInstrument(f.db, defender, 'RADAR', 5);
    f.clock.set(minutesBefore(arriveAt, (await leadFor(missionId, 5)) * 0.5));
    await makeWorker(f).tick();

    const [warning] = await newsFor(f, f.playerIds[1]!);
    expect(warning).toBeDefined();
    // L4 buys a coarse mass band, L5 the composition and the world it left.
    expect(warning!.payload).toMatchObject({
      mass: 'MEDIUM',
      fleet: { DART: 40 },
      originPlanetId: attacker,
      originUsername: expect.any(String) as string,
      originClanTag: 'WAR',
      originPlanetName: expect.any(String) as string,
    });
    expect(warning!.payload).not.toHaveProperty('estimatedShips');
  });

  it('never warns a planet with no radar, and stops asking', async () => {
    const { arriveAt, missionId } = await launch();
    const worker = makeWorker(f);

    // Right through the widest reach the ladder sells and out the other side, so
    // "never warns" means never — not merely "not yet".
    const widest = await leadFor(missionId, 5);
    for (const share of [3, 1.5, 0.75]) {
      f.clock.set(minutesBefore(arriveAt, widest * share));
      await worker.tick();
    }
    const narrowest = await leadFor(missionId, 3);
    f.clock.set(minutesBefore(arriveAt, narrowest * 0.5));
    await worker.tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual([]);

    // The chain terminated rather than rescheduling itself for ever.
    const pending = await f.db
      .select()
      .from(scheduledEvents)
      .where(
        and(eq(scheduledEvents.kind, 'radar_warning'), eq(scheduledEvents.status, 'pending')),
      );
    expect(pending).toHaveLength(0);
  });

  it('wakes a warning when Radar is installed after the ordinary checks have ended', async () => {
    const { arriveAt, missionId } = await launch();
    const narrowest = await leadFor(missionId, 3);
    f.clock.set(minutesBefore(arriveAt, narrowest * 0.5));
    await makeWorker(f).tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual([]);

    await giveInstrument(f.db, defender, 'RADAR', 5);
    await wakeInboundRadarWarnings(f.db, defender, f.clock.now());
    await makeWorker(f).tick();
    expect(await kindsFor(f, f.playerIds[1]!)).toEqual(['incoming_fleet']);
  });

  /**
   * A worker killed between COMMIT and `complete()` has its event returned to the
   * queue by the reaper. Nothing guarded this one, and a redelivery wrote a SECOND
   * "incoming fleet" with a fresh ETA on it — the same raid, announced twice, at
   * two different distances. Measured before it was fixed.
   */
  it('writes one warning however many times the event is delivered', async () => {
    await giveInstrument(f.db, defender, 'RADAR', 5);
    const { arriveAt, missionId } = await launch();
    const lead = await leadFor(missionId, 5);
    const worker = makeWorker(f);

    f.clock.set(minutesBefore(arriveAt, lead * 0.6));
    await worker.tick();

    await f.db
      .update(scheduledEvents)
      .set({ status: 'pending', claimedAt: null })
      .where(
        and(eq(scheduledEvents.kind, 'radar_warning'), eq(scheduledEvents.refId, missionId)),
      );
    f.clock.set(minutesBefore(arriveAt, lead * 0.4));
    await worker.tick();

    expect(await kindsFor(f, f.playerIds[1]!)).toEqual(['incoming_fleet']);
  });

  /** The countdown is stored as an instant, so a row read later is not a lie. */
  it('carries the arrival instant, not only a countdown', async () => {
    await giveInstrument(f.db, defender, 'RADAR', 5);
    const { arriveAt, missionId } = await launch();
    f.clock.set(minutesBefore(arriveAt, (await leadFor(missionId, 5)) * 0.5));
    await makeWorker(f).tick();

    const [warning] = await newsFor(f, f.playerIds[1]!);
    expect(warning!.payload).toMatchObject({ arriveAt: arriveAt.toISOString() });
  });
});

describe('a probe coming home', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2);
    await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 2);
    await grant(f.db, f.planetIds[0]!, 30_000, 3_000);
  });

  /**
   * The probe round trip used to end by setting a timestamp and stopping: no
   * notification, no stream event, so not even the intel panel refreshed for a
   * player who had it open. The most deliberate purchase in the game arrived in
   * silence.
   */
  it('says so, once, and names what is now readable', async () => {
    await affiliate(f, 1, 'SCN');
    f.clock.advance(300);
    const probe = await launchProbe(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
    const worker = makeWorker(f);

    // Out, then back.
    f.clock.set(probe.arriveAt);
    await worker.tick();
    f.clock.advance(120);
    await worker.tick();

    const rows = (await newsFor(f, f.playerIds[0]!)).filter((r) => r.kind === 'probe_report');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({
      targetPlanetId: f.planetIds[1],
      targetUsername: expect.any(String) as string,
      targetClanTag: 'SCN',
      targetPlanetName: expect.any(String) as string,
    });
  });
});

describe('a mining run coming home', () => {
  let f: Fixture;

  /** Advance until a rock is crossing, so the test never races the schedule. */
  const waitForRock = (): { index: number } => {
    const spec = generateGalaxy(4242, 60);
    for (let i = 0; i < 400; i++) {
      const minutes =
        (f.clock.now().getTime() - new Date('2026-01-01T00:00:00.000Z').getTime()) / 60_000;
      const usable = activeAsteroids(spec.asteroids, minutes).find(
        (a) => a.expiresAt - minutes > 45,
      );
      if (usable) return usable;
      f.clock.advance(30);
    }
    throw new Error('no usable asteroid found');
  };

  beforeEach(async () => {
    f = await seedWorld(2);
    await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 2);
    await grant(f.db, f.planetIds[0]!, 30_000, 3_000);
    await giveUnits(f.db, f.planetIds[0]!, { PROSPECTOR: 2 });
  });

  /**
   * THE PAYLOAD THE CLIENT COULD NOT READ.
   *
   * It shared not one field with the schema the client parsed, so every drill and
   * every salvage run in the game reported "Your fleet is home." — no ore, no
   * waste, nothing. `contract.test.ts` now runs the client's own parser over this
   * row, which is the only test that could have caught it.
   */
  it('reports the ore it delivered and the ore it had to throw away', async () => {
    const rock = waitForRock();
    const run = await launchMining(f.db, f.planetIds[0]!, rock.index, 2, f.clock);
    const worker = makeWorker(f);

    f.clock.set(run.arriveAt);
    await worker.tick();
    // The way home is the same flight again; the return event carries its own
    // instant, so advancing past it is enough.
    /**
     * ADVANCE TO THE STORED `homeAt`, NEVER BY THE OUTBOUND FLIGHT.
     *
     * This read `run.flightMinutes + 1`, which quietly assumed the trip back takes
     * the same as the trip out. D117 made it three times longer, so the clock
     * stopped short of the return and no notification had been written yet. The
     * row is the authority on when the craft lands — it is what schedules the
     * event — so reading it is both correct and immune to the next change.
     */
    const [turned] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(new Date(turned!.homeAt!.getTime() + 1_000));
    await worker.tick();

    const rows = (await newsFor(f, f.playerIds[0]!)).filter((r) => r.kind === 'fleet_returned');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toMatchObject({
      trip: 'mining',
      craft: 2,
      alloy: expect.any(Number) as number,
      wastedAlloy: expect.any(Number) as number,
    });
  });
});

/**
 * DESIGN LAW #2, WHICH HAD NO DELIVERY MECHANISM AT ALL. D45.
 *
 * `currentUnlocks`, `UNLOCK_COPY`, `/api/session/unlocks` and the client's
 * `useUnlocks` all existed and nothing imported any of them — the only surface
 * that ever announced an unlock was the return overlay D23 deleted. So "every
 * system unlocks at the moment the player feels its absence" was computed
 * correctly and told to nobody.
 */
describe('the unlock cascade', () => {
  let f: Fixture;

  beforeEach(async () => {
    // Three worlds: the second raid needs a second target, because a fleet is
    // still coming home from the first and one fleet per target is the rule.
    f = await seedWorld(3);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
    for (const id of f.planetIds.slice(1)) await grant(f.db, id, 30_000, 3_000);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 40 });
  });

  it('announces the telescope to both sides of a first battle, and the radar to the one hit', async () => {
    f.clock.advance(300);
    const launch = await launchAttack(
      f.db,
      f.planetIds[0]!,
      f.planetIds[1]!,
      { DART: 40 },
      f.clock,
    );
    f.clock.set(settledAt(launch.arriveAt));
    await makeWorker(f).tick();

    const unlocked = async (playerId: string): Promise<unknown[]> =>
      (await newsFor(f, playerId))
        .filter((r) => r.kind === 'unlock')
        .map((r) => r.payload.unlock);

    expect(await unlocked(f.playerIds[0]!)).toEqual(['TELESCOPE']);
    // Being on the receiving end is what opens the radar.
    expect(await unlocked(f.playerIds[1]!)).toEqual(['TELESCOPE', 'RADAR']);
  });

  it('records what it has announced, so a second battle repeats nothing', async () => {
    f.clock.advance(300);
    const first = await launchAttack(
      f.db,
      f.planetIds[0]!,
      f.planetIds[1]!,
      { DART: 20 },
      f.clock,
    );
    f.clock.set(settledAt(first.arriveAt));
    const worker = makeWorker(f);
    await worker.tick();

    // Let the survivors get home: one fleet per target, both legs.
    f.clock.advance(240);
    await worker.tick();

    const second = await launchAttack(
      f.db,
      f.planetIds[0]!,
      f.planetIds[1]!,
      { DART: 20 },
      f.clock,
    );
    f.clock.set(settledAt(second.arriveAt));
    await worker.tick();

    const rows = (await newsFor(f, f.playerIds[0]!)).filter((r) => r.kind === 'unlock');
    expect(rows).toHaveLength(1);

    const [player] = await f.db
      .select({ seen: players.unlocksSeen })
      .from(players)
      .where(eq(players.id, f.playerIds[0]!));
    expect(player!.seen).toContain('TELESCOPE');
  });

  /** "I can't tell if he's rich" — pointing a telescope is what opens the Explorer. */
  it('announces the explorer the first time a telescope is pointed at anybody', async () => {
    await giveSatellite(f.db, f.planetIds[0]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[0]!, 'TELESCOPE', 3);
    await assignWatch(f.db, f.planetIds[0]!, f.planetIds[1]!, 0, f.clock);

    const rows = (await newsFor(f, f.playerIds[0]!)).filter((r) => r.kind === 'unlock');
    expect(rows.map((r) => r.payload.unlock)).toEqual(['EXPLORER']);
  });
});

/**
 * A RAID ON A CARETAKER WORLD TELLS THE RAIDER. D121a.
 *
 * `resolveNeutralBattle` wrote a battle report and notified nobody, so the closing
 * link of the loop existed only for a commander who thought to go and look for it:
 * no badge on the beacon, no row in Signals, and — since D121 gave every kind of
 * news a door — no way in to the report either. Fifty-one of the worlds on the
 * disc are caretaker worlds and the whole colonisation path runs through raiding
 * them, so this was most of the early game happening in silence.
 */
describe('a raid on an unclaimed world', () => {
  it('reaches the raider’s own notifications, like any other raid', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-NEUTRAL-NEWS',
      seed: 91273,
      startsAt: clock.now(),
      playerCap: SERVERS.capacity,
      rulesetVersion: MULTI_WORLD.rulesetVersion,
    });
    const account = await makeAccount(db, 'Raider');
    const joined = await joinSeason(db, account.id, season.id, clock);
    const [caretaker] = await db
      .select({ id: planets.id, name: planets.name })
      .from(planets)
      .where(and(eq(planets.seasonId, season.id), eq(planets.kind, 'NEUTRAL')))
      .limit(1);
    expect(caretaker).toBeDefined();
    const caretakerName = caretaker;

    await setLevel(db, joined.planetId, 'CORE', 8);
    await giveUnits(db, joined.planetId, { DART: 60 });
    const launch = await launchAttack(db, joined.planetId, caretaker!.id, { DART: 60 }, clock);
    clock.set(settledAt(launch.arriveAt));
    await new EventWorker(db, clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent).tick();

    const news = await db.select().from(notifications)
      .where(eq(notifications.playerId, joined.playerId));
    const result = news.find((row) => row.kind === 'raid_result');
    expect(result, 'a neutral raid told nobody').toBeDefined();
    /*
      THE SAME PAYLOAD SHAPE A PvP RAID SENDS, so one client parser reads both —
      asserted field by field rather than with `expect.any`, which arrives as
      `any` and would let a field change type without anybody noticing.
    */
    const payload = result!.payload;
    expect(typeof payload.grade).toBe('string');
    expect(payload.targetPlanetId).toBe(caretaker!.id);
    expect(typeof payload.shipsHome).toBe('number');
    expect(typeof payload.unitsLost).toBe('number');
    expect(payload.targetPlanetName).toBe(caretakerName!.name);
    // A caretaker world is outside the ladder: taking one moves nobody's score.
    expect(payload.dominion).toBe(0);
  });
});

/**
 * EVERY KIND OF NEWS HAS SOMEWHERE TO GO. D121.
 *
 * `Signals` maps a notification kind to the surface that deals with it, and a
 * missing entry is SILENT by construction: the row renders, it simply has no way
 * in. Five kinds had drifted out of that map — a Death Star resolving, a colony
 * taken, a colony lost, a settlement landing, a settlement lost — because the map
 * was written before those kinds existed and nothing failed when they were added.
 *
 * This is the half of the guard that lives where a kind is actually ADDED. Its
 * pair is `notification-routes.test.tsx` in the client, which asserts the same
 * list has a destination each. Adding a kind fails here first, naming the file to
 * go and edit.
 */
describe('the kinds of news the server can send', () => {
  it('is the list the client routes, and nothing has been added quietly', () => {
    expect([...notificationKind.enumValues].sort()).toEqual([
      'colony_captured',
      'colony_lost',
      'death_star_result',
      'fleet_returned',
      'galaxy_event_ended',
      'galaxy_event_started',
      'incoming_fleet',
      'probe_report',
      'raid_result',
      'raided',
      'scan_detected',
      'settlement_lost',
      'settlement_success',
      'strategic_incoming',
      'strategic_intercepted',
      'unlock',
    ]);
  });
});
