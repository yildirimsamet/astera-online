import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOBILE_HULLS, PROBE, seededFrom, type Fleet } from '@astera/rules';
import { hpRadiationSources, monumentProbes, monumentShipLots, monumentWaves, monuments, notifications, planets, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { launchMonumentProbe, readMonumentProbeReports, resolveMonumentProbe } from '../src/services/monumentProbe.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { hasMonumentActivity, removeTerminalMonumentWaves } from '../src/services/monumentLifecycle.js';
import { closeSeasonMonuments } from '../src/services/monumentSeasonClose.js';
import { reanchorMonumentOrigin } from '../src/services/monumentOwnership.js';
import { onMonumentProbe } from '../src/worker/monumentHandlers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let start: number;
const at = (minutes: number) => new Date(start + minutes * 60_000);
async function probe(survives: boolean) {
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  if (!season) throw new Error('missing season');
  let id = randomUUID();
  while ((seededFrom('monument:probe:v1', season.asteroidKey, id)() >= 0.9) !== survives) id = randomUUID();
  const [row] = await f.db.insert(monumentProbes).values({ id, seasonId: f.seasonId, monumentId: m.id,
    playerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, departAt: at(0), arriveAt: at(1),
    outboundRoute: [{ from: { x: 0, y: 0, z: 0 }, to: { x: m.x, y: m.y, z: m.z }, startMs: start, endMs: at(1).getTime() }] }).returning();
  if (!row) throw new Error('missing probe');
  return row;
}
async function holds(fleet: Fleet) {
  const id = randomUUID();
  await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[0]!, garrison: {} }).where(eq(monuments.id, m.id));
  await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!, purpose: 'REINFORCE', unitLocation: `monument:${id}`, sentFleet: fleet, tech: {},
    fuelPaid: 0, route: [], status: 'HOLD', heldAt: at(0), sentAt: at(0), radiationSettledAt: at(0) });
  for (const hull of MOBILE_HULLS) {
    const count = fleet[hull] ?? 0;
    if (count === 0) continue;
    await f.db.insert(monumentShipLots).values({ waveId: id, hull, count, damageBp: 0, remainderBp: 0, deuterium: 0 });
    await f.db.insert(units).values({ planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, location: `monument:${id}`, hull, count });
  }
}
beforeEach(async () => {
  f = await seedWorld(2, 20_261_009);
  start = f.clock.now().getTime();
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  for (const id of f.planetIds) await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, id));
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: 7270, productionPerMinute: 60, garrison: { DART: 5, ARGOSY: 1 }, garrisonTemplate: { DART: 5, ARGOSY: 1 }, settledAt: at(0) }).returning())[0]!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('a monument probe and its private arrival snapshot', () => {
  it('uses the normal probe price and serializes a same-target cooldown race', async () => {
    const launch = () => f.db.transaction((tx) => launchMonumentProbe(tx, { playerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, monumentId: m.id, clock: f.clock }));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const results = await Promise.allSettled([launch(), launch()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(after?.alloy).toBe(before!.alloy - PROBE.alloy);
    expect(after?.crystal).toBe(before!.crystal - PROBE.crystal);
    expect(await f.db.select().from(monumentProbes)).toHaveLength(1);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_probe'))).toHaveLength(1);
  });

  it('refuses a foreign origin without paying or making a probe', async () => {
    await expect(f.db.transaction((tx) => launchMonumentProbe(tx, { playerId: f.playerIds[1]!, originPlanetId: f.planetIds[0]!, monumentId: m.id, clock: f.clock })))
      .rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    expect(await f.db.select().from(monumentProbes)).toEqual([]);
  });

  it('keeps a lost probe’s exact enemy roster out of storage and out of all intel reads', async () => {
    const row = await probe(false);
    await f.db.transaction((tx) => resolveMonumentProbe(tx, { probeId: row.id, leg: 'OUT', at: at(1), adminUsernames: [] }));
    const [lost] = await f.db.select().from(monumentProbes).where(eq(monumentProbes.id, row.id));
    expect(lost).toMatchObject({ status: 'LOST', snapshotFleet: null, observedAt: null, deliveredAt: null });
    expect(await readMonumentProbeReports(f.db, row.playerId)).toEqual([]);
    expect(await f.db.select().from(notifications).where(and(eq(notifications.refId, row.id), eq(notifications.kind, 'probe_report')))).toEqual([]);
  });

  it('stores exact counts at arrival and exposes them only on one successful return to their observer', async () => {
    const row = await probe(true);
    await f.db.transaction((tx) => resolveMonumentProbe(tx, { probeId: row.id, leg: 'OUT', at: at(1), adminUsernames: [] }));
    const [returning] = await f.db.select().from(monumentProbes).where(eq(monumentProbes.id, row.id));
    expect(returning).toMatchObject({ status: 'RETURNING', snapshotFleet: m.garrison, observedAt: at(1), deliveredAt: null });
    expect(await readMonumentProbeReports(f.db, row.playerId)).toEqual([]);
    if (!returning?.homeAt) throw new Error('missing probe home ETA');
    await f.db.update(monuments).set({ garrison: { CITADEL: 9 } }).where(eq(monuments.id, m.id));
    const deliver = () => f.db.transaction((tx) => resolveMonumentProbe(tx, { probeId: row.id, leg: 'HOME', at: returning.homeAt!, adminUsernames: [] }));
    await Promise.all([deliver(), deliver()]);
    expect(await readMonumentProbeReports(f.db, row.playerId)).toMatchObject([{ fleet: m.garrison, observedAt: at(1).toISOString() }]);
    expect(await readMonumentProbeReports(f.db, f.playerIds[0]!)).toEqual([]);
    const notices = await f.db.select().from(notifications).where(and(eq(notifications.refId, row.id), eq(notifications.kind, 'probe_report')));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ payload: { targetKind: 'MONUMENT', monumentId: m.id,
      monumentOrdinal: m.ordinal, observedAt: row.arriveAt.toISOString(), deliveredAt: returning.homeAt.toISOString() } });
  });

  it('reconciles an earlier probe before a later HOLD read loses the defenders to radiation', async () => {
    await holds({ DART: 5 });
    const row = await probe(true);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 100, intensityHpPerMinute: 10, mode: 'EMIT', activeFrom: at(0) });
    await f.db.transaction((tx) => advanceMonument(tx, { monumentId: m.id, at: at(20) }));
    expect(await f.db.select().from(monumentShipLots)).toEqual([]);
    const [observed] = await f.db.select().from(monumentProbes).where(eq(monumentProbes.id, row.id));
    expect(observed).toMatchObject({ status: 'RETURNING', snapshotFleet: { DART: 5 }, observedAt: at(1) });
  });

  it('does not allow an early or stale event to observe or deliver a fleet', async () => {
    const row = await probe(true);
    await f.db.transaction((tx) => resolveMonumentProbe(tx, { probeId: row.id, leg: 'OUT', at: new Date(at(1).getTime() - 1), adminUsernames: [] }));
    expect((await f.db.select().from(monumentProbes))[0]?.status).toBe('OUTBOUND');
    await f.db.transaction((tx) => resolveMonumentProbe(tx, { probeId: row.id, leg: 'HOME', at: at(20), adminUsernames: [] }));
    expect(await readMonumentProbeReports(f.db, row.playerId)).toEqual([]);
  });

  it('blocks removal while in flight and removes terminal probe/event FKs during cleanup', async () => {
    const row = await probe(false);
    expect(await hasMonumentActivity(f.db, row.playerId, [row.originPlanetId])).toBe(true);
    await expect(f.db.transaction((tx) => removeTerminalMonumentWaves(tx, row.playerId, [row.originPlanetId]))).rejects.toMatchObject({ code: 'MONUMENT_ACTIVE' });
    await f.db.transaction((tx) => resolveMonumentProbe(tx, { probeId: row.id, leg: 'OUT', at: at(1), adminUsernames: [] }));
    await f.db.transaction((tx) => removeTerminalMonumentWaves(tx, row.playerId, [row.originPlanetId]));
    expect(await f.db.select().from(monumentProbes)).toEqual([]);
  });

  it('cuts all monument probe states at season close without inventing a report for a lost or unreached probe', async () => {
    const survivor = await probe(true);
    const lost = await probe(false);
    await f.db.transaction((tx) => closeSeasonMonuments(tx, { seasonId: f.seasonId, cutoff: at(2), adminUsernames: [] }));
    const rows = await f.db.select().from(monumentProbes);
    expect(rows.find((row) => row.id === survivor.id)?.status).toBe('HOME');
    expect(rows.find((row) => row.id === lost.id)?.status).toBe('LOST');
    expect(await readMonumentProbeReports(f.db, survivor.playerId)).toHaveLength(1);
  });

  it('reanchors a probe from a lost colony without changing its paid route or observer', async () => {
    const colonyId = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]! }).where(eq(planets.id, colonyId));
    const row = await probe(true);
    await f.db.update(monumentProbes).set({ originPlanetId: colonyId }).where(eq(monumentProbes.id, row.id));
    await f.db.transaction((tx) => reanchorMonumentOrigin(tx, colonyId));
    const [moved] = await f.db.select().from(monumentProbes).where(eq(monumentProbes.id, row.id));
    expect(moved).toMatchObject({ originPlanetId: f.planetIds[1], playerId: row.playerId, outboundRoute: row.outboundRoute });
  });

  it('makes an old native probe event inert after the season froze', async () => {
    const row = await probe(true);
    await f.db.transaction((tx) => closeSeasonMonuments(tx, { seasonId: f.seasonId, cutoff: at(2), adminUsernames: [] }));
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    const [event] = await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'monument_probe',
      refId: row.id, payload: { leg: 'HOME' }, resolveAt: at(20) }).returning();
    if (!event) throw new Error('missing stale event');
    f.clock.set(at(20));
    await expect(onMonumentProbe({ db: f.db, clock: f.clock }, event)).resolves.toBeUndefined();
    expect(await readMonumentProbeReports(f.db, row.playerId)).toHaveLength(1);
  });
});
