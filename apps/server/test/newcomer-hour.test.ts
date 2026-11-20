import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NEWCOMER_HOUR } from '@astera/rules';
import { accounts, buildOrders, deferredPushes, notifications, planets, players, pushDevices } from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import { upgradeBuilding } from '../src/services/build.js';
import { setPushTransport, type PushMessage } from '../src/services/notificationCenter.js';
import { joinSeason } from '../src/services/player.js';
import { EventWorker } from '../src/worker/loop.js';
import { planetView } from '../src/services/planetView.js';
import { createSeason } from '../src/services/season.js';
import { makeAccount, setLevel, testDb, truncateAll } from './helpers.js';

/**
 * KURULUŞ SAATİ ON THE SERVER (plan 2026-11-20 §5.1, Faz 2). A first game's capital is stamped with the
 * end of its newcomer hour at the landing, and its alloy and crystal works run five-fold until then.
 */
const START = new Date('2026-11-20T09:00:00.000Z');
const HOUR_MS = NEWCOMER_HOUR.minutes * 60_000;

afterAll(async () => { await (await testDb()).close(); });

describe('the newcomer hour on a capital', () => {
  beforeEach(async () => { await truncateAll((await testDb()).db); });

  async function land(firstGame: boolean, clock: FixedClock, seasonId: string, name: string) {
    const { db } = await testDb();
    const account = await makeAccount(db, name);
    await db.update(accounts).set({ firstGameShieldAvailable: firstGame }).where(eq(accounts.id, account.id));
    return joinSeason(db, account.id, seasonId, clock);
  }

  async function world() {
    const { db } = await testDb();
    const { season } = await createSeason(db, { shardCode: 'EU-NEWCOMER', seed: 2011, startsAt: START, playerCap: 20 });
    return { db, season, clock: new FixedClock(new Date(START.getTime() + 5 * 60_000)) };
  }

  async function view(planetId: string, clock: FixedClock) {
    const { db } = await testDb();
    return db.transaction(tx => planetView(tx, planetId, clock));
  }

  it('opens for an hour at the landing of a first game, and never for a returning commander', async () => {
    const { db, season, clock } = await world();
    const landedAt = clock.now();
    const first = await land(true, clock, season.id, 'Newcomer');
    const again = await land(false, clock, season.id, 'Returning');
    const [firstRow] = await db.select().from(planets).where(eq(planets.id, first.planetId));
    const [againRow] = await db.select().from(planets).where(eq(planets.id, again.planetId));
    expect(firstRow!.newcomerBoostUntil).toEqual(new Date(landedAt.getTime() + HOUR_MS));
    expect(againRow!.newcomerBoostUntil).toBeNull();
  });

  it('fills the alloy and crystal works five times as fast inside the hour', async () => {
    const { season, clock } = await world();
    const first = await land(true, clock, season.id, 'Newcomer');
    const again = await land(false, clock, season.id, 'Returning');
    const before = { first: await view(first.planetId, clock), again: await view(again.planetId, clock) };
    clock.advance(30);
    const after = { first: await view(first.planetId, clock), again: await view(again.planetId, clock) };
    const made = (side: 'first' | 'again', column: 'bufferAlloy' | 'bufferCrystal') => after[side].planet[column] - before[side].planet[column];
    // Both worlds are built alike: the only difference is the hour. Floors on the view allow one unit either way.
    expect(made('again', 'bufferAlloy')).toBeGreaterThan(0);
    expect(made('first', 'bufferAlloy')).toBeGreaterThanOrEqual(made('again', 'bufferAlloy') * 5 - 5);
    expect(made('first', 'bufferAlloy')).toBeLessThanOrEqual(made('again', 'bufferAlloy') * 5 + 5);
    expect(made('first', 'bufferCrystal')).toBeGreaterThanOrEqual(made('again', 'bufferCrystal') * 5 - 5);
    expect(made('first', 'bufferCrystal')).toBeLessThanOrEqual(made('again', 'bufferCrystal') * 5 + 5);
    expect(after.first.planet.newcomerBoostUntil).toEqual(new Date(START.getTime() + 5 * 60_000 + HOUR_MS));
  });

  it('says nothing of the hour once it is over', async () => {
    const { season, clock } = await world();
    const first = await land(true, clock, season.id, 'Newcomer');
    clock.advance(NEWCOMER_HOUR.minutes);
    expect((await view(first.planetId, clock)).planet.newcomerBoostUntil).toBeNull();
  });
});

/**
 * THE HOUR'S LAST TEN MINUTES AND ITS END (plan §4, Faz 2). Ten minutes before the end the commander is told,
 * in the game and on the phone, to start the next build while the works still run five-fold; a phone in its
 * quiet hours is not woken for it and is not told later either, because later the hour is gone. At the end
 * the game sums what the hour made: alloy and crystal produced on the capital and the builds finished.
 */
describe('the newcomer hour, told', () => {
  const sent: { tokens: string[]; message: PushMessage }[] = [];
  beforeEach(async () => {
    await truncateAll((await testDb()).db);
    sent.length = 0;
    setPushTransport({ send: (tokens, message) => { sent.push({ tokens, message }); return Promise.resolve({ invalid: [], accepted: tokens.length }); } });
  });
  afterEach(() => { setPushTransport(null); });

  async function landed(firstGame: boolean, name: string, offsetMinutes = 0) {
    const { db } = await testDb();
    const { season } = await createSeason(db, { shardCode: `EU-${name.toUpperCase()}`, seed: 2012, startsAt: START, playerCap: 20 });
    const clock = new FixedClock(new Date(START.getTime() + 5 * 60_000));
    const account = await makeAccount(db, name);
    await db.update(accounts).set({ firstGameShieldAvailable: firstGame }).where(eq(accounts.id, account.id));
    await db.insert(pushDevices).values({ token: `phone-${name}`, accountId: account.id, platform: 'android', locale: 'tr',
      utcOffsetMinutes: offsetMinutes, createdAt: clock.now(), lastSeenAt: clock.now() });
    const joined = await joinSeason(db, account.id, season.id, clock);
    const [player] = await db.select().from(players).where(eq(players.accountId, account.id));
    const tick = () => new EventWorker(db, clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    const news = (kind: 'newcomer_hour_ending' | 'newcomer_hour_summary') => db.select().from(notifications)
      .where(and(eq(notifications.playerId, player!.id), eq(notifications.kind, kind)));
    return { db, clock, planetId: joined.planetId, until: START.getTime() + 5 * 60_000 + HOUR_MS, tick, news };
  }

  it('warns ten minutes before the end, in the game and on the phone, once', async () => {
    const w = await landed(true, 'Warned');
    w.clock.set(new Date(w.until - 10 * 60_000 - 1_000));
    await w.tick();
    expect(await w.news('newcomer_hour_ending')).toHaveLength(0);
    w.clock.set(new Date(w.until - 10 * 60_000));
    await w.tick();
    await w.tick();
    const [warning] = await w.news('newcomer_hour_ending');
    expect(warning?.payload).toEqual({ until: new Date(w.until).toISOString() });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ tokens: ['phone-Warned'], message: { kind: 'newcomer_hour_ending', title: 'Kuruluş Saati bitiyor' } });
    expect(sent[0]!.message.body).toContain('10 dakika');
  });

  it('never tells a commander who is not in a first game', async () => {
    const w = await landed(false, 'Veteran');
    w.clock.set(new Date(w.until + 60_000));
    await w.tick();
    expect(await w.news('newcomer_hour_ending')).toHaveLength(0);
    expect(await w.news('newcomer_hour_summary')).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('does not wake a phone in its quiet hours, and does not keep the warning for the morning', async () => {
    // Ten minutes before the end is 09:55 UTC: 23:55 at UTC+14.
    const w = await landed(true, 'Asleep', 14 * 60);
    w.clock.set(new Date(w.until - 10 * 60_000));
    await w.tick();
    expect(await w.news('newcomer_hour_ending')).toHaveLength(1);
    expect(sent).toHaveLength(0);
    expect(await w.db.select().from(deferredPushes)).toHaveLength(0);
  });

  it('sums the hour at its end: what the capital produced and the builds finished inside it', async () => {
    const w = await landed(true, 'Summed');
    // The landing world of a first season, set before any time passes (this test season is not one).
    for (const [type, level] of [['CORE', 3], ['REFINERY', 2], ['EXTRACTOR', 2], ['VAULT', 1]] as const) await setLevel(w.db, w.planetId, type, level);
    // Vault 1 → 2 is under five minutes and finishes now; Refinery 2 → 3 (5.2 min) finishes after the hour.
    await upgradeBuilding(w.db, w.planetId, 'VAULT', w.clock);
    w.clock.set(new Date(w.until - 3 * 60_000));
    await upgradeBuilding(w.db, w.planetId, 'REFINERY', w.clock);
    const [late] = await w.db.select().from(buildOrders).where(and(eq(buildOrders.planetId, w.planetId), eq(buildOrders.status, 'BUILDING')));
    expect(late!.readyAt.getTime()).toBeGreaterThan(w.until);
    w.clock.set(new Date(w.until));
    await w.tick();
    await w.tick();
    const [summary] = await w.news('newcomer_hour_summary');
    const payload = z.object({ alloy: z.number(), crystal: z.number(), builds: z.number() }).parse(summary?.payload);
    expect(payload.builds).toBe(1);
    // Five-fold works for an hour: well over the plain hour of the landing world (147 alloy, 59 crystal).
    expect(payload.alloy).toBeGreaterThan(600);
    expect(payload.crystal).toBeGreaterThan(240);
    // The sum is news in the game, not a phone call.
    expect(sent).toHaveLength(0);
  });

  it('does not say ten minutes are left once the hour is over', async () => {
    const w = await landed(true, 'Late');
    w.clock.set(new Date(w.until));
    await w.tick();
    expect(await w.news('newcomer_hour_ending')).toHaveLength(0);
    expect(await w.news('newcomer_hour_summary')).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });
});
