import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ARENA_ECONOMY as E } from '@astera/rules/arena';
import { arenaShips, galaxyEventOccurrences, notifications, planets, seasons } from '../src/db/schema.js';
import { riftWindow } from '../src/services/arenaRift.js';
import { chooseShip, endSortie, launchSortie, readHangar } from '../src/services/arenaShips.js';
import { syncMissingFixedOccurrences } from '../src/services/galaxyEvents.js';
import { GameError } from '../src/services/planet.js';
import { galaxyEventOccurrenceKind } from '../src/db/schema.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * YARIK SAATLERİ (owner 2026-11-27). The Yarık is open only inside a Yarık Saati (17:00–18:00 TRT) or an
 * Asteryum Fırtınası (21:00–22:00); entry closes when the window ends, and those inside have five minutes to
 * fly out before every ship still there is lost.
 */
let f: Fixture;
let account: string;
const flight = { fuel: 10, ammo: 10, pilotKills: 0, assists: 0 };
const MIN = 60_000;
let sequence = 0;

async function windowAt(kind: 'RIFT_HOUR' | 'ASTERIUM_STORM', fromMinutes: number, toMinutes: number, seasonId = f.seasonId): Promise<{ startsAt: Date; endsAt: Date }> {
  const now = f.clock.now().getTime();
  const startsAt = new Date(now + fromMinutes * MIN); const endsAt = new Date(now + toMinutes * MIN);
  await f.db.insert(galaxyEventOccurrences).values({
    seasonId, sequence: sequence++, kind, definitionVersion: 1, startsAt, endsAt, createdAt: new Date(now - 10 * MIN),
    effect: kind === 'RIFT_HOUR' ? { roomVersion: 1 } : { fieldVersion: 1 },
  });
  return { startsAt, endsAt };
}

beforeEach(async () => {
  sequence = 0;
  f = await seedWorld(1, 9_427);
  account = f.accountIds[0]!;
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
  await f.db.update(planets).set({ alloy: 1000, crystal: 1000, deuterium: 500 }).where(eq(planets.id, f.planetIds[0]!));
  await chooseShip(f.db, f.clock, account, 'kilavuz');
});
afterAll(async () => { await (await testDb()).close(); });

describe('the Yarık\'s window', () => {
  it('is shut with nothing dealt', async () => {
    expect(await riftWindow(f.db, f.clock)).toEqual({ open: false, storm: false, closesAt: null, deadline: null, opensAt: null });
  });

  it('is open inside a Yarık Saati, without the storm, until it ends', async () => {
    const { endsAt } = await windowAt('RIFT_HOUR', -10, 50);
    expect(await riftWindow(f.db, f.clock)).toEqual({ open: true, storm: false, closesAt: endsAt, deadline: null, opensAt: null });
  });

  it('is open inside the storm, and says the storm blows', async () => {
    await windowAt('ASTERIUM_STORM', -1, 59);
    expect(await riftWindow(f.db, f.clock)).toMatchObject({ open: true, storm: true });
  });

  it('gives five minutes after a window ends, then names the next opening', async () => {
    const { endsAt } = await windowAt('RIFT_HOUR', -61, -1);
    const next = await windowAt('ASTERIUM_STORM', 179, 239);
    expect(await riftWindow(f.db, f.clock)).toEqual({
      open: false, storm: false, closesAt: null, deadline: new Date(endsAt.getTime() + E.riftGraceMinutes * MIN), opensAt: next.startsAt,
    });
    f.clock.set(new Date(endsAt.getTime() + 4 * MIN + 59_000));
    expect((await riftWindow(f.db, f.clock)).deadline).not.toBeNull();
    f.clock.set(new Date(endsAt.getTime() + 5 * MIN));
    expect(await riftWindow(f.db, f.clock)).toMatchObject({ open: false, deadline: null, opensAt: next.startsAt });
  });

  it('reads only live seasons', async () => {
    await windowAt('RIFT_HOUR', -10, 50);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    expect((await riftWindow(f.db, f.clock)).open).toBe(false);
  });
});

describe('entering the Yarık', () => {
  it('is refused while it is shut, with the next opening', async () => {
    const next = await windowAt('RIFT_HOUR', 120, 180);
    const refusal = await launchSortie(f.db, f.clock, account).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(GameError);
    expect(refusal).toMatchObject({ code: 'RIFT_CLOSED', params: { opensAt: next.startsAt.toISOString() } });
    // Nothing was paid for a refused launch.
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]?.deuterium).toBe(500);
  });

  it('is refused in the five minutes after a window, which are only for flying out', async () => {
    await windowAt('RIFT_HOUR', -60, -1);
    await expect(launchSortie(f.db, f.clock, account)).rejects.toMatchObject({ code: 'RIFT_CLOSED' });
  });

  it('flies inside a window', async () => {
    await windowAt('RIFT_HOUR', -1, 59);
    expect((await launchSortie(f.db, f.clock, account)).sortieId).toEqual(expect.any(String));
  });
});

describe('the hangar door', () => {
  it('shows the window, so the door can say when it opens', async () => {
    const next = await windowAt('RIFT_HOUR', 30, 90);
    expect((await readHangar(f.db, f.clock, account)).rift).toEqual({
      open: false, storm: false, closesAt: null, deadline: null, opensAt: next.startsAt.toISOString(),
    });
    f.clock.advance(31);
    expect((await readHangar(f.db, f.clock, account)).rift).toMatchObject({ open: true, closesAt: next.endsAt.toISOString() });
  });
});

describe('a ship lost in the Yarık', () => {
  it('is repaired in five minutes (owner 2026-11-27)', async () => {
    await windowAt('RIFT_HOUR', -1, 59);
    const { sortieId } = await launchSortie(f.db, f.clock, account);
    const result = await endSortie(f.db, f.clock, account, sortieId, { ...flight, outcome: 'dead', hold: [10, 0, 0, 0] });
    expect(result?.readyAt).toBe(new Date(f.clock.now().getTime() + 5 * MIN).toISOString());
  });

  it('tells a pilot who was away that the Yarık closed on their ship', async () => {
    await windowAt('RIFT_HOUR', -1, 59);
    const { sortieId } = await launchSortie(f.db, f.clock, account);
    await endSortie(f.db, f.clock, account, sortieId, { ...flight, outcome: 'dead', hold: [30, 0, 0, 2], unseen: true, closed: true });
    const [news] = await f.db.select().from(notifications).where(and(eq(notifications.kind, 'arena_sortie_end'), eq(notifications.refId, sortieId)));
    expect(news?.payload).toMatchObject({ outcome: 'dead', closed: true, lost: { alloy: 30, crystal: 0, deuterium: 0 } });
    expect((await f.db.select().from(arenaShips))[0]).toMatchObject({ readyReason: 'repair', holdAlloy: 0, holdAsterium: 0 });
  });
});

describe('a live season gains the Yarık Saati', () => {
  it('appends today\'s and later windows at 17:00 Türkiye time, and is safe to run twice', async () => {
    // A live season dealt before the Yarık Saati existed (prod: EU-1/EU-2, ruleset 20).
    await f.db.update(seasons).set({ rulesetVersion: 20, endsAt: new Date(f.clock.now().getTime() + 3 * 86_400_000) }).where(eq(seasons.id, f.seasonId));
    const append = () => f.db.transaction((tx) => syncMissingFixedOccurrences(tx, { now: f.clock.now(), seasonId: f.seasonId, kinds: ['RIFT_HOUR'] }));
    expect(await append()).toBe(3);
    expect(await append()).toBe(0);
    const rows = await f.db.select().from(galaxyEventOccurrences).where(eq(galaxyEventOccurrences.kind, 'RIFT_HOUR'));
    // The fixture opens at 2026-01-01 00:00 UTC (03:00 TRT): 14:00 UTC is 17:00 TRT.
    expect(rows.map((row) => row.startsAt.toISOString()).sort()).toEqual(['2026-01-01T14:00:00.000Z', '2026-01-02T14:00:00.000Z', '2026-01-03T14:00:00.000Z']);
    expect(rows.every((row) => row.endsAt.getTime() - row.startsAt.getTime() === 60 * MIN)).toBe(true);
  });

  it('is the last calendar kind in the enum', () => {
    expect(galaxyEventOccurrenceKind.enumValues.at(-1)).toBe('RIFT_HOUR');
  });
});
