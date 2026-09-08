import { setTimeout as delay } from 'node:timers/promises';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { planets, players, seasons } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { lockWorlds } from '../src/services/ownership.js';
import { withPlanetLock } from '../src/services/planet.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it.each(['planet', 'worlds'])('%s mutation rejects a placement changed while waiting for the source season lock', async (kind) => {
  const f = await seedWorld(1);
  const target = await createSeason(f.db, {
    shardCode: 'WAIT-LOCK', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1,
  });
  const planetId = f.planetIds[0]!;
  let action: Promise<unknown> | undefined;
  await f.db.transaction(async (tx) => {
    await tx.select().from(seasons).where(eq(seasons.id, f.seasonId)).for('update');
    const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    action = kind === 'planet'
      ? withPlanetLock(f.db, planetId, f.clock, async () => Promise.resolve('WRONG_PLACEMENT'))
      : f.db.transaction(async (waiting) => {
        await lockWorlds(waiting, [planetId]);
        return 'WRONG_PLACEMENT';
      });
    // Observe a real PostgreSQL waiter; elapsed time alone cannot establish the race.
    let blocked = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const [row] = await tx.execute<{ waiting: boolean }>(sql`
        select exists (select 1 from pg_stat_activity
          where ${holder!.pid} = any(pg_blocking_pids(pid))) as waiting
      `);
      if (row?.waiting) { blocked = true; break; }
      await delay(5);
    }
    expect(blocked).toBe(true);
    await tx.update(planets).set({ seasonId: target.season.id }).where(eq(planets.id, planetId));
    await tx.update(players).set({ seasonId: target.season.id, placementVersion: 1 })
      .where(eq(players.id, f.playerIds[0]!));
  });
  await expect(action).rejects.toMatchObject({ code: 'PLACEMENT_CHANGED' });
});
