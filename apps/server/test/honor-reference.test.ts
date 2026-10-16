import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { seedWorld, testDb, type Fixture } from './helpers.js';
import { buildings, honorObservations, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner, honorOwnerReference } from '../src/services/honorReference.js';
import { createHonorCatalogue, honorFleetValue } from '@astera/rules';
import { recomputePlayerWealth } from '../src/services/planet.js';

describe('authoritative owned military references', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 7719);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    await f.db.delete(units);
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });
  const observe = (at = f.clock.now()) => f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[0]!, at));

  it('counts home, foreign-world escrow, support, monument and dock once by owner; excludes cargo', async () => {
    await f.db.insert(units).values([
      ...['home', 'flight', 'support:wave', 'monument:wave', 'dock:lot'].map(location => ({
        planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[0]!, location, hull: 'DART' as const, count: 2,
      })),
      { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, location: 'home', hull: 'COURIER', count: 1000 },
      { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[1]!, location: 'home', hull: 'THORN', count: 1000 },
    ]);
    await observe();
    const reference = await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now());
    expect(reference.navy).toBe(honorFleetValue(createHonorCatalogue(), { DART: 10 }, true));
  });

  it('keeps a destroyed fleet in the 24h reference without a permanent season-long penalty', async () => {
    await f.db.insert(units).values({ planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, hull: 'DART', count: 10 });
    await observe(); const lostAt = new Date(f.clock.now().getTime() + 1000);
    await f.db.delete(units); await observe(lostAt);
    expect((await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, new Date(lostAt.getTime() + 86_399_999))).navy).toBeGreaterThan(0);
    expect((await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, new Date(lostAt.getTime() + 86_400_000))).navy).toBe(0);
  });

  it('retains Core peak, ignores future states and suppresses redundant movement observations', async () => {
    await f.db.update(buildings).set({ level: 9 }).where(eq(buildings.type, 'CORE'));
    await observe();
    const beforeMovement = await f.db.select().from(honorObservations);
    await observe();
    expect(await f.db.select().from(honorObservations)).toEqual(beforeMovement);
    expect(beforeMovement.filter(row => row.playerId === f.playerIds[0] && row.coreTier === 3)).toHaveLength(1);
    await f.db.update(buildings).set({ level: 1 }).where(eq(buildings.type, 'CORE'));
    await observe(new Date(f.clock.now().getTime() + 1));
    expect((await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, new Date(f.clock.now().getTime() + 2))).tier).toBe(3);
    await expect(honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, new Date(0))).rejects.toThrow('Missing Honor');
  });

  it('serialises simultaneous observations and rolls back a failed inventory transaction', async () => {
    await Promise.all([observe(), observe()]);
    expect(await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, f.playerIds[0]!))).toHaveLength(1);
    await expect(f.db.transaction(async tx => {
      await tx.insert(units).values({ planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, hull: 'DART', count: 10 });
      await observeHonorOwner(tx, f.playerIds[0]!, new Date(f.clock.now().getTime() + 1));
      throw new Error('abort inventory');
    })).rejects.toThrow('abort inventory');
    expect((await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, new Date(f.clock.now().getTime() + 2))).navy).toBe(0);
  });

  it('inventory refresh journals the authoritative state with explicit time and rejects an unclocked Honor mutation', async () => {
    await f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!, f.clock.now()));
    expect(await f.db.select().from(honorObservations).where(eq(honorObservations.playerId, f.playerIds[0]!))).toHaveLength(1);
    await expect(f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!))).rejects.toThrow('observation time');
  });
});
