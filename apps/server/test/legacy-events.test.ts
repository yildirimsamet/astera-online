import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { RESEARCH_MAX_LEVEL, RESEARCH_PROJECT_IDS } from '@astera/rules';
import { accounts, buildOrders, legacyActivityDays, legacyAttackIntents, legacyAwards, legacyFacts, planets, playerResearch, researchOrders } from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { applyResearchCompletion } from '../src/services/research.js';
import { Presence } from '../src/services/presence.js';
import { setSupporterStatus } from '../src/services/supporters.js';
import { launchAttack } from '../src/services/mission.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2, 7311); });
afterAll(async () => { await (await testDb()).close(); });

describe('legacy evidence from authoritative game actions', () => {
  it('freezes the higher-tier target when a real raid launches without crediting an unfought attack', async () => {
    f.clock.advance(2 * 24 * 60);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 5);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 1 });
    await f.db.update(planets).set({ deuterium: 1000 }).where(eq(planets.id, f.planetIds[0]!));
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 1 }, f.clock);
    const intents = await f.db.select().from(legacyAttackIntents);
    expect(intents).toMatchObject([{ accountId: f.accountIds[0], sourceKey: `world:${launch.missionId}`,
      attackerTier: 1, defenderTier: 2, settledAt: null }]);
    expect(await f.db.select().from(legacyFacts).where(eq(legacyFacts.metric, 'HIGHER_TIER_ATTACKS'))).toHaveLength(0);
  });
  it('counts a real order once per day, excludes a failed order and never treats polling or offline completion as activity', async () => {
    const presence = new Presence(f.db, f.clock);
    await presence.touch(f.accountIds[0]!);
    expect(await f.db.select().from(legacyActivityDays)).toHaveLength(0);
    await buildUnits(f.db, f.planetIds[0]!, 'DART', 1, f.clock);
    await buildUnits(f.db, f.planetIds[0]!, 'DART', 1, f.clock);
    const [head] = await f.db.select().from(buildOrders).where(eq(buildOrders.slot, 0));
    f.clock.advance(2 * 24 * 60);
    await expect(buildUnits(f.db, f.planetIds[0]!, 'DART', 0, f.clock)).rejects.toThrow();
    await presence.touch(f.accountIds[0]!);
    await f.db.transaction(tx => applyBuildCompletion(tx, head!.id, head!.readyAt.toISOString(), f.clock));
    const days = await f.db.select().from(legacyActivityDays).where(eq(legacyActivityDays.accountId, f.accountIds[0]!));
    expect(days.map(row => row.day)).toEqual([0]);
  });

  it('recognises all research at maximum only when the final real completion commits, once', async () => {
    f.clock.advance(12 * 24 * 60);
    const project = RESEARCH_PROJECT_IDS[0];
    await f.db.insert(playerResearch).values(RESEARCH_PROJECT_IDS.filter(id => id !== project).map(projectId => ({
      playerId: f.playerIds[0]!, projectId, level: RESEARCH_MAX_LEVEL[projectId], completedAt: f.clock.now(),
    })));
    const readyAt = new Date(f.clock.now().getTime() + 1000);
    const [order] = await f.db.insert(researchOrders).values({ playerId: f.playerIds[0]!, fundingPlanetId: f.planetIds[0]!,
      slot: 0, projectId: project, level: RESEARCH_MAX_LEVEL[project], startedAt: f.clock.now(), readyAt,
      remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } }).returning();
    expect(await f.db.select().from(legacyAwards).where(eq(legacyAwards.definitionId, 'science-horizon'))).toHaveLength(0);
    f.clock.set(readyAt);
    const complete = () => f.db.transaction(tx => applyResearchCompletion(tx, order!.id, readyAt.toISOString(), f.clock));
    await complete();
    await complete();
    expect(await f.db.select().from(legacyFacts).where(eq(legacyFacts.metric, 'RESEARCH_MASTERED'))).toHaveLength(1);
    expect(await f.db.select().from(legacyAwards).where(and(eq(legacyAwards.definitionId, 'science-horizon'),
      eq(legacyAwards.accountId, f.accountIds[0]!)))).toHaveLength(1);
  });

  it('uses the existing supporter right, including its reversal, without treating it as a skin purchase', async () => {
    f.clock.advance(12 * 24 * 60);
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));
    await setSupporterStatus(f.db, f.clock, f.accountIds[1]!, account!.username, true);
    const rights = () => f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, f.accountIds[0]!));
    expect((await rights()).find(row => row.definitionId === 'astera-supporter')?.revokedAt).toBeNull();
    expect((await rights()).find(row => row.definitionId === 'show-off')).toBeUndefined();
    await setSupporterStatus(f.db, f.clock, f.accountIds[1]!, account!.username, false);
    expect((await rights()).find(row => row.definitionId === 'astera-supporter')?.revocationReason).toBe('INELIGIBLE');
  });
});
