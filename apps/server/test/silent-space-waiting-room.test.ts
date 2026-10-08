import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ANTI_STRATEGIC,
  DEATH_STAR,
  MONUMENT_CAPACITY,
  RESEARCH_PROJECTS,
  SILENT_SPACE,
  alloyRate,
  collectorCap,
} from '@astera/rules';
import { buildings, monuments, planets, players, missions, strategicAssets, units } from '../src/db/schema.js';
import { buildUnits, collectWorks, installSatellite, raiseInstrument, upgradeBuilding } from '../src/services/build.js';
import { completeResearch } from '../src/services/research.js';
import { launchAttack } from '../src/services/mission.js';
import { buildDeathStar, buildInterceptor, launchDeathStar } from '../src/services/strategic.js';
import { launchMining, launchHarvest } from '../src/services/mining.js';
import { launchPirateRaid } from '../src/services/pirateRaid.js';
import { launchTrade } from '../src/services/trade.js';
import { launchIntergalacticConvoy } from '../src/services/intergalacticConvoyRaid.js';
import { markClanWarMonumentTarget, markClanWarTarget } from '../src/services/clanWar.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { launchTransfer } from '../src/services/movement.js';
import { planetView } from '../src/services/planetView.js';
import { standingAt } from '../src/services/intel.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { runSilentSpaceSweep } from '../src/services/silentSpace.js';
import { Presence } from '../src/services/presence.js';
import { buildReturnPayload } from '../src/services/session.js';
import { fuelUp, giveInstrument, giveSatellite, giveUnits, grant, seedWorld, setLevel, settleBuilds, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

const HOUR = 60;
const progressOf = async (f: Fixture, index = 0): Promise<Date | null> => {
  const [row] = await f.db.select({ at: players.lastProgressAt }).from(players).where(eq(players.id, f.playerIds[index]!));
  return row!.at;
};
const seasonOf = async (f: Fixture, index = 0): Promise<string> => {
  const [row] = await f.db.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, f.playerIds[index]!));
  return row!.seasonId;
};

/**
 * WHO LEAVES THE MAIN GALAXY. D212, owner rule 2026-10-07.
 *
 * Thirty hours without an attack, a building upgrade, a research or a ship/defence order.
 * All four are joined with AND, so any one of them keeps the commander home — and a login
 * on its own keeps nobody.
 */
describe('departure after 30 hours without development or combat', () => {
  it('moves a commander who keeps logging in but orders nothing', async () => {
    const f = await seedWorld(1);
    f.clock.advance(30 * HOUR);
    expect(await new Presence(f.db, f.clock).touch(f.accountIds[0]!)).toBe(true);
    expect(await progressOf(f)).toBeNull();
    const sweep = await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 });
    expect(sweep.movedOut).toBe(1);
    expect(await seasonOf(f)).not.toBe(f.seasonId);
  });

  it('keeps a commander whose last order is younger than 30 hours, then moves them', async () => {
    const f = await seedWorld(1);
    await grant(f.db, f.planetIds[0]!, 50_000);
    f.clock.advance(29 * HOUR);
    await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock);
    f.clock.advance(2 * HOUR);
    expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).movedOut).toBe(0);
    expect(await seasonOf(f)).toBe(f.seasonId);
    f.clock.advance(28 * HOUR);
    await settleBuilds(f);
    expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).movedOut).toBe(1);
  });

  it('is inclusive at exactly 30 hours and refuses one minute earlier', async () => {
    const f = await seedWorld(1);
    f.clock.advance(30 * HOUR - 1);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('ACTIVE');
    f.clock.advance(1);
    expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');
  });

  it('gives a commander back from Silent Space a full 30 hours before the next departure', async () => {
    const f = await seedWorld(1);
    f.clock.advance(30 * HOUR);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');
    const { enqueueReturn } = await import('../src/services/returnQueue.js');
    const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
    expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
    f.clock.advance(30 * HOUR - 1);
    expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('ACTIVE');
  });

  describe('what resets the clock', () => {
    const stamps: [string, (f: Fixture) => Promise<unknown>][] = [
      ['a building upgrade', (f) => upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock)],
      ['a ship order', (f) => buildUnits(f.db, f.planetIds[0]!, 'DART', 1, f.clock)],
      ['a ground-defence order', (f) => buildUnits(f.db, f.planetIds[0]!, 'THORN', 1, f.clock)],
      ['an instrument', (f) => raiseInstrument(f.db, f.planetIds[0]!, 'AEGIS', f.clock)],
      ['a satellite', (f) => installSatellite(f.db, f.planetIds[0]!, 'FOUNDRY', f.clock)],
      ['a research', async (f) => {
        f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes + 1);
        return completeResearch(f.db, f.planetIds[0]!, 'ISOTOPE_SPECTROMETRY', f.clock);
      }],
      ['an attack', async (f) => {
        await giveUnits(f.db, f.planetIds[0]!, { DART: 2 });
        return launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 1 }, f.clock);
      }],
      ['a Death Star order', async (f) => {
        await setLevel(f.db, f.planetIds[0]!, 'CORE', DEATH_STAR.requiredCore);
        await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', DEATH_STAR.requiredShipyard);
        return buildDeathStar(f.db, f.planetIds[0]!, f.clock);
      }],
      ['an Interceptor order', async (f) => {
        await giveSatellite(f.db, f.planetIds[0]!, 'UPLINK');
        await giveInstrument(f.db, f.planetIds[0]!, 'RADAR', ANTI_STRATEGIC.requiredRadar);
        return buildInterceptor(f.db, f.planetIds[0]!, f.clock);
      }],
      ['a Death Star launch', async (f) => {
        await setLevel(f.db, f.planetIds[0]!, 'CORE', DEATH_STAR.requiredCore);
        await setLevel(f.db, f.planetIds[1]!, 'CORE', DEATH_STAR.requiredCore);
        await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
        return launchDeathStar(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
      }],
    ];
    it.each(stamps)('%s stamps the order instant', async (_, act) => {
      const f = await seedWorld(2);
      // Both worlds alike, so the raid stays inside the tier band (D168).
      for (const planetId of f.planetIds) await grant(f.db, planetId, 400_000, 150_000);
      await fuelUp(f.db, f.planetIds[0]!);
      f.clock.advance(10 * HOUR);
      await act(f);
      expect(await progressOf(f)).toEqual(f.clock.now());
      expect(await progressOf(f, 1)).toBeNull();
    });

    const quiet: [string, (f: Fixture) => Promise<unknown>][] = [
      ['a login', (f) => new Presence(f.db, f.clock).touch(f.accountIds[0]!)],
      ['a collection', (f) => collectWorks(f.db, f.planetIds[0]!, f.clock)],
    ];
    it.each(quiet)('%s does not', async (_, act) => {
      const f = await seedWorld(1);
      f.clock.advance(10 * HOUR);
      await act(f);
      expect(await progressOf(f)).toBeNull();
    });
  });

  it('publishes the departure instant to the commander and none inside Silent Space', async () => {
    const f = await seedWorld(1);
    await grant(f.db, f.planetIds[0]!, 50_000);
    f.clock.advance(4 * HOUR);
    await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock);
    const main = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    expect(main.silentSpace).toBe(false);
    expect(main.silentSpaceAt).toEqual(new Date(f.clock.now().getTime() + SILENT_SPACE.idleMs));
    f.clock.advance(31 * HOUR);
    await settleBuilds(f);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');
    const waiting = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    expect(waiting.silentSpace).toBe(true);
    expect(waiting.silentSpaceAt).toBeNull();
  });
});

/**
 * SILENT SPACE IS A WAITING ROOM. D212.
 *
 * No fight and no farm: world attacks, Death Stars, clan joint wars, monuments, pirates,
 * asteroids, wrecks, merchants and the convoy are all closed. The works run at half pace.
 * Moving one's own ships stays open.
 */
describe('inside Silent Space', () => {
  async function waitingRoom(): Promise<Fixture> {
    const f = await seedWorld(2);
    const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId,
      kind: 'COLONY', name: 'Quiet colony', slotIndex: 700, x: 1990, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
    f.planetIds.push(colony!.id);
    f.clock.advance(31 * HOUR);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    for (const playerId of f.playerIds) {
      expect((await transferCommander(f.db, playerId, target!.id, f.clock)).status).toBe('MOVED');
    }
    for (const planetId of f.planetIds) {
      await giveUnits(f.db, planetId, { DART: 4, PROSPECTOR: 2 });
      await fuelUp(f.db, planetId);
    }
    return f;
  }
  const locked = { code: 'SILENT_SPACE_LOCKED', status: 409 };

  const refusals: [string, (f: Fixture) => Promise<unknown>][] = [
    ['a world attack', (f) => launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 1 }, f.clock)],
    ['a Death Star', (f) => launchDeathStar(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock)],
    ['asteroid mining', (f) => launchMining(f.db, f.planetIds[0]!, 0, 1, f.clock)],
    ['a wreck harvest', (f) => launchHarvest(f.db, f.planetIds[0]!, randomUUID(), 1, f.clock)],
    ['a pirate raid', (f) => launchPirateRaid(f.db, f.planetIds[0]!, 'ANY', { DART: 1 }, f.clock)],
    ['a merchant run', (f) => launchTrade(f.db, f.planetIds[0]!, { occurrenceId: randomUUID(), fleet: { DART: 1 },
      give: { alloy: 1, crystal: 0, deuterium: 0 }, want: { alloy: 0, crystal: 1, deuterium: 0 } }, f.clock)],
    ['a convoy strike', (f) => f.db.transaction((tx) => launchIntergalacticConvoy(tx, { planetId: f.planetIds[0]!,
      expectedPlayerId: f.playerIds[0]!, clock: f.clock, order: { occurrenceId: randomUUID(), fleet: { DART: 1 },
        quotedAt: f.clock.now(), quotedFlightSeconds: 60, quotedArriveAt: f.clock.now() } }))],
    ['a monument wave', async (f) => {
      const [monument] = await f.db.insert(monuments).values({ seasonId: await seasonOf(f), ordinal: 1, x: 6000, y: 0, z: 0,
        capacity: MONUMENT_CAPACITY, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
      return f.db.transaction((tx) => sendMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
        monumentId: monument!.id, fleet: { DART: 1 }, purpose: 'ATTACK', clock: f.clock }));
    }],
    ['a monument quote', async (f) => {
      const [monument] = await f.db.insert(monuments).values({ seasonId: await seasonOf(f), ordinal: 1, x: 6000, y: 0, z: 0,
        capacity: MONUMENT_CAPACITY, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
      return f.db.transaction((tx) => quoteMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
        monumentId: monument!.id, fleet: { DART: 1 }, purpose: 'ATTACK', clock: f.clock }));
    }],
    ['a clan war monument mark', async (f) => {
      const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
      return f.db.transaction((tx) => markClanWarMonumentTarget(tx, { monumentId: randomUUID(), clock: f.clock,
        actor: { playerId: player!.id, seasonId: player!.seasonId, accountId: player!.accountId, displayName: 'Tester0',
          clanLockedUntil: null, lastClanSeenAt: null } }));
    }],
    ['a clan war mark', async (f) => {
      const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
      return f.db.transaction((tx) => markClanWarTarget(tx, { targetPlanetId: f.planetIds[1]!, clock: f.clock,
        actor: { playerId: player!.id, seasonId: player!.seasonId, accountId: player!.accountId, displayName: 'Tester0',
          clanLockedUntil: null, lastClanSeenAt: null } }));
    }],
  ];
  it.each(refusals)('refuses %s and leaves the fleet at home', async (_, act) => {
    const f = await waitingRoom();
    await expect(act(f)).rejects.toMatchObject(locked);
    expect(await f.db.select().from(missions)).toHaveLength(0);
    const [home] = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!));
    expect(home).toBeDefined();
    expect((await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!)))
      .every((row) => row.location === 'home')).toBe(true);
  });

  it('still flies ships between the commander’s own worlds', async () => {
    const f = await waitingRoom();
    await expect(launchTransfer(f.db, f.playerIds[0]!, f.planetIds[0]!, f.planetIds[2]!, { DART: 1 },
      { alloy: 0, crystal: 0, deuterium: 0 }, f.clock)).resolves.toBeTruthy();
  });

  it('lets a probe read the same half-pace works the owner\u2019s own tick writes', async () => {
    const f = await waitingRoom();
    const world = f.planetIds[1]!;
    await f.db.update(planets).set({ bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, lastTickAt: f.clock.now() })
      .where(eq(planets.id, world));
    f.clock.advance(HOUR);
    const [row] = await f.db.select().from(planets).where(eq(planets.id, world));
    const seen = await f.db.transaction((tx) => standingAt(tx, row!, f.clock.now()));
    const owned = await f.db.transaction((tx) => planetView(tx, world, f.clock));
    expect(Math.floor(seen.bufferAlloy)).toBe(owned.planet.bufferAlloy);
    expect(Math.floor(seen.bufferAlloy)).toBe(Math.floor(alloyRate(owned.buildings.REFINERY) * SILENT_SPACE.productionPace));
  });

  it('tells a commander coming back what accrued at the half pace', async () => {
    const f = await waitingRoom();
    const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await f.db.update(players).set({ lastSeenAt: f.clock.now() }).where(eq(players.id, player!.id));
    f.clock.advance(5 * HOUR);
    const payload = await buildReturnPayload(f.db, player!.id, f.clock);
    const accrued = payload.entries.find((entry) => entry.kind === 'accrued');
    const refineries = await f.db.select().from(buildings)
      .where(and(eq(buildings.type, 'REFINERY'), inArray(buildings.planetId, [f.planetIds[0]!, f.planetIds[2]!])));
    const full = refineries.reduce((sum, row) => sum + alloyRate(row.level) * 5, 0);
    expect(accrued?.params).toMatchObject({ alloy: Math.round(full * SILENT_SPACE.productionPace) });
  });

  it('runs the works at half pace under the same ceilings, and says so', async () => {
    const f = await waitingRoom();
    const world = f.planetIds[0]!;
    await f.db.update(planets).set({ bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, lastTickAt: f.clock.now() })
      .where(eq(planets.id, world));
    f.clock.advance(HOUR);
    const view = await f.db.transaction((tx) => planetView(tx, world, f.clock));
    const rate = alloyRate(view.buildings.REFINERY);
    expect(view.planet.bufferAlloy).toBe(Math.floor(rate * SILENT_SPACE.productionPace));
    expect(view.planet.alloyPerHour).toBe(Math.round(rate * SILENT_SPACE.productionPace));
    expect(view.planet.nominalAlloyPerHour).toBe(Math.round(rate));
    expect(view.planet.bufferAlloyCap).toBe(collectorCap(rate));
  });
});
