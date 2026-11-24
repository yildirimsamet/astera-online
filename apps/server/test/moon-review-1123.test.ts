import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { botProfiles, moons, notifications, planets, players, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { announceGateReady, hopFleet, jumpFleet, retargetAttack } from '../src/services/moonMovement.js';
import { scanFromMoon } from '../src/services/moonScan.js';
import { launchAttack } from '../src/services/mission.js';
import { moonUsage } from '../src/services/moonUsage.js';
import { placeStageMoon, stageMoonToolAllowed } from '../src/services/moonStage.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { addMinutes } from '../src/clock.js';
import {
  fuelUp, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, type Fixture,
} from './helpers.js';

/*
  Ay review 2026-11-23 (takeover review): V55, B4, B5, B6.
  - V55 (owner 2026-11-23): Silent Space waits for a commander who stopped playing, so every moon order
    (hop, jump, scan, retarget) is an order and restarts the 30-hour clock.
  - B6: a gate that finishes charging while a Death Star hit has the moon shut announces itself when it reopens.
  - B4: stage and local galaxies can be given a moon of a chosen rarity for playtests; production cannot.
  - B5: moon usage is counted per action, commanders apart from the bot roster, for the bot calibration (§10.1).
*/
describe('moon takeover review fixes', () => {
  let f: Fixture;
  let home: string;
  let colony: string;
  let enemy: string;
  let owner: string;
  const LONG_AGO = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(async () => {
    f = await seedWorld(3, 21_123);
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
    f.clock.advance(250);
    await f.db.update(players).set({ lastProgressAt: LONG_AGO }).where(eq(players.id, owner));
  });

  afterAll(async () => { await (await testDb()).close(); });

  const progressOf = async (playerId: string) =>
    (await f.db.select({ at: players.lastProgressAt }).from(players).where(eq(players.id, playerId)))[0]?.at;
  const moonAt = (planetId: string, rarity: 'COMMON' | 'RARE' | 'EPIC' = 'COMMON') =>
    f.db.insert(moons).values({ planetId, rarity, origin: 'BUILT', visualSeed: 7, bornAt: f.clock.now() });

  it('V55: a hop is an order — it restarts the Silent Space clock', async () => {
    await moonAt(home);
    await giveUnits(f.db, home, { DART: 4 });
    await hopFleet(f.db, owner, home, 'UP', { DART: 4 }, f.clock);
    expect((await progressOf(owner))?.getTime()).toBe(f.clock.now().getTime());
  });

  it('V55: a gate jump is an order', async () => {
    await moonAt(home);
    await moonAt(colony);
    await f.db.insert(units).values({ planetId: home, ownerPlayerId: owner, hull: 'DART', location: MOON_LOCATION, count: 5 });
    await jumpFleet(f.db, owner, home, colony, { DART: 5 }, f.clock);
    expect((await progressOf(owner))?.getTime()).toBe(f.clock.now().getTime());
  });

  it('V55: a Gözcü scan is an order', async () => {
    await moonAt(home);
    await scanFromMoon(f.db, owner, home, enemy, f.clock);
    expect((await progressOf(owner))?.getTime()).toBe(f.clock.now().getTime());
  });

  it('V55: switching a raid between planet and moon is an order', async () => {
    await moonAt(enemy);
    await giveUnits(f.db, home, { DART: 20 });
    const raid = await launchAttack(f.db, home, enemy, { DART: 20 }, f.clock);
    await f.db.update(players).set({ lastProgressAt: LONG_AGO }).where(eq(players.id, owner));
    f.clock.advance(1);
    await retargetAttack(f.db, owner, raid.missionId, 'MOON', f.clock);
    expect((await progressOf(owner))?.getTime()).toBe(f.clock.now().getTime());
  });

  it('B6: a gate charged while the moon is shut announces itself once the moon reopens', async () => {
    const readyAt = addMinutes(f.clock.now(), 60);
    const closedUntil = addMinutes(f.clock.now(), 180);
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now(), gateReadyAt: readyAt, closedUntil,
    });
    const gateReady = () => f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, owner), eq(notifications.kind, 'moon_gate_ready')));

    await f.db.transaction((tx) => announceGateReady(tx, home, readyAt, 'event-1'));
    expect(await gateReady()).toHaveLength(0);
    const reopen = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'moon_gate_ready'), eq(scheduledEvents.refId, home)));
    expect(reopen.map((event) => event.resolveAt.getTime())).toEqual([closedUntil.getTime()]);

    await f.db.transaction((tx) => announceGateReady(tx, home, closedUntil, reopen[0]!.id));
    expect(await gateReady()).toHaveLength(1);
  });

  it('B6: a reopening event outlived by a newer charge stays silent', async () => {
    const closedUntil = addMinutes(f.clock.now(), 180);
    await f.db.insert(moons).values({
      planetId: home, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now(),
      gateReadyAt: addMinutes(f.clock.now(), 400), closedUntil: null,
    });
    await f.db.transaction((tx) => announceGateReady(tx, home, closedUntil, 'event-2'));
    const rows = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, owner), eq(notifications.kind, 'moon_gate_ready')));
    expect(rows).toHaveLength(0);
  });

  it('B4: the stage tool runs on stage and local only', () => {
    expect(stageMoonToolAllowed({ NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'production' })).toBe(false);
    expect(stageMoonToolAllowed({ NODE_ENV: 'production', SENTRY_ENVIRONMENT: 'stage' })).toBe(true);
    expect(stageMoonToolAllowed({ NODE_ENV: 'development', SENTRY_ENVIRONMENT: 'production' })).toBe(true);
  });

  it('B4: the stage tool places a moon of the chosen rarity, once', async () => {
    await placeStageMoon(f.db, enemy, 'EPIC', f.clock);
    const [row] = await f.db.select().from(moons).where(eq(moons.planetId, enemy));
    expect(row).toMatchObject({ rarity: 'EPIC', cracks: 0 });
    await expect(placeStageMoon(f.db, enemy, 'RARE', f.clock)).rejects.toMatchObject({ code: 'MOON_EXISTS' });
  });

  it('B5: moon usage counts each action, commanders apart from the roster', async () => {
    await moonAt(home);
    await moonAt(enemy);
    const bot = f.playerIds[2]!;
    const [botAccount] = await f.db.select({ id: players.accountId }).from(players).where(eq(players.id, bot));
    await f.db.insert(botProfiles).values({ accountId: botAccount!.id, ordinal: 1, persona: 'RAIDER', nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    await giveUnits(f.db, home, { DART: 4 });
    await hopFleet(f.db, owner, home, 'UP', { DART: 4 }, f.clock);
    await scanFromMoon(f.db, owner, home, enemy, f.clock);
    await giveUnits(f.db, enemy, { DART: 3 });
    await hopFleet(f.db, bot, enemy, 'UP', { DART: 3 }, f.clock);

    const usage = await moonUsage(f.db, f.seasonId, addMinutes(f.clock.now(), -60));
    expect(usage.commanders).toMatchObject({ hops: 1, scans: 1, jumps: 0, retargets: 0, moonRaids: 0, builds: 0 });
    expect(usage.roster).toMatchObject({ hops: 1, scans: 0 });
    expect(usage.moonsStanding).toBe(2);
  });
});
