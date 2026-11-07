import { afterAll, expect, it, vi } from 'vitest';
import { countStatements } from '../src/db/client.js';
import { collectWorks, upgradeBuilding } from '../src/services/build.js';
import * as planning from '../src/services/returnPlanning.js';
import { seedWorld, testDb } from './helpers.js';
afterAll(async () => { await (await testDb()).close(); });
it.each(['collect', 'build'] as const)('adds zero planner statements to an ineligible %s command', async kind => {
  const measure = async () => {
    const f = await seedWorld(1); f.clock.advance(2);
    const planetId = f.planetIds[0]!;
    const scope = { statements: 0 };
    await countStatements(scope, () => kind === 'collect' ? collectWorks(f.db, planetId, f.clock) : upgradeBuilding(f.db, planetId, 'CORE', f.clock));
    return scope.statements;
  };
  const actual = await measure();
  const planner = vi.spyOn(planning, 'planPlanetReturn').mockResolvedValue(undefined);
  try { expect(actual).toBe(await measure()); } finally { planner.mockRestore(); }
});
