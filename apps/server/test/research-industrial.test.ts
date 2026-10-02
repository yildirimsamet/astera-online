import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, RESEARCH_PROJECTS } from '@astera/rules';
import { researchOrders, seasons } from '../src/db/schema.js';
import { loadLocked } from '../src/services/planet.js';
import { abandonResearchOrder, completeResearch } from '../src/services/research.js';
import { researchView } from '../src/services/researchState.js';
import { giveResearch, grant, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * INDUSTRIAL ON THE SERVER. Owner decision K6, 2026-09-29 (`plan.md` F5).
 *
 * It asks for a RUNG of its prerequisite — Shipyard Automation 2 — where every project
 * before it asked only for the project. It is a ruleset-14 project: a season dealt
 * before persistent damage has no Repair Station to make cheaper, so it has no Industrial.
 */

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('Industrial research', () => {
  let f: Fixture;
  let mine: string;

  const ruleset = (version: number) =>
    f.db.update(seasons).set({ rulesetVersion: version }).where(eq(seasons.id, f.seasonId));

  const view = () => f.db.transaction(async (tx) => researchView(tx, await loadLocked(tx, mine, f.clock)));

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    await ruleset(MULTI_WORLD.shipDamageRulesetVersion);
    await levelWorld(f.db, f.planetIds);
    await setLevel(f.db, mine, 'CORE', 10);
    await grant(f.db, mine, 400_000, 200_000);
  });

  it('waits for Shipyard Automation 2, not merely for the project', async () => {
    await giveResearch(f.db, mine, 'YARD_AUTOMATION', 1);
    expect((await view()).find((row) => row.id === 'INDUSTRIAL')).toMatchObject({
      prerequisite: 'YARD_AUTOMATION', prerequisiteMet: false, available: false,
    });
    await expect(completeResearch(f.db, mine, 'INDUSTRIAL', f.clock))
      .rejects.toMatchObject({ code: 'RESEARCH_UNAVAILABLE' });

    await giveResearch(f.db, mine, 'YARD_AUTOMATION', 2);
    expect((await view()).find((row) => row.id === 'INDUSTRIAL')).toMatchObject({
      prerequisiteMet: true, available: true, cost: RESEARCH_PROJECTS.INDUSTRIAL.costAt(1),
    });
    await completeResearch(f.db, mine, 'INDUSTRIAL', f.clock);
    const [order] = await f.db.select().from(researchOrders).where(eq(researchOrders.projectId, 'INDUSTRIAL'));
    expect(order).toMatchObject({ level: 1, status: 'BUILDING' });
  });

  it('can queue behind the second rung that opens it, and falls with it', async () => {
    await giveResearch(f.db, mine, 'YARD_AUTOMATION', 1);
    await completeResearch(f.db, mine, 'YARD_AUTOMATION', f.clock);
    await completeResearch(f.db, mine, 'INDUSTRIAL', f.clock);

    const [yard] = await f.db.select().from(researchOrders).where(eq(researchOrders.projectId, 'YARD_AUTOMATION'));
    expect(yard?.level).toBe(2);
    expect(await abandonResearchOrder(f.db, yard!.id, f.clock)).toBe(true);
    const [industrial] = await f.db.select().from(researchOrders)
      .where(and(eq(researchOrders.projectId, 'INDUSTRIAL'), eq(researchOrders.playerId, f.playerIds[0]!)));
    expect(industrial?.status).not.toBe('BUILDING');
  });

  it('does not fall with a third rung it never needed', async () => {
    await giveResearch(f.db, mine, 'YARD_AUTOMATION', 2);
    await completeResearch(f.db, mine, 'YARD_AUTOMATION', f.clock);
    await completeResearch(f.db, mine, 'INDUSTRIAL', f.clock);

    const [yard] = await f.db.select().from(researchOrders).where(eq(researchOrders.projectId, 'YARD_AUTOMATION'));
    expect(yard?.level).toBe(3);
    expect(await abandonResearchOrder(f.db, yard!.id, f.clock)).toBe(true);
    const [industrial] = await f.db.select().from(researchOrders).where(eq(researchOrders.projectId, 'INDUSTRIAL'));
    expect(industrial?.status).toBe('BUILDING');
  });

  it('does not exist in a season dealt before the Repair Station', async () => {
    await ruleset(13);
    await giveResearch(f.db, mine, 'YARD_AUTOMATION', 2);
    expect((await view()).some((row) => row.id === 'INDUSTRIAL')).toBe(false);
    await expect(completeResearch(f.db, mine, 'INDUSTRIAL', f.clock))
      .rejects.toMatchObject({ code: 'NO_SUCH_RESEARCH' });
  });
});
