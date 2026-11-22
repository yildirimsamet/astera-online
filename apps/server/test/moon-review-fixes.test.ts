import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { moons, notifications, planets, seasons, units } from '../src/db/schema.js';
import { announceGateReady, jumpFleet } from '../src/services/moonMovement.js';
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
});
