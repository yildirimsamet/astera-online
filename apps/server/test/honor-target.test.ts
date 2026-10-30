import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { honorTargetSchema } from '../../web/src/api/schemas.js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accounts, clanMemberships, clans, honorObservations, honorSeasons, strategicAssets } from '../src/db/schema.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import { giveUnits, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

describe('read-only Honor target guidance', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 7719); });
  afterAll(async () => { await (await testDb()).close(); });
  const preview = (target = f.planetIds[1]!) => honorTargetPreview(f.db, f.playerIds[0]!, target, f.clock, new Set());
  const setup = async (mode: 'ACTIVE' | 'SHADOW' = 'ACTIVE', own = 100, enemy = 100, ownCore = 9, enemyCore = 9) => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, mode, f.clock));
    await giveUnits(f.db, f.planetIds[0]!, { DART: own });
    await giveUnits(f.db, f.planetIds[1]!, { DART: enemy });
    await setLevel(f.db, f.planetIds[0]!, 'CORE', ownCore);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', enemyCore);
    await f.db.transaction(async tx => { for (const id of [...f.playerIds].sort()) await observeHonorOwner(tx, id, f.clock.now()); });
  };
  it('keeps legacy and shadow classifications private', async () => {
    expect(await preview()).toEqual({ enabled: false });
    await setup('SHADOW'); expect(await preview()).toEqual({ enabled: false });
  });
  it.each([
    [100, 100, 9, 9, 'PEER', 'FULL'], [100, 100, 9, 12, 'UPPER', 'FULL'],
    [100, 20, 9, 6, 'PEER', 'NONE'], [100, 60, 9, 9, 'PEER', 'HALF'],
    [100, 20, 9, 9, 'PEER', 'NONE'], [20, 100, 9, 6, 'PEER', 'FULL'],
  ] as const)('classifies %s/%s hulls and Core %s/%s as %s with %s military return', async (own, enemy, a, d, kind, militaryReturn) => {
    await setup('ACTIVE', own, enemy, a, d);
    expect(await preview()).toMatchObject({ enabled: true, kind, militaryReturn, repeated: false, retaliation: false });
  });
  it('does not change references, disclose military values or treat a foreign target as valid', async () => {
    await setup(); const before = await f.db.select().from(honorObservations);
    expect(JSON.stringify(await preview())).not.toMatch(/navy|tier|playerId|accountId|weight/);
    expect(await f.db.select().from(honorObservations)).toEqual(before);
    await expect(preview(randomUUID())).rejects.toThrow('Honor target');
  });
  it('exposes authenticated coarse guidance through the actual client contract', async () => {
    await setup('ACTIVE', 100, 99, 22, 19);
    const { app, close } = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    try {
      const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
      const url = `/api/honor/targets/${f.planetIds[1]!}`;
      expect((await app.inject({ url })).statusCode).toBe(401);
      const result = await app.inject({ url, headers: { authorization } });
      expect(result.statusCode).toBe(200);
      expect(honorTargetSchema.parse(result.json())).toMatchObject({ enabled: true, eligible: true, kind: 'PEER', militaryReturn: 'FULL', retaliationLootPercent: 40, topTierPeer: true });
    } finally { await close(); }
  });
  it('refuses to invent lost reference history from current inventory', async () => {
    await setup();
    await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[1]!));
    await expect(preview()).rejects.toThrow('Missing Honor reference history');
  });
  it('uses strategic inventory in the launch preview and advertises the solo policy', async () => {
    for (const id of f.planetIds) await giveUnits(f.db, id, { DART: 100 });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type: 'DEATH_STAR', status: 'READY',
      startedAt: f.clock.now(), remainingSeconds: 0 });
    const [config] = await f.db.select().from(honorSeasons);
    await f.db.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: config!.createdAt });
    const before = await f.db.select().from(honorObservations);
    expect(await preview()).toMatchObject({ enabled: true, soloCredit: true, militaryReturn: 'NONE' });
    expect(await f.db.select().from(honorObservations)).toEqual(before);
  });
  it('distinguishes a recent relationship from normal military eligibility', async () => {
    await setup();
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Preview clan', nameKey: 'preview clan',
      tag: 'PC', createdAt: f.clock.now() }).returning();
    await f.db.insert(clanMemberships).values(f.playerIds.map((playerId, slot) => ({ seasonId: f.seasonId,
      clanId: clan!.id, playerId, slot, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() })));
    expect(await preview()).toMatchObject({ enabled: true, eligible: true, kind: 'PEER', related: true });
  });
  it('reads actual pair use and retaliation, and expires only retaliation at the exact 24h boundary', async () => {
    // A grant only matters against a weak target (2026-10-30): two tiers down, 20 % navy.
    await setup('ACTIVE', 100, 20, 9, 3);
    const member = (id: string, loss = 0) => ({ id, tier: 3, navy: 100_000, weight: 10_000,
      civilianWeight: 0, loss, combatLoss: loss, lootLost: 0 });
    await f.db.transaction(tx => settleHonor(tx, f.seasonId, { source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(),
      eligible: true, attack: [member(f.playerIds[1]!)], defence: [member(f.playerIds[0]!, 1000)],
      relations: [{ a: f.playerIds[1]!, b: f.playerIds[0]!, related: false }] }));
    expect(await preview()).toMatchObject({ repeated: true, retaliation: true });
    const grantAt = f.clock.now().getTime();
    f.clock.set(new Date(grantAt + 86_399_999));
    expect(await preview()).toMatchObject({ repeated: true, retaliation: true });
    f.clock.set(new Date(grantAt + 86_400_000));
    expect(await preview()).toMatchObject({ repeated: true, retaliation: false });
  });
  it('rejects a self target and keeps excluded administrator opponents out of the race', async () => {
    await setup();
    await expect(preview(f.planetIds[0])).rejects.toThrow('Invalid Honor target');
    const [admin] = await f.db.select({ username: accounts.username }).from(accounts).where(eq(accounts.id, f.accountIds[1]!));
    expect(await honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, new Set([admin!.username])))
      .toEqual({ enabled: true, eligible: false });
  });
});
