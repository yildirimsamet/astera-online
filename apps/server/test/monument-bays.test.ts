import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_CAPACITY } from '@astera/rules';
import { monuments, monumentWaves } from '../src/db/schema.js';
import { baysInUse } from '../src/services/flight.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let monumentId: string;
async function wave(rootWaveId: string | null = null, status: 'HOLD' | 'RETURNING' | 'HOME' | 'LOST' = 'HOLD') {
  const id = randomUUID();
  await f.db.insert(monumentWaves).values({
    id, seasonId: f.seasonId, monumentId, playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    rootWaveId, unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 0,
    status, sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now(),
    arriveAt: status === 'RETURNING' ? new Date(f.clock.now().getTime() + 60_000) : null,
    returnReason: status === 'RETURNING' ? 'RECALLED' : null,
    resolvedAt: status === 'HOME' || status === 'LOST' ? f.clock.now() : null,
  });
  return id;
}
beforeEach(async () => {
  f = await seedWorld(1, 20_261_003);
  const [m] = await f.db.insert(monuments).values({
    seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0, capacity: MONUMENT_CAPACITY,
    productionPerMinute: 0, settledAt: f.clock.now(),
  }).returning();
  monumentId = m!.id;
});
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('monument launch bay identity', () => {
  it('holds one ordinary bay throughout HOLD and all partial return fragments', async () => {
    const root = await wave();
    await wave(root, 'RETURNING');
    await wave(root, 'RETURNING');
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(1);
    await wave();
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(2);
  });
  it('keeps the bay while any fragment is away even when the root is HOME or LOST', async () => {
    const root = await wave(null, 'LOST');
    const child = await wave(root, 'RETURNING');
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(1);
    await f.db.update(monumentWaves).set({ status: 'HOME', resolvedAt: f.clock.now() }).where(eq(monumentWaves.id, child));
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(0);
  });
  it('does not count a completed root or another origin’s launches', async () => {
    await wave(null, 'HOME');
    await wave(null, 'LOST');
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(0);
    expect(await baysInUse(f.db, randomUUID())).toBe(0);
  });
});
