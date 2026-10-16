import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createHonorCatalogue, honorFleetValue } from '@astera/rules';
import { buildings, planets, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner, honorOwnerReference } from '../src/services/honorReference.js';
import { lockWorlds, transferPlanetControl } from '../src/services/ownership.js';
import { secedeColony } from '../src/services/loyalty.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('Honor references follow ownership transitions', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(3, 7719);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    await f.db.delete(units);
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]! }).where(eq(planets.id, f.planetIds[2]!));
    await f.db.update(buildings).set({ level: 12 }).where(and(eq(buildings.planetId, f.planetIds[2]!), eq(buildings.type, 'CORE')));
    await f.db.insert(units).values([
      { planetId: f.planetIds[2]!, ownerPlayerId: f.playerIds[1]!, hull: 'DART', count: 10, location: 'home' },
      { planetId: f.planetIds[2]!, ownerPlayerId: f.playerIds[1]!, hull: 'THORN', count: 10, location: 'home' },
      { planetId: f.planetIds[2]!, ownerPlayerId: f.playerIds[1]!, hull: 'DART', count: 5, location: randomUUID() },
    ]);
    await f.db.transaction(async tx => {
      for (const id of f.playerIds.slice(0, 2).sort()) await observeHonorOwner(tx, id, f.clock.now());
    });
    f.clock.advance(1);
  });
  afterAll(async () => { await (await testDb()).close(); });
  const referenceAfterWindow = (owner: number) => honorOwnerReference(f.db, f.seasonId, f.playerIds[owner]!,
    new Date(f.clock.now().getTime() + 86_400_000));

  it('capture updates both owners, retains old Core peak and keeps the old owner’s airborne fleet', async () => {
    await f.db.transaction(async tx => {
      await lockWorlds(tx, f.planetIds);
      await transferPlanetControl(tx, { targetPlanetId: f.planetIds[2]!, newPlayerId: f.playerIds[0]!,
        expectedControllerPlayerId: f.playerIds[1]!, now: f.clock.now(), protectedUntil: f.clock.now() });
    });
    const catalogue = createHonorCatalogue();
    expect(await referenceAfterWindow(0)).toEqual({ tier: 4, navy: honorFleetValue(catalogue, { DART: 10, THORN: 10 }, true) });
    expect(await referenceAfterWindow(1)).toEqual({ tier: 4, navy: honorFleetValue(catalogue, { DART: 5 }, true) });
  });

  it('secession removes the ground navy but does not count returning mobile ships as new production', async () => {
    await f.db.transaction(async tx => {
      await lockWorlds(tx, f.planetIds);
      expect(await secedeColony(tx, f.planetIds[2]!, f.clock.now(), randomUUID())).toBe(true);
    });
    expect(await referenceAfterWindow(1)).toEqual({ tier: 4, navy: honorFleetValue(createHonorCatalogue(), { DART: 15 }, true) });
  });
});
