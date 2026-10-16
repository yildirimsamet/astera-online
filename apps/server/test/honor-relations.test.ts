import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { botProfiles, clanAidCommitments, clanMemberships, clans, missions, players } from '../src/db/schema.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { readHonorRelations } from '../src/services/honorRelations.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('server-owned Honor eligibility and relationships', () => {
  let f: Fixture;
  const day = 86_400_000;
  const at = (offset = 0) => new Date(f.clock.now().getTime() + offset);
  beforeEach(async () => { f = await seedWorld(2, 7719); });
  afterAll(async () => { await (await testDb()).close(); });
  const read = (time = at(), admins: ReadonlySet<string> = new Set()) => readHonorRelations(f.db, {
    seasonId: f.seasonId, attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: time, adminUsernames: admins,
  });
  const membership = async (intervals: [number, number | null][]) => {
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Honor test', nameKey: 'honor test',
      tag: 'HT', createdAt: at(-30 * day) }).returning();
    for (const [index, [joined, left]] of intervals.entries()) {
      await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: clan!.id, playerId: f.playerIds[index]!,
        slot: index, joinedAt: at(joined), leftAt: left === null ? null : at(left), matureAt: at(joined), aidPolicyChangedAt: at(joined) });
    }
    return clan!.id;
  };

  it('allows unrelated human pairs, rejects missing and foreign-season identities', async () => {
    expect(await read()).toMatchObject({ eligible: true, relations: [{ related: false }] });
    await expect(readHonorRelations(f.db, { seasonId: randomUUID(), attack: [f.playerIds[0]!], defence: [f.playerIds[1]!],
      at: at(), adminUsernames: new Set() })).rejects.toThrow('Honor actor');
  });

  it('blocks recent shared membership in both directions and expires exactly after seven days', async () => {
    await membership([[-20 * day, -day], [-10 * day, -day]]);
    expect((await read()).relations[0]?.related).toBe(true);
    expect((await read(at(6 * day))).relations[0]?.related).toBe(false);
    const reverse = await readHonorRelations(f.db, { seasonId: f.seasonId, attack: [f.playerIds[1]!], defence: [f.playerIds[0]!], at: at(), adminUsernames: new Set() });
    expect(reverse.relations[0]?.related).toBe(true);
  });

  it('does not invent a relationship between non-overlapping members of the same clan', async () => {
    await membership([[-4 * day, -3 * day], [-2 * day, null]]);
    expect((await read()).relations[0]?.related).toBe(false);
  });

  it('counts a clan joined at commitment but ignores future membership', async () => {
    await membership([[0, null], [0, null]]);
    expect((await read()).relations[0]?.related).toBe(true);
    expect((await read(at(-1))).relations[0]?.related).toBe(false);
  });

  it.each([false, true])('uses actual delivery time for aid, including Silent Space history: %s', async waitingHistory => {
    const clanId = await membership([[-30 * day, -20 * day], [-30 * day, -20 * day]]);
    const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, kind: 'transfer', status: 'resolved',
      departAt: at(-10 * day), arriveAt: at(-day), fleet: { COURIER: 1 }, fuelPaid: 1, distance: 100 }).returning();
    await f.db.insert(clanAidCommitments).values({ missionId: mission!.id, seasonId: f.seasonId, clanId,
      senderPlayerId: f.playerIds[0]!, recipientPlayerId: f.playerIds[1]!, senderHomePlanetId: f.planetIds[0]!,
      value: { alloy: 100, crystal: 0, deuterium: 0 }, returnTravelSeconds: 60, status: 'DELIVERED',
      committedAt: at(-10 * day), expiresAt: at(day), resolvedAt: at(-day) });
    if (waitingHistory) {
      const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
      await f.db.update(clanAidCommitments).set({ seasonId: waiting!.id }).where(eq(clanAidCommitments.missionId, mission!.id));
    }
    expect((await read()).relations[0]?.related).toBe(true);
    expect((await read(at(-2 * day))).relations[0]?.related).toBe(false);
    expect((await read(at(6 * day))).relations[0]?.related).toBe(false);
    await f.db.update(clanAidCommitments).set({ status: 'RETURNED' }).where(eq(clanAidCommitments.missionId, mission!.id));
    expect((await read()).relations[0]?.related).toBe(false);
  });

  it('excludes retired bots and configured administrators from competitive sources', async () => {
    const [actor] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    await f.db.insert(botProfiles).values({ accountId: actor!.accountId, ordinal: 1, persona: 'balanced',
      createdAt: at(-day), nextActionAt: at(day), retiredAt: at(-1) });
    expect((await read()).eligible).toBe(false);
    await f.db.delete(botProfiles);
    const { accounts } = await import('../src/db/schema.js');
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, actor!.accountId));
    expect((await read(at(), new Set([account!.username]))).eligible).toBe(false);
  });
});
