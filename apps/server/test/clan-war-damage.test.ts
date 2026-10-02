import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CLAN, MULTI_WORLD, needsDock, normalizeLots, type DamageLot, type Fleet } from '@astera/rules';
import {
  battleReports,
  clanWarContributions,
  clanWarDominionEvents,
  clanWarParticipantResults,
  clans,
  clanMemberships,
  missions,
  notifications,
  planets,
  seasons,
  units,
} from '../src/db/schema.js';
import { addRadiationSource } from '../src/services/radiation.js';
import { acceptClanRequest, applyToClan, clanActor, createClan } from '../src/services/clan.js';
import { markClanWarTarget, sendClanWarContribution, startClanWar } from '../src/services/clanWar.js';
import { rememberWorld } from '../src/services/intel.js';
import { readBattleReports } from '../src/services/reports.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { EventWorker } from '../src/worker/loop.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { giveUnits, grant, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * KALICI GEMİ HASARI IN A CLAN'S JOINT WAR. `plan.md` F3.
 *
 * One battle, several owners. The defender's part-hit ships are judged on the spot as in
 * any raid. The pool's are the waves': each wave carries its own damaged ships home on
 * its own return leg, the commander's personal result says what they carry, and the
 * Repair Station judges them where each wave lands.
 *
 * Three Darts against one Stronghold leave the Stronghold 79–92% damaged and a Dart
 * 53–78% across the whole roll band (measured with `resolveCombat` over 1,500 seeds).
 */

const silent = pino({ level: 'silent' });
const ships = (lots: readonly DamageLot[]): number => lots.reduce((sum, lot) => sum + lot.count, 0);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

async function land(f: Fixture): Promise<void> {
  const rows = await f.db.select({ arriveAt: missions.arriveAt }).from(missions)
    .where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce((at, row) => Math.max(at, row.arriveAt.getTime()), f.clock.now().getTime());
  f.clock.set(new Date(latest + 20_000));
  await workerFor(f).tick();
}

async function setup(rulesetVersion: number): Promise<Fixture> {
  const f = await seedWorld(4, 808808);
  await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await grant(f.db, planetId, 600_000, 300_000);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await giveUnits(f.db, planetId, { DART: 100 });
  }
  for (const observerPlayerId of f.playerIds) {
    for (const targetPlanetId of f.planetIds) {
      await f.db.transaction((tx) => rememberWorld(tx, {
        observerPlayerId, targetPlanetId, seasonId: f.seasonId, seenAt: f.clock.now(), source: 'PROBE',
      }));
    }
  }
  return f;
}

async function readyOperation(f: Fixture): Promise<void> {
  const leader = await clanActor(f.db, f.accountIds[0]!);
  const created = await f.db.transaction((tx) => createClan(tx, {
    actor: leader, name: 'Orion Guard', tag: 'OG', description: 'One horizon.', recruiting: true, clock: f.clock,
  }));
  const candidate = await clanActor(f.db, f.accountIds[1]!);
  const application = await f.db.transaction((tx) => applyToClan(tx, {
    actor: candidate, clanId: created.clanId, now: f.clock.now(),
  }));
  await f.db.transaction((tx) => acceptClanRequest(tx, {
    actor: leader, requestId: application.requestId, acknowledgeHostile: true, now: f.clock.now(),
  }));
  const joinedAt = new Date(f.clock.now().getTime() - 13 * 3_600_000);
  for (const index of [0, 1]) {
    await f.db.update(clanMemberships)
      .set({ joinedAt, matureAt: new Date(joinedAt.getTime() + CLAN.adaptationMinutes * 60_000) })
      .where(eq(clanMemberships.playerId, f.playerIds[index]!));
  }
  await f.db.update(clans).set({ level: 5 }).where(eq(clans.id, created.clanId));
  await f.db.transaction(async (tx) => markClanWarTarget(tx, {
    actor: await clanActor(tx, f.accountIds[0]!), targetPlanetId: f.planetIds[2]!, clock: f.clock,
  }));
}

const send = (f: Fixture, accountIndex: number, originPlanetId: string, fleet: Fleet) =>
  f.db.transaction(async (tx) => sendClanWarContribution(tx, {
    actor: await clanActor(tx, f.accountIds[accountIndex]!),
    originPlanetId, fleet, acknowledgeShieldLoss: true, clock: f.clock,
  }));

/** Two waves of Darts against a lone Stronghold, up to the settled battle. */
async function fightIt(f: Fixture): Promise<void> {
  await readyOperation(f);
  await f.db.delete(units).where(eq(units.planetId, f.planetIds[2]!));
  await giveUnits(f.db, f.planetIds[2]!, { STRONGHOLD: 1 });
  await send(f, 0, f.planetIds[0]!, { DART: 2 });
  await send(f, 1, f.planetIds[1]!, { DART: 1 });
  await land(f);
  await f.db.transaction(async (tx) => startClanWar(tx, {
    actor: await clanActor(tx, f.accountIds[0]!), acknowledgeShieldLoss: true, clock: f.clock,
  }));
  await land(f);
}

const payloadOf = async (f: Fixture, playerId: string, kind: 'raided' | 'raid_result' | 'fleet_returned') =>
  (await f.db.select().from(notifications)
    .where(and(eq(notifications.playerId, playerId), eq(notifications.kind, kind))))
    .map((row) => row.payload);

describe('persistent damage in a joint war', () => {
  it('docks the defender at once and sends each wave home with its own damage', async () => {
    const f = await setup(MULTI_WORLD.shipDamageRulesetVersion);
    await fightIt(f);

    const [report] = await f.db.select().from(battleReports);
    expect(report?.defenderDamage).toHaveLength(1);
    expect(report!.defenderDamage[0]).toMatchObject({ hull: 'STRONGHOLD', count: 1 });
    expect(needsDock(report!.defenderDamage[0]!.damageBp)).toBe(true);
    expect(await dockLotsOf(f.db, f.planetIds[2]!)).toMatchObject([{ hull: 'STRONGHOLD', count: 1 }]);
    expect((await payloadOf(f, f.playerIds[2]!, 'raided'))[0]).toMatchObject({ docked: 1 });

    // The pool's damage is the waves' damage, and each commander's result says theirs.
    expect(report!.attackerDamage.length).toBeGreaterThan(0);
    const waves = await f.db.select().from(clanWarContributions);
    expect(normalizeLots(waves.flatMap((wave) => wave.damage ?? []))).toEqual(report!.attackerDamage);
    const results = await f.db.select().from(clanWarParticipantResults);
    for (const row of results) {
      const own = normalizeLots(waves.filter((wave) => wave.playerId === row.playerId).flatMap((wave) => wave.damage ?? []));
      expect(row.damage).toEqual(own);
      const [told] = await payloadOf(f, row.playerId, 'raid_result');
      expect(told).toMatchObject(own.length > 0 ? { damaged: ships(own) } : {});
    }

    // Each reader's report shows their own damage: a commander's personal share, the defender's line.
    for (const row of results) {
      const [personal] = (await readBattleReports(f.db, row.playerId)).reports;
      expect(personal).toMatchObject({ yourDamage: row.damage });
    }
    const [defended] = (await readBattleReports(f.db, f.playerIds[2]!)).reports;
    expect(defended).toMatchObject({ yourDamage: report!.defenderDamage });

    // Each wave lands where it left from, and the Repair Station judges it there.
    await land(f);
    for (const wave of waves) {
      const lots = (wave.damage ?? []).filter((lot) => needsDock(lot.damageBp));
      const docked = await dockLotsOf(f.db, wave.originPlanetId);
      expect(docked.map(({ hull, count, damageBp }) => ({ hull, count, damageBp }))).toEqual(lots);
      if (lots.length > 0) {
        const told = await payloadOf(f, wave.playerId, 'fleet_returned');
        expect(told.some((payload) => payload.docked === ships(lots))).toBe(true);
      }
    }
  });

  it('leaves a season dealt before the rule exactly as it was', async () => {
    const f = await setup(MULTI_WORLD.clanJointWarRulesetVersion);
    await fightIt(f);
    const [report] = await f.db.select().from(battleReports);
    expect(report?.defenderDamage).toEqual([]);
    expect(report?.attackerDamage).toEqual([]);
    expect(await dockLotsOf(f.db, f.planetIds[2]!)).toEqual([]);
    const [world] = await f.db.select().from(units)
      .where(and(eq(units.planetId, f.planetIds[2]!), eq(units.location, 'home'), eq(units.hull, 'STRONGHOLD')));
    expect(world?.count).toBe(1);
    expect((await f.db.select().from(clanWarContributions)).every((wave) => wave.damage === null)).toBe(true);
  });
});

/**
 * RADYASYON IN A JOINT WAR. `plan.md` F9: every leg takes its dose where it lands — the
 * flight to the staging world, the strike, the way home — and a wave a cloud finished
 * is lost by the path a wiped wave already takes.
 */
describe('radiation in a joint war', () => {
  /** A cloud over the whole galaxy that finishes any ship in a minute. */
  const deadly = async (f: Fixture) => {
    const [centre] = await f.db.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets)
      .where(eq(planets.id, f.planetIds[0]!));
    return addRadiationSource(f.db, {
      seasonId: f.seasonId, anchor: { kind: 'ZONE', at: centre! },
      radius: 1_000_000, intensityPctPerMinute: 100, mode: 'EMIT', label: 'storm',
    }, f.clock);
  };
  const told = async (f: Fixture, playerId: string) =>
    (await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, playerId), eq(notifications.kind, 'radiation_lost'))))
      .map((row) => row.payload);

  it('loses a wave on its way to the staging world, and nobody else\'s', async () => {
    const f = await setup(MULTI_WORLD.shipDamageRulesetVersion);
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 2 });
    await deadly(f);
    await send(f, 1, f.planetIds[1]!, { DART: 3 });
    await land(f);

    const waves = await f.db.select().from(clanWarContributions);
    const flown = waves.find((wave) => wave.playerId === f.playerIds[1]!)!;
    const standing = waves.find((wave) => wave.playerId === f.playerIds[0]!)!;
    expect(flown.status).toBe('LOST');
    expect(await f.db.select().from(units).where(eq(units.location, flown.unitLocation))).toEqual([]);
    expect(standing.status).toBe('STAGED');
    expect((await told(f, f.playerIds[1]!))[0]).toMatchObject({ lost: 3, left: 0 });
  });

  it('never fights when the strike leg finished the pool', async () => {
    const f = await setup(MULTI_WORLD.shipDamageRulesetVersion);
    await readyOperation(f);
    await send(f, 0, f.planetIds[0]!, { DART: 2 });
    await send(f, 1, f.planetIds[1]!, { DART: 1 });
    await land(f);
    await deadly(f);
    await f.db.transaction(async (tx) => startClanWar(tx, {
      actor: await clanActor(tx, f.accountIds[0]!), acknowledgeShieldLoss: true, clock: f.clock,
    }));
    await land(f);

    expect(await f.db.select().from(battleReports)).toEqual([]);
    for (const wave of await f.db.select().from(clanWarContributions)) expect(wave.status).toBe('LOST');
    expect(await payloadOf(f, f.playerIds[2]!, 'raided')).toEqual([]);
    expect((await told(f, f.playerIds[0]!))[0]).toMatchObject({ lost: 2, left: 0 });
    expect((await told(f, f.playerIds[1]!))[0]).toMatchObject({ lost: 1, left: 0 });
  });

  it('loses a wave on the way home, and the haul it carried', async () => {
    const f = await setup(MULTI_WORLD.shipDamageRulesetVersion);
    await fightIt(f);
    const before = await f.db.select().from(planets);
    await deadly(f);
    await land(f);

    for (const wave of await f.db.select().from(clanWarContributions)) {
      expect(wave.status).toBe('LOST');
      const was = before.find((row) => row.id === wave.originPlanetId)!;
      const [now] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
      expect(now!.alloy).toBeCloseTo(was.alloy, 0);
    }
    expect(await payloadOf(f, f.playerIds[1]!, 'fleet_returned')).toEqual([]);
  });
});

/**
 * A SEASON A CLAN WON A WAR IN STILL CLOSES. The joint war books its Dominion shares into the
 * ledgers and journals them in `clan_war_dominion_events`; the season-end audit has to read
 * that journal too, or it refuses the whole season (found wiping a local galaxy, 2026-09-30).
 */
describe('the season after a joint war', () => {
  it('closes, its ledgers reproduced from the war\'s own journal', async () => {
    const f = await setup(MULTI_WORLD.shipDamageRulesetVersion);
    await fightIt(f);
    const shares = await f.db.select().from(clanWarDominionEvents);
    expect(shares.some((row) => row.delta !== 0)).toBe(true);

    await expect(forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId)).resolves.toBeUndefined();
    const [season] = await f.db.select({ status: seasons.status }).from(seasons).where(eq(seasons.id, f.seasonId));
    expect(season?.status).not.toBe('live');
  });
});
