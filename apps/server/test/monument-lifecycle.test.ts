import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_CAPACITY } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, scheduledEvents, seasons, type MonumentWaveStatus } from '../src/db/schema.js';
import { busy, commanderRows, demolish } from '../src/services/reclaim.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { wipeAllServers } from '../src/services/servers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let wave: typeof monumentWaves.$inferSelect;
const quiet = { runIds: [], raidIds: [], tradeIds: [], convoyIds: [] };
beforeEach(async () => {
  f = await seedWorld(2, 20_261_003);
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, settledAt: f.clock.now() }).returning())[0]!;
  const id = randomUUID();
  wave = (await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    unitLocation: `monument:${id}`, purpose: 'ATTACK', sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 0,
    sentAt: f.clock.now(), radiationSettledAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000) }).returning())[0]!;
});
afterAll(async () => { await (await testDb()).close(); });
async function status(value: MonumentWaveStatus) {
  await f.db.update(monumentWaves).set({ status: value, heldAt: value === 'HOLD' ? f.clock.now() : null,
    returnReason: value === 'RETURNING' ? 'RECALLED' : null,
    resolvedAt: value === 'HOME' || value === 'LOST' ? f.clock.now() : null }).where(eq(monumentWaves.id, wave.id));
}
const business = (owner = 0) => f.db.transaction((tx) => busy(tx, [f.planetIds[owner]!], f.playerIds[owner]!, quiet));

describe('monument reclaim and placement references', () => {
  it('clears every monument target, historical HP source and wave before a frozen season wipe removes players and worlds', async () => {
    await status('HOLD');
    await f.db.insert(monumentShipLots).values({ waveId: wave.id, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 100, mode: 'EMIT', intensityHpPerMinute: 1, activeFrom: f.clock.now() });
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 2, seedBase: 20_261_004 });
    expect(await f.db.select().from(monuments).where(eq(monuments.seasonId, f.seasonId))).toHaveLength(0);
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
    expect(await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.seasonId, f.seasonId))).toHaveLength(0);
    expect(await f.db.select().from(monuments)).toHaveLength(5);
    expect(await f.db.select().from(hpRadiationSources)).toHaveLength(5);
    expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]?.status).toBe('wiped');
  });

  it('keeps every active flight or HOLD wave out of reclaim and account demolition', async () => {
    for (const value of ['OUTBOUND', 'HOLD', 'RETURNING'] as const) {
      await status(value);
      expect(await business()).toBe(true);
      expect(await business(1)).toBe(false);
    }
    for (const value of ['HOME', 'LOST'] as const) {
      await status(value);
      expect(await business()).toBe(false);
    }
  });

  it('defers Silent Space movement while a HOLD or flight exists and moves only after the wave is terminal', async () => {
    f.clock.advance(48 * 60);
    const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    expect(target).not.toBeNull();
    for (const value of ['OUTBOUND', 'HOLD', 'RETURNING'] as const) {
      await status(value);
      expect((await transferCommander(f.db, wave.playerId, target!.id, f.clock)).status).toBe('FLIGHT');
    }
    await status('HOME');
    expect((await transferCommander(f.db, wave.playerId, target!.id, f.clock)).status).toBe('MOVED');
  });

  it('removes terminal personal wave FKs and native wave events before demolishing an origin', async () => {
    await status('HOME');
    await f.db.insert(monumentShipLots).values({ waveId: wave.id, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'monument_arrival', refId: wave.id,
      payload: { generation: 0 }, resolveAt: wave.arriveAt! });
    await f.db.transaction(async (tx) => {
      await demolish(tx, [wave.originPlanetId], wave.playerId, await commanderRows(tx, [wave.originPlanetId], wave.playerId));
    });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, wave.id))).toHaveLength(0);
    expect(await f.db.select().from(monuments).where(eq(monuments.id, m.id))).toHaveLength(1);
  });

  it('refuses a direct demolition that bypassed the active-wave guard', async () => {
    await expect(f.db.transaction(async (tx) => demolish(tx, [wave.originPlanetId], wave.playerId,
      await commanderRows(tx, [wave.originPlanetId], wave.playerId)))).rejects.toMatchObject({ code: 'MONUMENT_ACTIVE' });
    expect(await f.db.select().from(monumentWaves).where(and(eq(monumentWaves.id, wave.id), eq(monumentWaves.status, 'OUTBOUND')))).toHaveLength(1);
  });
});
