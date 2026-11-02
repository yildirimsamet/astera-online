import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { missions, planets } from '../src/db/schema.js';
import { collectWorks } from '../src/services/build.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchAttack } from '../src/services/mission.js';
import { launchTransfer } from '../src/services/movement.js';
import { giveUnits, grant, seedWorld, setLevel, testDb } from './helpers.js';

/**
 * A WAVE AT ONE WORLD, WHILE ITS OWNER MOVES. Scaling plan F1.9, tests 1 and 2.
 *
 * Every launch locks season, worlds, Honor actors in one order, so they queue on the
 * target and none deadlocks. The owner's own commands take the same locks in the same
 * order. Honor is on, as it is in production, since its observation is where a real
 * deadlock was found.
 */
afterAll(async () => { await (await testDb()).close(); });

const ATTACKERS = 20;

it('launches every attacker and lets the owner act, with no deadlock', async () => {
  const f = await seedWorld(ATTACKERS + 2);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  const target = f.planetIds[0]!;
  const owner = f.playerIds[0]!;
  const colony = f.planetIds[1]!;
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: owner }).where(eq(planets.id, colony));
  const origins = f.planetIds.slice(2);
  for (const id of [target, ...origins]) {
    await grant(f.db, id, 200_000, 20_000);
    await setLevel(f.db, id, 'CORE', 3);
  }
  await giveUnits(f.db, target, { COURIER: 4 });
  for (const id of origins) await giveUnits(f.db, id, { DART: 4 });
  f.clock.advance(600);

  const results = await Promise.allSettled([
    ...origins.map(origin => launchAttack(f.db, origin, target, { DART: 4 }, f.clock)),
    launchTransfer(f.db, owner, target, colony, { COURIER: 1 }, { alloy: 10, crystal: 0, deuterium: 0 }, f.clock),
    collectWorks(f.db, target, f.clock),
  ]);

  const failures = results.flatMap(result => result.status === 'rejected' ? [String(result.reason)] : []);
  expect(failures).toEqual([]);
  const launched = await f.db.select({ id: missions.id }).from(missions)
    .where(and(eq(missions.targetPlanetId, target), eq(missions.kind, 'attack')));
  expect(launched).toHaveLength(ATTACKERS);
}, 60_000);
