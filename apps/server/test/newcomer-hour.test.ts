import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NEWCOMER_HOUR } from '@astera/rules';
import { accounts, planets } from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import { joinSeason } from '../src/services/player.js';
import { planetView } from '../src/services/planetView.js';
import { createSeason } from '../src/services/season.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';

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
