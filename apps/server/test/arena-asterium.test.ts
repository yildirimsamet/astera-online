import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { arenaShips, galaxyEventOccurrences, planets, playerAsterium, seasons } from '../src/db/schema.js';
import { asteriumStormActive } from '../src/services/arenaStorm.js';
import { chooseShip, endSortie, launchSortie } from '../src/services/arenaShips.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * ASTERYUM IN THE YARIK (plan 2026-11-24 §3.2, A2/A4/A5): an exit carries the fourth hold slot into the
 * commander's own stock, outside the day's cap; a recall keeps it aboard; a death loses it like any cargo.
 */
let f: Fixture;
let account: string;
let player: string;
const balance = async (): Promise<number> =>
  (await f.db.select({ n: playerAsterium.balance }).from(playerAsterium).where(eq(playerAsterium.playerId, player)))[0]?.n ?? 0;
const flight = { fuel: 10, ammo: 10, pilotKills: 0, assists: 0 };

beforeEach(async () => {
  f = await seedWorld(1, 9_411);
  account = f.accountIds[0]!; player = f.playerIds[0]!;
  await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion, synthesisStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
  await f.db.update(planets).set({ alloy: 1000, crystal: 1000, deuterium: 500 }).where(eq(planets.id, f.planetIds[0]!));
  await chooseShip(f.db, f.clock, account, 'kilavuz');
});
afterAll(async () => { await (await testDb()).close(); });

describe('an exit with Asteryum aboard', () => {
  it('credits whole Asteryum, past the day’s cap, and says so', async () => {
    // Today's room for raw resources is already spent: Asteryum does not care.
    await f.db.update(arenaShips).set({ transferDay: f.clock.now().toISOString().slice(0, 10), sentAlloy: 1e9, sentCrystal: 1e9, sentDeuterium: 1e9 });
    const { sortieId } = await launchSortie(f.db, f.clock, account);
    const result = await endSortie(f.db, f.clock, account, sortieId, { ...flight, outcome: 'extracted', hold: [5, 0, 0, 7.6] });
    expect(result).toMatchObject({ outcome: 'extracted', asterium: 7 });
    expect(await balance()).toBe(7);
  });

  it('pays nothing in a season without Asteryum', async () => {
    await f.db.update(seasons).set({ synthesisStartsAt: null }).where(eq(seasons.id, f.seasonId));
    const { sortieId } = await launchSortie(f.db, f.clock, account);
    const result = await endSortie(f.db, f.clock, account, sortieId, { ...flight, outcome: 'extracted', hold: [0, 0, 0, 4] });
    expect(result?.asterium).toBe(0);
    expect(await balance()).toBe(0);
  });

  it('keeps Asteryum aboard through a deploy recall and flies it out next time', async () => {
    const first = await launchSortie(f.db, f.clock, account);
    await endSortie(f.db, f.clock, account, first.sortieId, { ...flight, outcome: 'recalled', hold: [0, 0, 0, 3] });
    expect((await f.db.select().from(arenaShips))[0]?.holdAsterium).toBe(3);
    const second = await launchSortie(f.db, f.clock, account);
    expect(second.hold).toEqual([0, 0, 0, 3]);
  });

  it('loses it with the ship', async () => {
    const { sortieId } = await launchSortie(f.db, f.clock, account);
    await endSortie(f.db, f.clock, account, sortieId, { ...flight, outcome: 'dead', hold: [0, 0, 0, 6] });
    expect(await balance()).toBe(0);
    expect((await f.db.select().from(arenaShips))[0]?.holdAsterium).toBe(0);
  });
});

describe('the room’s storm switch', () => {
  it('is on only inside a dealt Asteryum Fırtınası window of a live season', async () => {
    expect(await asteriumStormActive(f.db, f.clock)).toBe(false);
    const now = f.clock.now().getTime();
    await f.db.insert(galaxyEventOccurrences).values({
      seasonId: f.seasonId, sequence: 0, kind: 'ASTERIUM_STORM', definitionVersion: 1,
      startsAt: new Date(now - 60_000), endsAt: new Date(now + 60_000), effect: { fieldVersion: 1 }, createdAt: new Date(now - 120_000),
    });
    expect(await asteriumStormActive(f.db, f.clock)).toBe(true);
    f.clock.advance(1);
    expect(await asteriumStormActive(f.db, f.clock)).toBe(false);
  });
});
