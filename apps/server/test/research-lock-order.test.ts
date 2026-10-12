import { setTimeout as delay } from 'node:timers/promises';
import { RESEARCH_PROJECTS, seededFrom } from '@astera/rules';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { missions, planets, probeReports, researchOrders } from '../src/db/schema.js';
import { launchProbe, resolveProbe } from '../src/services/intel.js';
import { recomputePlayerWealth } from '../src/services/planet.js';
import { planetView } from '../src/services/planetView.js';
import { abandonResearchOrder, completeResearch } from '../src/services/research.js';
import { grant, seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each(['enqueue', 'refund'] as const)(
  'allows a planet-first probe settlement while research %s waits for its world',
  async kind => {
    const f = await seedWorld(2);
    const mine = f.planetIds[0]!;
    f.clock.advance(RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes);
    await grant(f.db, mine, 30_000, 10_000);
    const probe = await launchProbe(f.db, mine, f.planetIds[1]!, f.clock);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, probe.missionId));
    if (!mission) throw new Error('probe launch created no mission');
    let orderId = '';
    if (kind === 'refund') {
      await completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock);
      orderId = (await f.db.select().from(researchOrders))[0]!.id;
    }

    // Observe an actual PostgreSQL waiter, then run the same report INSERT that
    // deadlocked in production. A timeout makes the failure deterministic without
    // depending on which participant PostgreSQL chooses as its deadlock victim.
    const pending: Promise<PromiseSettledResult<unknown>>[] = [];
    const settle = (action: Promise<unknown>): void => {
      pending.push(action.then(
        value => ({ status: 'fulfilled', value }),
        (reason: unknown) => ({ status: 'rejected', reason }),
      ));
    };
    let settlementError: unknown;
    try {
      await f.db.transaction(async tx => {
        await tx.execute(sql`set local lock_timeout = '500ms'`);
        for (const id of [...f.planetIds].sort()) {
          await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, id)).for('update');
        }
        const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        settle(kind === 'enqueue'
          ? completeResearch(f.db, mine, 'ISOTOPE_SPECTROMETRY', f.clock)
          : abandonResearchOrder(f.db, orderId, f.clock));
        let blocked = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          const [row] = await tx.execute<{ waiting: boolean }>(sql`
            select exists (select 1 from pg_stat_activity
              where ${holder!.pid} = any(pg_blocking_pids(pid))) as waiting
          `);
          if (row?.waiting) { blocked = true; break; }
          await delay(5);
        }
        expect(blocked, 'research did not reach the world lock').toBe(true);
        settle(f.db.transaction(read => planetView(read, mine, f.clock)));
        await resolveProbe(tx, mission, f.clock.now(), seededFrom(mission.id));
        // Other planet-first settlements update this row too. Merely weakening
        // research's row lock to NO KEY UPDATE would still block them.
        await recomputePlayerWealth(tx, mission.ownerPlayerId);
      });
    } catch (error) {
      settlementError = error;
    }
    const outcomes = await Promise.all(pending);
    expect(settlementError).toBeUndefined();
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every(outcome => outcome.status === 'fulfilled')).toBe(true);
    expect(await f.db.select().from(probeReports)).toHaveLength(1);
    const orders = await f.db.select().from(researchOrders);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.status).toBe(kind === 'enqueue' ? 'BUILDING' : 'FAILED');
  },
);
