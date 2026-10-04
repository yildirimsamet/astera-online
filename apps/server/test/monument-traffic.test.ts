import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, type Fleet } from '@astera/rules';
import { hpRadiationSources, monuments, monumentProbes, monumentShipLots, monumentWaves, seasons, units } from '../src/db/schema.js';
import { loadTrafficSnapshot, projectGalaxyTraffic, type SensorPost } from '../src/services/traffic.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
const at = (minute: number) => new Date(f.clock.now().getTime() + minute * 60_000);
const point = (x: number) => ({ x, y: 0, z: 0 });
const post = (identify: number, radar = false): SensorPost => ({ at: point(2900), identify, detect: 100_000,
  telescope: identify > 0, warn: 100_000, planetId: f.planetIds[1]!, revealsSize: radar, revealsKind: radar });
async function wave(fleet: Fleet = { DART: 2, CITADEL: 1 }, status: 'OUTBOUND' | 'RETURNING' | 'HOLD' = 'OUTBOUND') {
  const id = randomUUID();
  await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target.id,
    playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, unitLocation: `monument:${id}`, purpose: 'ATTACK',
    sentFleet: fleet, tech: {}, sentAt: at(0), radiationSettledAt: at(0), fuelPaid: 0, status,
    returnReason: status === 'RETURNING' ? 'RECALLED' : null,
    heldAt: status === 'HOLD' ? at(0) : null, arriveAt: status === 'HOLD' ? null : at(10),
    route: status === 'HOLD' ? [] : [{ from: point(status === 'RETURNING' ? 6000 : 0),
      to: point(status === 'RETURNING' ? 0 : 6000), startMs: at(0).getTime(), endMs: at(10).getTime() }] });
  for (const hull of ['DART', 'CITADEL'] as const) if (fleet[hull]) {
    await f.db.insert(monumentShipLots).values({ waveId: id, hull, count: fleet[hull], damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(units).values({ planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, location: `monument:${id}`, hull, count: fleet[hull] });
  }
  return id;
}
async function read(now: Date, sensors: readonly SensorPost[], playerId = f.playerIds[1]!, owned = [f.planetIds[1]!]) {
  const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, now);
  return projectGalaxyTraffic(snapshot, owned[0] ?? null, now, playerId, owned, sensors, new Set(), null, new Set());
}
beforeEach(async () => {
  f = await seedWorld(2, 20_261_014);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  target = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: 7270, productionPerMinute: 10, settledAt: at(0) }).returning())[0]!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('native monument flights through the existing public sensor fog', () => {
  it('shows no contact outside sensors and only an anonymous bearing inside Radar', async () => {
    const id = await wave();
    expect(await read(at(5), [])).toEqual([]);
    const contacts = await read(at(5), [post(0)]);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ id, kind: 'unknown', from: point(3000) });
    expect(Object.keys(contacts[0]!).sort()).toEqual(['endAt', 'from', 'id', 'kind', 'startAt', 'to']);
    expect(contacts[0]!.to.x).toBeLessThan(6000);
    expect(await read(at(5), [post(0, true)])).toMatchObject([{ silhouette: 'fleet', mass: expect.any(String) as string }]);
  });
  it('identifies the actual airborne roster with Telescope without disclosing HOLD, wounds, cargo or route endpoints', async () => {
    const id = await wave();
    await wave({ CITADEL: 7 }, 'HOLD');
    const contacts = await read(at(5), [post(100_000)]);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ id, kind: 'fleet', fleet: { DART: 2, CITADEL: 1 } });
    for (const forbidden of ['route', 'monumentId', 'playerId', 'originPlanetId', 'tech', 'damage', 'deuterium', 'engagement']) {
      expect(contacts[0]).not.toHaveProperty(forbidden);
    }
    expect(await read(at(5), [post(100_000)], f.playerIds[0], [])).toEqual([]);
  });
  it('uses the real return route and discards a whole dead wing even when the worker is late', async () => {
    const id = await wave({ DART: 2, CITADEL: 1 }, 'RETURNING');
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE', x: 3000, y: 0, z: 0,
      radius: 100_000, intensityHpPerMinute: HULLS.DART.hp, mode: 'EMIT', activeFrom: at(0) });
    const partial = await read(at(2), [post(100_000)]);
    expect(partial).toHaveLength(1);
    expect(partial[0]).toMatchObject({ id, kind: 'fleet', fleet: { CITADEL: 1 }, from: point(4800) });
    expect(partial[0]!.to.x).toBeLessThan(4800);
    await f.db.update(hpRadiationSources).set({ intensityHpPerMinute: HULLS.CITADEL.hp });
    expect(await read(at(2), [post(100_000)])).toEqual([]);
  });
  it('shows a native probe as an earned probe bearing and never publishes its observation', async () => {
    const [probe] = await f.db.insert(monumentProbes).values({ seasonId: f.seasonId, monumentId: target.id,
      playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, departAt: at(0), arriveAt: at(10),
      outboundRoute: [{ from: point(0), to: point(6000), startMs: at(0).getTime(), endMs: at(10).getTime() }] }).returning();
    expect(await read(at(5), [post(0)])).toMatchObject([{ id: probe!.id, kind: 'unknown' }]);
    const contacts = await read(at(5), [post(100_000)]);
    expect(contacts).toMatchObject([{ id: probe!.id, kind: 'probe' }]);
    expect(contacts[0]).not.toHaveProperty('fleet');
    expect(contacts[0]).not.toHaveProperty('snapshotFleet');
    expect(await read(at(10), [post(100_000)])).toEqual([]);
  });
});
