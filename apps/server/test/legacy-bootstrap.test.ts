import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { accounts, cosmeticEntitlements, legacyAwards, legacyFacts, legacyProfiles, planets, players } from '../src/db/schema.js';
import { bootstrapLegacyBatch } from '../src/services/legacyBootstrap.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2, 7341); });
afterAll(async () => { await (await testDb()).close(); });

const batch = (scope: 'players' | 'accounts', apply: boolean, over: { limit?: number; cursor?: string } = {}) =>
  bootstrapLegacyBatch(f.db, { scope, apply, limit: 24, at: f.clock.now(), ...over });

it('previews old supporter and purchase rights for accounts without season-result receipts, without writing', async () => {
  await f.db.insert(cosmeticEntitlements).values([
    { accountId: f.accountIds[0]!, cosmeticId: 'badge-supporter', source: 'ADMIN', orderRef: 'legacy:supporter', grantedAt: f.clock.now() },
    { accountId: f.accountIds[1]!, cosmeticId: 'planet-lava', source: 'PADDLE', orderRef: 'legacy:purchase', grantedAt: f.clock.now() },
  ]);
  expect((await batch('accounts', false)).awardsAdded).toBe(2);
  expect(await f.db.select().from(legacyAwards)).toHaveLength(0);
  expect(await f.db.select().from(legacyProfiles)).toHaveLength(0);
  expect((await batch('accounts', true)).awardsAdded).toBe(2);
  const before = await f.db.select().from(legacyAwards);
  expect(before.find(row => row.definitionId === 'astera-supporter')?.rarity).toBe('LEGENDARY');
  expect((await batch('accounts', true)).awardsAdded).toBe(0);
  expect((await f.db.select().from(legacyAwards)).map(row => row.id).sort()).toEqual(before.map(row => row.id).sort());
});

it('walks bounded account pages once and terminates at the final cursor', async () => {
  let cursor: string | undefined, processed = 0;
  const visited: string[] = [];
  do {
    const result = await batch('accounts', true, { limit: 1, ...(cursor ? { cursor } : {}) });
    processed += result.processed;
    if (result.nextCursor) { expect(visited).not.toContain(result.nextCursor); visited.push(result.nextCursor); }
    cursor = result.nextCursor ?? undefined;
  } while (cursor);
  expect(processed).toBe((await f.db.select().from(accounts)).length);
});

it('restores provable live production but never issues a live season podium or memento', async () => {
  const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  if (!world) throw new Error('Missing fixture world');
  await f.db.update(planets).set({ seasonTelemetry: { ...world.seasonTelemetry, shipsBuilt: { DART: 100 } } })
    .where(eq(planets.id, world.id));
  expect((await batch('players', false)).awardsAdded).toBeGreaterThan(0);
  expect(await f.db.select().from(legacyFacts)).toHaveLength(0);
  const applied = await batch('players', true);
  expect(applied.processed).toBe(2);
  const before = await f.db.select().from(legacyAwards);
  expect(before.find(row => row.definitionId === 'shipwright-dart')?.tier).toBe(1);
  expect(before.some(row => ['honor-podium', 'dominion-podium', 'season-memento'].includes(row.definitionId))).toBe(false);
  expect((await batch('players', true)).awardsAdded).toBe(0);
  expect((await f.db.select().from(legacyAwards)).map(row => row.id).sort()).toEqual(before.map(row => row.id).sort());
});

it('keeps waiting-world state out of the main-galaxy live bootstrap', async () => {
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  if (!waiting) throw new Error('Missing waiting fixture');
  await f.db.update(players).set({ seasonId: waiting.id });
  expect((await batch('players', true)).processed).toBe(0);
  expect(await f.db.select().from(legacyFacts)).toHaveLength(0);
});

it('rejects an unbounded batch before reading or writing', async () => {
  await expect(batch('accounts', true, { limit: 0 })).rejects.toThrow('1–24');
  await expect(batch('players', true, { limit: 25 })).rejects.toThrow('1–24');
});
