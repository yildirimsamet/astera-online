import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, distance, fleetCargo, fleetCount, fleetTravelExact, type Fleet } from '@astera/rules';
import { neutralPlanetState as neutralState } from '../src/db/schema.js';
import {
  attackCommitments, battleReports, missions, neutralPlanetState, notifications, planets, probeWorldMemories,
  radiationSources, seasons, units,
} from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchSettlement, launchTransfer, recallFlight } from '../src/services/movement.js';
import { addRadiationSource } from '../src/services/radiation.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { FixedClock } from '../src/clock.js';
import { joinSeason } from '../src/services/player.js';
import { createSeason } from '../src/services/season.js';
import {
  fuelUp, giveUnits, grant, levelWorld, makeAccount, seedWorld, setLevel, settledAt, testDb, truncateAll, type Fixture,
} from './helpers.js';

/**
 * RADIATION ON A FLIGHT, END TO END. `plan.md` F9.
 *
 * The dose is taken where the ships arrive, before anything they do there: before a
 * battle, before a landing. A wing leaves home whole (I1) and every ship in it takes the
 * same dose, so on the way OUT a cloud finishes all of it or none of it; only a wing
 * carrying battle damage home can lose some and land the rest.
 *
 * A wing a cloud finished on the way in never struck (D13): no battle, no report, no word
 * to the world it was flying at, and the strike it was counted as is given back.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

let f: Fixture;
let raider: string;
let target: string;

const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

const positionOf = async (planetId: string) => {
  const [row] = await f.db.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets)
    .where(eq(planets.id, planetId));
  return row!;
};

const home = async (planetId: string): Promise<Fleet> => {
  const rows = await f.db.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
  const out: Fleet = {};
  for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
  return out;
};

const told = async (playerId: string, kind: typeof notifications.$inferSelect['kind']) =>
  f.db.select().from(notifications).where(and(eq(notifications.playerId, playerId), eq(notifications.kind, kind)));

/** A cloud over the whole lane that doses `pct` of a full hull over `minutes` of exposure. */
const cloud = async (pct: number, minutes: number, activeFrom?: Date) => {
  const a = await positionOf(raider), b = await positionOf(target);
  return addRadiationSource(f.db, {
    seasonId: f.seasonId,
    anchor: { kind: 'ZONE', at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } },
    radius: Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) + 50,
    intensityPctPerMinute: pct / minutes,
    mode: 'EMIT',
    label: 'lane',
    ...(activeFrom ? { activeFrom } : {}),
  }, f.clock);
};

const minutesOf = (flight: { departAt: Date; arriveAt: Date }) =>
  (flight.arriveAt.getTime() - flight.departAt.getTime()) / 60_000;

const flightOf = async (missionId: string) => {
  const [row] = await f.db.select().from(missions).where(eq(missions.id, missionId));
  return row!;
};

beforeEach(async () => {
  f = await seedWorld(2, 30_932);
  [raider, target] = f.planetIds as [string, string];
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion })
    .where(eq(seasons.id, f.seasonId));
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 8);
    await setLevel(f.db, id, 'SHIPYARD', 4);
  }
  await levelWorld(f.db, f.planetIds);
  await fuelUp(f.db, raider);
});

describe('a raid flying through a cloud', () => {
  it('fights with the damage it took on the way, and carries it home to the dock', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    await cloud(30, minutesOf(await flightOf(launch.missionId)), new Date(0));
    await f.db.update(radiationSources).set({ activeUntil: launch.arriveAt });

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report, 'the raid never struck').toBeDefined();
    // Nothing on the world to fight: the wing's own damage is what it carries out.
    expect(report!.attackerDamage).toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    expect(back?.damage).toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);

    f.clock.set(back!.arriveAt);
    await worker().tick();
    expect((await dockLotsOf(f.db, raider)).map(({ hull, count, damageBp }) => ({ hull, count, damageBp })))
      .toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);
  });

  it('never strikes when the cloud finished it, and gives the strike back', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    expect(await f.db.select().from(attackCommitments).where(eq(attackCommitments.missionId, launch.missionId)))
      .toHaveLength(1);
    await cloud(150, minutesOf(await flightOf(launch.missionId)));

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    expect(await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId))).toEqual([]);
    expect(await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId))).toEqual([]);
    expect(await f.db.select().from(units).where(eq(units.location, launch.missionId))).toEqual([]);
    expect(await f.db.select().from(attackCommitments).where(eq(attackCommitments.missionId, launch.missionId)))
      .toEqual([]);
    const [word] = await told(f.playerIds[0]!, 'radiation_lost');
    expect(word?.payload).toMatchObject({ lost: 3, left: 0, toPlanetId: target });
    // The world it was flying at never knew.
    expect(await told(f.playerIds[1]!, 'raided')).toEqual([]);
  });

  it('is untouched in a season dealt before the rule, whatever rows exist', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    await cloud(150, minutesOf(await flightOf(launch.missionId)));
    await f.db.update(seasons).set({ rulesetVersion: 13 }).where(eq(seasons.id, f.seasonId));

    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    expect(await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId))).toHaveLength(1);
    expect(await told(f.playerIds[0]!, 'radiation_lost')).toEqual([]);
  });
});

describe('a wing coming home through a cloud', () => {
  it('loses the ships the fight had worn down, lands the rest, and only the loot they can hold', async () => {
    await grant(f.db, target, 60_000, 30_000);
    await giveUnits(f.db, target, { STRONGHOLD: 1 });
    await giveUnits(f.db, raider, { DART: 4 });
    const launch = await launchAttack(f.db, raider, target, { DART: 4 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    // Measured over 1,500 seeds: one Dart comes out 53–78% damaged, the rest whole.
    const worn = report!.attackerDamage.reduce((n, lot) => n + lot.count, 0);
    const whole = fleetCount(back!.fleet) - worn;
    expect(worn).toBeGreaterThan(0);
    expect(whole).toBeGreaterThan(0);

    // Half a hull on the way home: the worn ones do not make it, the whole ones dock.
    await cloud(50, minutesOf(back!), back!.departAt);
    const storeBefore = (await f.db.select().from(planets).where(eq(planets.id, raider)))[0]!;
    f.clock.set(back!.arriveAt);
    await worker().tick();

    expect((await dockLotsOf(f.db, raider)).map(({ hull, count, damageBp }) => ({ hull, count, damageBp })))
      .toEqual([{ hull: 'DART', count: whole, damageBp: 5000 }]);
    const [word] = await told(f.playerIds[0]!, 'radiation_lost');
    expect(word?.payload).toMatchObject({ lost: worn, left: whole });
    const storeAfter = (await f.db.select().from(planets).where(eq(planets.id, raider)))[0]!;
    const landed = (storeAfter.alloy - storeBefore.alloy) + (storeAfter.crystal - storeBefore.crystal)
      + (storeAfter.deuterium - storeBefore.deuterium);
    const carried = back!.loot!.alloy + back!.loot!.crystal + back!.loot!.deuterium;
    expect(carried).toBeGreaterThan(fleetCargo({ DART: whole }, back!.tech ?? {}));
    expect(landed).toBeLessThanOrEqual(fleetCargo({ DART: whole }, back!.tech ?? {}) + 1);
    const [returned] = await told(f.playerIds[0]!, 'fleet_returned');
    expect(returned?.payload).toMatchObject({ ships: whole, docked: whole });
  });

  it('loses the whole haul with the last ship, and says nothing of a homecoming', async () => {
    await grant(f.db, target, 60_000, 30_000);
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
    expect(back?.loot?.alloy ?? 0).toBeGreaterThan(0);
    await cloud(150, minutesOf(back!), back!.departAt);
    const storeBefore = (await f.db.select().from(planets).where(eq(planets.id, raider)))[0]!;

    f.clock.set(back!.arriveAt);
    await worker().tick();

    const storeAfter = (await f.db.select().from(planets).where(eq(planets.id, raider)))[0]!;
    expect(storeAfter.alloy).toBeCloseTo(storeBefore.alloy, 0);
    expect(await home(raider)).toEqual({});
    expect(await dockLotsOf(f.db, raider)).toEqual([]);
    expect(await told(f.playerIds[0]!, 'fleet_returned')).toEqual([]);
    expect((await told(f.playerIds[0]!, 'radiation_lost'))[0]?.payload).toMatchObject({ lost: 3, left: 0 });
  });

  it('takes its dose over both legs of a recall', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    const outbound = await flightOf(launch.missionId);
    f.clock.set(new Date(outbound.departAt.getTime() + (outbound.arriveAt.getTime() - outbound.departAt.getTime()) * 0.3));
    await recallFlight(f.db, launch.missionId, f.clock, f.playerIds[0]!);
    const turned = await flightOf(launch.missionId);
    await cloud(30, minutesOf(turned), new Date(0));

    f.clock.set(turned.arriveAt);
    await worker().tick();

    expect((await dockLotsOf(f.db, raider)).map(({ hull, count, damageBp }) => ({ hull, count, damageBp })))
      .toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);
    expect(await home(raider)).toEqual({});
  });
});

describe('a raid on a caretaker world through a cloud', () => {
  it('fights the caretaker with the damage it took on the way', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-RAD-N', seed: 91274, startsAt: clock.now(), playerCap: 60,
      rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
    });
    const joined = await joinSeason(db, (await makeAccount(db, 'Irradiated')).id, season.id, clock);
    const [rock] = await db.select({ id: planets.id }).from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
      .where(eq(neutralPlanetState.tier, 2));
    if (!rock) throw new Error('no tier-two caretaker world');
    await db.update(planets).set({ x: 150, y: 0, z: 0, shield: 0 }).where(eq(planets.id, rock.id));
    await db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, joined.planetId));
    await db.delete(units).where(eq(units.planetId, rock.id));
    await setLevel(db, joined.planetId, 'CORE', 5);
    await giveUnits(db, joined.planetId, { DART: 3 });
    await fuelUp(db, joined.planetId);
    const launch = await launchAttack(db, joined.planetId, rock.id, { DART: 3 }, clock);
    const [flight] = await db.select().from(missions).where(eq(missions.id, launch.missionId));
    await addRadiationSource(db, {
      seasonId: season.id, anchor: { kind: 'ZONE', at: { x: 75, y: 0, z: 0 } },
      radius: 500, intensityPctPerMinute: 30 / minutesOf(flight!), mode: 'EMIT', label: 'rock lane',
    }, clock);

    clock.set(settledAt(launch.arriveAt));
    await new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();

    const [report] = await db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report?.targetKind).toBe('NEUTRAL');
    expect(report!.attackerDamage).toEqual([{ hull: 'DART', count: 3, damageBp: 3000 }]);
  });
});

describe('a transfer through a cloud', () => {
  const storeOf = async (planetId: string) =>
    (await f.db.select().from(planets).where(eq(planets.id, planetId)))[0]!;

  beforeEach(async () => {
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, target));
    await setLevel(f.db, target, 'HANGAR', 3);
    await grant(f.db, raider, 200_000, 60_000);
    await fuelUp(f.db, raider, 200_000);
  });

  it('loses the cargo with the last ship, and lands nothing', async () => {
    await giveUnits(f.db, raider, { COURIER: 2 });
    const before = await storeOf(target);
    const launched = await launchTransfer(f.db, f.playerIds[0]!, raider, target, { COURIER: 2 },
      { alloy: 1_000, crystal: 0, deuterium: 0 }, f.clock);
    await cloud(150, minutesOf(await flightOf(launched.missionId)));

    f.clock.set(launched.arriveAt);
    await worker().tick();

    expect((await storeOf(target)).alloy).toBeCloseTo(before.alloy, 0);
    expect(await home(target)).toEqual({});
    expect((await told(f.playerIds[0]!, 'radiation_lost'))[0]?.payload).toMatchObject({ lost: 2, left: 0, toPlanetId: target });
    expect(await told(f.playerIds[0]!, 'fleet_returned')).toEqual([]);
  });

  it('lands only what the ships that made it can hold', async () => {
    await giveUnits(f.db, raider, { COURIER: 4 });
    const hold = fleetCargo({ COURIER: 4 }, {});
    const before = await storeOf(target);
    const launched = await launchTransfer(f.db, f.playerIds[0]!, raider, target, { COURIER: 4 },
      { alloy: hold, crystal: 0, deuterium: 0 }, f.clock);
    // Two of the four were already worn close to a full hull (their earlier leg's cloud).
    await f.db.update(missions).set({ damage: [{ hull: 'COURIER', count: 2, damageBp: 9000 }] })
      .where(eq(missions.id, launched.missionId));
    await cloud(20, minutesOf(await flightOf(launched.missionId)));

    f.clock.set(launched.arriveAt);
    await worker().tick();

    // The two worn ones are gone; the two whole ones took 20% and were patched on landing.
    expect(await home(target)).toEqual({ COURIER: 2 });
    const landed = (await storeOf(target)).alloy - before.alloy;
    expect(landed).toBeGreaterThan(0);
    expect(landed).toBeLessThanOrEqual(fleetCargo({ COURIER: 2 }, {}) + 1);
  });
});

describe('a settlement through a cloud', () => {
  it('fails as a lost race does, the founding charge goes home, and only the cloud is told', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-RAD-S', seed: 91275, startsAt: clock.now(), playerCap: 60,
      rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
    });
    const joined = await joinSeason(db, (await makeAccount(db, 'Settler')).id, season.id, clock);
    const [rock] = await db.select({ id: planets.id }).from(planets)
      .innerJoin(neutralState, eq(neutralState.planetId, planets.id))
      .where(eq(neutralState.tier, 1));
    if (!rock) throw new Error('no tier-one caretaker world');
    await db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, rock.id));
    await db.update(planets).set({ x: 0, y: 0, z: 0, alloy: 10_000, crystal: 5_000 }).where(eq(planets.id, joined.planetId));
    await setLevel(db, joined.planetId, 'CORE', MULTI_WORLD.colonyCoreThresholds[0]);
    await giveUnits(db, joined.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    await fuelUp(db, joined.planetId);
    await db.update(neutralState).set({ claimUntil: new Date(clock.now().getTime() + 30 * 60_000) })
      .where(eq(neutralState.planetId, rock.id));

    const launched = await launchSettlement(db, joined.playerId, joined.planetId, rock.id, clock);
    const [flight] = await db.select().from(missions).where(eq(missions.id, launched.missionId));
    await addRadiationSource(db, {
      seasonId: season.id, anchor: { kind: 'ZONE', at: { x: 20, y: 0, z: 0 } },
      radius: 200, intensityPctPerMinute: 150 / minutesOf(flight!), mode: 'EMIT', label: 'settler lane',
    }, clock);
    const [paid] = await db.select().from(planets).where(eq(planets.id, joined.planetId));

    clock.set(launched.arriveAt);
    await new EventWorker(db, clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();

    const [world] = await db.select().from(planets).where(eq(planets.id, rock.id));
    expect(world?.kind).toBe('NEUTRAL');
    const [refunded] = await db.select().from(planets).where(eq(planets.id, joined.planetId));
    const charge = MULTI_WORLD.settlement.charge;
    expect(refunded!.alloy - paid!.alloy).toBeCloseTo(charge.alloy, 0);
    expect(refunded!.crystal - paid!.crystal).toBeCloseTo(charge.crystal, 0);
    // "Race lost · the Couriers and cargo are returning" would be false twice over: no ship is
    // left to return and the charge is already home. `radiation_lost` is the whole story.
    const lost = await db.select().from(notifications).where(and(
      eq(notifications.playerId, joined.playerId), eq(notifications.kind, 'settlement_lost'),
    ));
    expect(lost).toEqual([]);
    const word = await db.select().from(notifications).where(and(
      eq(notifications.playerId, joined.playerId), eq(notifications.kind, 'radiation_lost'),
    ));
    expect(word[0]?.payload).toMatchObject({ lost: MULTI_WORLD.settlement.transports, left: 0 });
    expect(await db.select().from(units).where(eq(units.location, launched.missionId))).toEqual([]);
    // They never reached the rock, so the map remembers nothing new of it.
    expect(await db.select().from(probeWorldMemories).where(and(
      eq(probeWorldMemories.observerPlayerId, joined.playerId), eq(probeWorldMemories.targetPlanetId, rock.id),
    ))).toEqual([]);
  });
});

describe('a launch into a cloud that would finish ships', () => {
  /** A storm over everything: any flight longer than a minute loses every ship. */
  const storm = () => addRadiationSource(f.db, {
    seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
    radius: 1_000_000, intensityPctPerMinute: 200, mode: 'EMIT', label: 'storm',
  }, f.clock);

  it('is refused until the commander says they have read it', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    await storm();
    await expect(launchAttack(f.db, raider, target, { DART: 3 }, f.clock))
      .rejects.toMatchObject({ code: 'RADIATION_LETHAL', params: { count: 3 } });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock, undefined, false, undefined, true);
    expect(launch.missionId).toEqual(expect.any(String));
  });

  it('asks nothing of a flight a cloud would only hurt', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const minutes = fleetTravelExact(distance(await positionOf(raider), await positionOf(target)), { DART: 3 },
      { boost: 1, tech: {} });
    await cloud(60, minutes);
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    expect(minutesOf(await flightOf(launch.missionId))).toBeCloseTo(minutes, 3);
  });

  it('asks nothing in a season dealt before the rule', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    await storm();
    await f.db.update(seasons).set({ rulesetVersion: 13 }).where(eq(seasons.id, f.seasonId));
    await expect(launchAttack(f.db, raider, target, { DART: 3 }, f.clock)).resolves.toHaveProperty('missionId');
  });

  it('asks the same of a transfer', async () => {
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, target));
    await setLevel(f.db, target, 'HANGAR', 3);
    await giveUnits(f.db, raider, { COURIER: 2 });
    await storm();
    const none = { alloy: 0, crystal: 0, deuterium: 0 };
    await expect(launchTransfer(f.db, f.playerIds[0]!, raider, target, { COURIER: 2 }, none, f.clock))
      .rejects.toMatchObject({ code: 'RADIATION_LETHAL', params: { count: 2 } });
    await expect(launchTransfer(f.db, f.playerIds[0]!, raider, target, { COURIER: 2 }, none, f.clock,
      undefined, undefined, true)).resolves.toHaveProperty('missionId');
  });
});

describe('the own wing a cloud will finish', () => {
  const threadOf = async (missionId: string) =>
    (await pendingThreads(f.db, raider, f.clock.now())).find((thread) => thread.id === missionId);

  it('carries the moment it goes, on the commander\'s own flight only', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    const flight = await flightOf(launch.missionId);
    const minutes = minutesOf(flight);
    // 150% over the flight: a full hull two thirds of the way there.
    await cloud(150, minutes);

    const thread = await threadOf(launch.missionId);
    expect(thread?.fadeAt).toBeInstanceOf(Date);
    const expected = flight.departAt.getTime() + (minutes * 60_000 * 100) / 150;
    expect(Math.abs(thread!.fadeAt!.getTime() - expected)).toBeLessThan(60_000);
  });

  it('carries none for a wing that lands, or in a season dealt before the rule', async () => {
    await giveUnits(f.db, raider, { DART: 3 });
    const launch = await launchAttack(f.db, raider, target, { DART: 3 }, f.clock);
    await cloud(60, minutesOf(await flightOf(launch.missionId)));
    expect((await threadOf(launch.missionId))?.fadeAt).toBeUndefined();

    await cloud(150, minutesOf(await flightOf(launch.missionId)));
    await f.db.update(seasons).set({ rulesetVersion: 13 }).where(eq(seasons.id, f.seasonId));
    expect((await threadOf(launch.missionId))?.fadeAt).toBeUndefined();
  });
});
