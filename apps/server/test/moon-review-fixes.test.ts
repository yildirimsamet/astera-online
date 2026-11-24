import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { hpRadiationSources, missions, moonMoves, moons, notifications, planets, players, seasons, units } from '../src/db/schema.js';
import { announceGateReady, hopFleet, jumpFleet } from '../src/services/moonMovement.js';
import { moonWatchStatus, probeMoon } from '../src/services/moon.js';
import { explodeMoon } from '../src/services/moonExplosion.js';
import { launchTransfer } from '../src/services/movement.js';
import { commanderRows, demolish } from '../src/services/reclaim.js';
import { vacationStatus } from '../src/services/vacation.js';
import { maybeEscapeToMoon } from '../src/services/bots/moon.js';
import { BOT_PERSONAS } from '../src/services/bots/personas.js';
import { launchAttack } from '../src/services/mission.js';
import { planetView } from '../src/services/planetView.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { addMinutes } from '../src/clock.js';
import {
  fuelUp, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, type Fixture,
} from './helpers.js';

/*
  Code-review regression suite for verified server bugs (#1, #5, #7, #10):
  - #1: `announceGateReady` must deliver repeated `moon_gate_ready` notifications on the same planet
    (not collide on `notifications_ref_idx` with static `refId: planetId`).
  - #5: `announceGateReady` must NOT fire while the moon is shut by a Death Star hit (`closedUntil > readyAt`).
  - #7: `jumpFleet` must refuse jumping into a colony whose loyalty has already reached 0 (non-operational).
  - #10: `maybeEscapeToMoon` returns updated PlanetView when fleet hops up so the bot turn does not see stale ships.
*/
const silent = pino({ level: 'silent' });
const always = () => 0;

describe('moon code-review server fixes', () => {
  let f: Fixture;
  let home: string;
  let colony: string;
  let enemy: string;
  let owner: string;

  beforeEach(async () => {
    f = await seedWorld(3, 20_950);
    [home, colony, enemy] = f.planetIds as [string, string, string];
    owner = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ controllerPlayerId: owner, kind: 'COLONY', loyalty: 100 }).where(eq(planets.id, colony));
    await placeAt(f.db, home, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, colony, { x: 300, y: 0, z: 0 });
    await placeAt(f.db, enemy, { x: 500, y: 0, z: 0 });
    for (const id of [home, colony, enemy]) {
      await setLevel(f.db, id, 'CORE', 10);
      await setLevel(f.db, id, 'HANGAR', 6);
      await grant(f.db, id, 100_000, 100_000);
      await fuelUp(f.db, id, 5_000);
    }
    await levelWorld(f.db, [home, colony, enemy]);
    f.clock.advance(10);
  });

  afterAll(async () => { await (await testDb()).close(); });

  it('#1: announceGateReady delivers a second moon_gate_ready notification after a second jump', async () => {
    const t1 = addMinutes(f.clock.now(), 120);
    const t2 = addMinutes(f.clock.now(), 300);
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now(), gateReadyAt: t1,
    });

    await f.db.transaction((tx) => announceGateReady(tx, home, t1));
    await f.db.update(moons).set({ gateReadyAt: t2 }).where(eq(moons.planetId, home));
    await f.db.transaction((tx) => announceGateReady(tx, home, t2));

    const rows = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, owner), eq(notifications.kind, 'moon_gate_ready')));
    expect(rows).toHaveLength(2);
  });

  it('#5: announceGateReady does not notify while the moon is shut by a Death Star hit', async () => {
    const readyAt = addMinutes(f.clock.now(), 60);
    const closedUntil = addMinutes(f.clock.now(), 180);
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now(),
      gateReadyAt: readyAt, closedUntil,
    });

    await f.db.transaction((tx) => announceGateReady(tx, home, readyAt));

    const rows = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, owner), eq(notifications.kind, 'moon_gate_ready')));
    expect(rows).toHaveLength(0);
  });

  it('#7: jumpFleet refuses jumping into a non-operational colony (loyalty 0)', async () => {
    await f.db.insert(moons).values([
      { planetId: home, rarity: 'RARE', origin: 'BUILT', visualSeed: 3, bornAt: f.clock.now() },
      { planetId: colony, rarity: 'RARE', origin: 'SEED', visualSeed: 4, bornAt: f.clock.now() },
    ]);
    await f.db.insert(units).values({
      planetId: home, ownerPlayerId: owner, hull: 'DART', location: MOON_LOCATION, count: 5,
    });
    await f.db.update(planets).set({ loyalty: 0 }).where(eq(planets.id, colony));

    await expect(jumpFleet(f.db, owner, home, colony, { DART: 5 }, f.clock))
      .rejects.toMatchObject({ code: 'COLONY_SECESSION_PENDING' });
  });

  it('#10: maybeEscapeToMoon returns refreshed PlanetView with empty planet fleet after hop-up', async () => {
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 5, bornAt: f.clock.now(),
    });
    await giveUnits(f.db, home, { DART: 6 });
    await giveUnits(f.db, enemy, { WARDEN: 40 });
    const raid = await launchAttack(f.db, enemy, home, { WARDEN: 40 }, f.clock, f.playerIds[2], true);
    await f.db.insert(notifications).values({
      playerId: owner, kind: 'incoming_fleet', refId: raid.missionId,
      payload: { arriveAt: addMinutes(f.clock.now(), 15).toISOString(), targetPlanetName: 'Home', fleet: { WARDEN: 40 } },
      createdAt: f.clock.now(),
    });

    const before = await f.db.transaction((tx) => planetView(tx, home, f.clock));
    expect(before.fleet.DART).toBe(6);

    const did: string[] = [];
    const after = await maybeEscapeToMoon(
      f.db, f.clock, { playerId: owner, planetId: home, seasonId: f.seasonId },
      BOT_PERSONAS.BUILDER, before, did, silent, always,
    );
    expect(did).toContain('moon:hop-up');
    expect(after).toBeDefined();
    expect(after.fleet.DART ?? 0).toBe(0);
  });

  it('Paket A P0 #1: demolish deletes historical moon_moves on a lost colony before deleting player', async () => {
    await f.db.insert(moons).values({
      planetId: colony, rarity: 'COMMON', origin: 'BUILT', visualSeed: 6, bornAt: f.clock.now(),
    });
    await f.db.insert(moonMoves).values({
      seasonId: f.seasonId, ownerPlayerId: owner, kind: 'HOP_UP',
      fromPlanetId: colony, toPlanetId: colony, fleet: { DART: 2 },
      departAt: f.clock.now(), arriveAt: f.clock.now(), status: 'LANDED',
    });
    // Colony changed hands to enemy before owner's seat is reclaimed.
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[2]! }).where(eq(planets.id, colony));

    await f.db.transaction(async (tx) => {
      const rows = await commanderRows(tx, [home], owner);
      await demolish(tx, [home], owner, rows);
    });

    const left = await f.db.select().from(players).where(eq(players.id, owner));
    expect(left).toHaveLength(0);
  });

  it('Paket A P0 #2: launchTransfer from MOON with planet cargo is blocked by K12 when a raid is due on PLANET', async () => {
    await f.db.insert(moons).values({
      planetId: home, rarity: 'RARE', origin: 'BUILT', visualSeed: 7, bornAt: f.clock.now(),
    });
    await f.db.insert(units).values({
      planetId: home, ownerPlayerId: owner, hull: 'COURIER', location: MOON_LOCATION, count: 5,
    });
    await f.db.insert(missions).values({
      seasonId: f.seasonId, kind: 'attack', ownerPlayerId: f.playerIds[2]!,
      originPlanetId: enemy, targetPlanetId: home, targetBody: 'PLANET',
      fleet: { WARDEN: 10 }, fuelPaid: 0, distance: 500, departAt: addMinutes(f.clock.now(), -10),
      arriveAt: f.clock.now(), status: 'in_flight',
    });

    await expect(launchTransfer(
      f.db, owner, home, colony, { COURIER: 5 }, { alloy: 500, crystal: 0, deuterium: 0 },
      f.clock, 1, undefined, false, 'PLANET', 'MOON',
    )).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
  });

  it('Paket A P1 #5 & #7: pending JUMP blocks vacation, does not fake HOP in probeMoon/watch, and probeMoon exposes gateReadyAt', async () => {
    await f.db.insert(moons).values([
      { planetId: home, rarity: 'RARE', origin: 'BUILT', visualSeed: 8, bornAt: f.clock.now() },
      { planetId: colony, rarity: 'RARE', origin: 'SEED', visualSeed: 9, bornAt: f.clock.now() },
    ]);
    await f.db.insert(units).values({
      planetId: home, ownerPlayerId: owner, hull: 'DART', location: MOON_LOCATION, count: 6,
    });

    await jumpFleet(f.db, owner, home, colony, { DART: 6 }, f.clock);

    const vac = await vacationStatus(f.db, owner, f.clock, 3);
    expect(vac.reasons).toContain('VACATION_FLEET');

    const probed = await probeMoon(f.db, home, (n) => ({ low: n, high: n }), f.clock.now());
    expect(probed?.hopping).toBe(false);
    expect(probed?.gateReadyAt).toBeTruthy();

    const watch = await moonWatchStatus(f.db, [home]);
    expect(watch.get(home)).toBe('HOME');
  });

  it('Paket A P1 #4 & P2 #14 & planetView: explodeMoon clears moon radiation, announceGateReady deduplicates by eventId, and planetView exposes moon damage', async () => {
    const t1 = addMinutes(f.clock.now(), 60);
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 10, bornAt: f.clock.now(), gateReadyAt: t1,
    });
    const eventId = randomUUID();
    await f.db.transaction((tx) => announceGateReady(tx, home, t1, eventId));
    await f.db.transaction((tx) => announceGateReady(tx, home, t1, eventId));
    const notes = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, owner), eq(notifications.kind, 'moon_gate_ready')));
    expect(notes).toHaveLength(1);

    await f.db.insert(units).values({
      planetId: home, ownerPlayerId: owner, hull: 'DART', location: MOON_LOCATION, count: 4,
      damage: [{ hull: 'DART', count: 2, damageBp: 9600, remainderBp: 0 }],
    });
    const view = await f.db.transaction((tx) => planetView(tx, home, f.clock));
    expect(view.moon?.fleetDamage).toHaveLength(1);
    expect(view.moon?.fleetCombatReady.DART).toBe(2);

    await f.db.insert(hpRadiationSources).values({
      seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home, body: 'MOON',
      x: 0, y: 0, z: 0, radius: 100, intensityHpPerMinute: 5, radiationLevel: null,
      origin: 'ENVIRONMENT', mode: 'EMIT', activeFrom: f.clock.now(), activeUntil: addMinutes(f.clock.now(), 60),
    });
    const [dsMission] = await f.db.insert(missions).values({
      seasonId: f.seasonId, kind: 'death_star', ownerPlayerId: f.playerIds[2]!,
      originPlanetId: enemy, targetPlanetId: home, targetBody: 'MOON',
      fleet: {}, fuelPaid: 0, distance: 500, departAt: addMinutes(f.clock.now(), -10),
      arriveAt: f.clock.now(), status: 'in_flight',
    }).returning({ id: missions.id });
    const [world] = await f.db.select().from(planets).where(eq(planets.id, home));
    await f.db.transaction((tx) => explodeMoon(tx, {
      missionId: dsMission!.id, world: world!, holder: owner, rarity: 'COMMON', now: f.clock.now(),
    }));
    const radRows = await f.db.select().from(hpRadiationSources)
      .where(and(eq(hpRadiationSources.anchorId, home), eq(hpRadiationSources.body, 'MOON')));
    expect(radRows).toHaveLength(0);
  });

  it('Paket A P1: hopFleet succeeds and reserves ships off-planet', async () => {
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 11, bornAt: f.clock.now(),
    });
    await giveUnits(f.db, home, { DART: 4 });
    const move = await hopFleet(f.db, owner, home, 'UP', { DART: 4 }, f.clock);
    expect(move.status).toBe('PENDING');
    expect(move.kind).toBe('HOP_UP');
  });
});
