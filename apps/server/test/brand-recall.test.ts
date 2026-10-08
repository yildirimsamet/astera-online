import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accounts, accountRewards, planets } from '../src/db/schema.js';
import { registerAccount } from '../src/services/account.js';
import { brandRecallStatus, answerBrandRecall } from '../src/services/brandRecall.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('a single brand quiz per new account', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2);
    await f.db.insert(accountRewards).values({ accountId: f.accountIds[0]!, rewardId: 'BRAND_RECALL:1', createdAt: f.clock.now() });
  });

  it('atomically enrolls a newly registered account', async () => {
    const account = await registerAccount(f.db, { username: 'newcommander', password: 'correct-horse-battery' }, true, f.clock.now());
    expect(await brandRecallStatus(f.db, account.id)).toMatchObject({ eligible: true, completed: false, reward: { alloy: 100, crystal: 50, deuterium: 20 } });
  });

  it.each([true, false])('preserves the first-game shield flag %s and the quiz enrollment clock', async (enabled) => {
    const account = await registerAccount(f.db, { username: 'shieldandquiz', password: 'correct-horse-battery' }, enabled, f.clock.now());
    const [stored] = await f.db.select().from(accounts).where(eq(accounts.id, account.id));
    const [enrollment] = await f.db.select().from(accountRewards).where(and(
      eq(accountRewards.accountId, account.id), eq(accountRewards.rewardId, 'BRAND_RECALL:1'),
    ));
    expect(stored!.firstGameShieldAvailable).toBe(enabled);
    expect(enrollment!.createdAt).toEqual(f.clock.now());
  });

  it('does not enroll an existing commander by reading their status', async () => {
    expect(await brandRecallStatus(f.db, f.accountIds[1]!)).toMatchObject({ eligible: false, completed: false });
  });

  it('refuses an early answer and an unenrolled account', async () => {
    await expect(answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock)).rejects.toMatchObject({ code: 'RECALL_TOO_EARLY' });
    f.clock.advance(3);
    await expect(answerBrandRecall(f.db, f.accountIds[1]!, 'asteraonline.space', f.clock)).rejects.toMatchObject({ code: 'RECALL_UNAVAILABLE' });
  });

  it('a wrong answer grants nothing and permits another attempt', async () => {
    f.clock.advance(3);
    expect(await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.com', f.clock)).toMatchObject({ correct: false, completed: false, granted: { alloy: 0, crystal: 0, deuterium: 0 } });
    expect((await brandRecallStatus(f.db, f.accountIds[0]!)).completed).toBe(false);
    expect(await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock)).toMatchObject({ correct: true, completed: true, granted: { alloy: 100, crystal: 50, deuterium: 20 } });
  });

  it('pays exactly once when two correct requests race, including deuterium', async () => {
    f.clock.advance(3);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const results = await Promise.all([
      answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock),
      answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock),
    ]);
    expect(results.reduce((sum, value) => sum + value.granted.alloy, 0)).toBe(100);
    expect(results.reduce((sum, value) => sum + value.granted.deuterium, 0)).toBe(20);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(after!.alloy - before!.alloy).toBe(100);
    expect(after!.crystal - before!.crystal).toBe(50);
    expect(after!.deuterium - before!.deuterium).toBe(20);
    expect((await brandRecallStatus(f.db, f.accountIds[0]!)).completed).toBe(true);
  });

  it('dismissal survives reloads and cannot later be exchanged for a reward', async () => {
    const skipped = await answerBrandRecall(f.db, f.accountIds[0]!, null, f.clock);
    expect(skipped).toMatchObject({ completed: true, granted: { alloy: 0, crystal: 0, deuterium: 0 } });
    f.clock.advance(3);
    expect(await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock)).toMatchObject({ completed: true, granted: { alloy: 0, crystal: 0, deuterium: 0 } });
  });

  it('cannot pay into another account’s planet', async () => {
    f.clock.advance(3);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(after!.alloy).toBe(before!.alloy);
    const paid = await f.db.select().from(accountRewards).where(and(eq(accountRewards.accountId, f.accountIds[0]!), eq(accountRewards.rewardId, 'BRAND_RECALL:1')));
    expect(paid).toHaveLength(1);
  });

  it('returns the authoritative planet on retry after a lost acknowledgement without paying again', async () => {
    f.clock.advance(3);
    const first = await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock);
    const retry = await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock);
    expect(retry.granted).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    if (!('planet' in first) || !('planet' in retry)) throw new Error('Both acknowledgements must include the planet snapshot');
    expect(retry.planet).toEqual(first.planet);
    expect(retry.planet).toBeDefined();
  });

  it('does not consume a reward while its capital is recovering', async () => {
    f.clock.advance(3);
    await f.db.update(planets).set({ recoveryUntil: new Date(f.clock.now().getTime() + 60_000) }).where(eq(planets.id, f.planetIds[0]!));
    await expect(answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock)).rejects.toMatchObject({ code: 'WORLD_RECOVERING' });
    expect((await brandRecallStatus(f.db, f.accountIds[0]!)).completed).toBe(false);
    f.clock.advance(1);
    expect((await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock)).granted).toEqual({ alloy: 100, crystal: 50, deuterium: 20 });
  });

  it('requires an owned capital for a payout but lets an enrolled account skip without one', async () => {
    const account = await registerAccount(f.db, { username: 'withoutplanet', password: 'correct-horse-battery' }, true, f.clock.now());
    f.clock.advance(3);
    await expect(answerBrandRecall(f.db, account.id, 'asteraonline.space', f.clock)).rejects.toMatchObject({ code: 'NO_PLANET' });
    expect((await answerBrandRecall(f.db, account.id, null, f.clock)).completed).toBe(true);
    await expect(answerBrandRecall(f.db, f.accountIds[1]!, null, f.clock)).rejects.toMatchObject({ code: 'RECALL_UNAVAILABLE' });
  });

  it('serializes a skip racing a correct claim without paying after a skip', async () => {
    f.clock.advance(3);
    const results = await Promise.all([
      answerBrandRecall(f.db, f.accountIds[0]!, null, f.clock),
      answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock),
    ]);
    const [row] = await f.db.select().from(accountRewards).where(and(eq(accountRewards.accountId, f.accountIds[0]!), eq(accountRewards.rewardId, 'BRAND_RECALL:1')));
    expect(results.reduce((sum, value) => sum + value.granted.alloy, 0)).toBe(row!.alloy);
    expect(row!.alloy === 0 || row!.alloy === 100).toBe(true);
    expect(row!.claimedAt).not.toBeNull();
    expect((await answerBrandRecall(f.db, f.accountIds[0]!, 'asteraonline.space', f.clock)).granted.alloy).toBe(0);
  });
});
