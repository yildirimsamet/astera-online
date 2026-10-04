import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HULLS, MONUMENT_CAPACITY, MULTI_WORLD } from '@astera/rules';
import { hpRadiationSources, monumentBattles, monumentBattleParticipants, monuments, monumentShipLots, monumentWaves, planets, players, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { settleMonument } from '../src/services/monument.js';
import { recallMonument } from '../src/services/monumentMovement.js';
import { HANDLERS, onSeasonEnd } from '../src/worker/handlers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let wave: typeof monumentWaves.$inferSelect;
let start: number;
const at = (minutes: number) => new Date(start + minutes * 60_000);
async function cloud(intensity: number) {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
    x: m.x, y: m.y, z: m.z, radius: 20_000, mode: 'EMIT', intensityHpPerMinute: intensity, activeFrom: at(0) });
}
const settle = (minutes: number) => { f.clock.set(at(minutes)); return f.db.transaction((tx) => settleMonument(tx, { monumentId: m.id, clock: f.clock })); };
async function event(kind: 'monument_arrival' | 'monument_loss' | 'monument_respawn') {
  const [row] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, kind));
  expect(row).toBeDefined();
  const handler = HANDLERS[kind];
  expect(handler).toBeTypeOf('function');
  return { row: row!, handler: handler! };
}
beforeEach(async () => {
  f = await seedWorld(2, 20_261_003);
  start = f.clock.now().getTime();
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion }).where(eq(seasons.id, f.seasonId));
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, controllerPlayerId: f.playerIds[0]!, settledAt: at(0),
    garrisonTemplate: { CITADEL: 2 }, garrisonTech: { SHIP_ARMOR: 3 } }).returning())[0]!;
  const id = randomUUID();
  wave = (await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    unitLocation: `monument:${id}`, purpose: 'REINFORCE', status: 'HOLD', sentFleet: { DART: 1, COURIER: 1 }, tech: {},
    route: [], fuelPaid: 0, sentAt: at(0), heldAt: at(0), radiationSettledAt: at(0) }).returning())[0]!;
  await f.db.insert(monumentShipLots).values([
    { waveId: id, hull: 'DART', count: 1, damageBp: 0, remainderBp: 0, deuterium: 0 },
    { waveId: id, hull: 'COURIER', count: 1, damageBp: 0, remainderBp: 0, deuterium: 100 },
  ]);
  await f.db.insert(units).values([
    { planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, location: wave.unitLocation, hull: 'DART', count: 1 },
    { planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, location: wave.unitLocation, hull: 'COURIER', count: 1 },
  ]);
});
afterAll(async () => { await (await testDb()).close(); });

describe('native monument boundary events and durable scoring audit', () => {
  it('registers all native arrival, loss and respawn handlers', () => {
    for (const kind of ['monument_arrival', 'monument_loss', 'monument_respawn'] as const) expect(HANDLERS[kind]).toBeTypeOf('function');
  });

  it('schedules the first individual HOLD death, handles an outage and starts respawn from the real final death', async () => {
    await cloud(Math.max(HULLS.DART.hp, HULLS.COURIER.hp) * 2);
    await settle(0);
    const first = await event('monument_loss');
    expect(first.row.resolveAt.getTime()).toBeGreaterThan(start);
    expect(first.row.resolveAt.getTime()).toBeLessThan(at(1).getTime());
    f.clock.set(at(2));
    await first.handler({ db: f.db, clock: f.clock }, first.row);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('LOST');
    const [empty] = await f.db.select().from(monuments);
    expect(empty?.emptySince).toBeDefined();
    expect(empty!.emptySince!.getTime()).toBeLessThan(at(2).getTime());
    const respawn = await event('monument_respawn');
    expect(respawn.row.resolveAt.getTime()).toBe(empty!.emptySince!.getTime() + 86_400_000);
    const snapshot = await f.db.select().from(monuments);
    await first.handler({ db: f.db, clock: f.clock }, first.row);
    expect(await f.db.select().from(monuments)).toEqual(snapshot);
  });

  it('restores the configured healthy neutral fleet exactly at 24 hours, without changing owned ships or replaying', async () => {
    const selections = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
    await f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections, clock: f.clock }));
    const respawn = await event('monument_respawn');
    f.clock.set(new Date(respawn.row.resolveAt.getTime() - 1));
    await respawn.handler({ db: f.db, clock: f.clock }, respawn.row);
    expect((await f.db.select().from(monuments))[0]?.garrison).toEqual({});
    const ships = await f.db.select().from(units).where(eq(units.location, wave.unitLocation));
    f.clock.set(respawn.row.resolveAt);
    await respawn.handler({ db: f.db, clock: f.clock }, respawn.row);
    expect((await f.db.select().from(monuments))[0]).toMatchObject({ garrison: { CITADEL: 2 }, garrisonDamage: [], emptySince: null, controllerPlayerId: null });
    expect(await f.db.select().from(units).where(eq(units.location, wave.unitLocation))).toEqual(ships);
    const snapshot = await f.db.select().from(monuments);
    await respawn.handler({ db: f.db, clock: f.clock }, respawn.row);
    expect(await f.db.select().from(monuments)).toEqual(snapshot);
  });

  it('never lets an old respawn event override a monument that has been held again', async () => {
    const selections = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
    await f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections, clock: f.clock }));
    const respawn = await event('monument_respawn');
    await f.db.update(monumentWaves).set({ status: 'HOLD', heldAt: at(0) }).where(eq(monumentWaves.id, wave.id));
    await f.db.update(monuments).set({ controllerPlayerId: wave.playerId, emptySince: null, generation: 2 }).where(eq(monuments.id, m.id));
    f.clock.set(respawn.row.resolveAt);
    await respawn.handler({ db: f.db, clock: f.clock }, respawn.row);
    expect((await f.db.select().from(monuments))[0]).toMatchObject({ controllerPlayerId: wave.playerId, garrison: {}, generation: 2 });
  });

  it('schedules a flying ship’s first death and releases a wholly lost return bay without waiting for ETA', async () => {
    await cloud(200);
    const selections = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
    const recalled = await f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections, clock: f.clock }));
    const events = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_loss'));
    const loss = events.find((row) => row.refId === recalled.wave.id)!;
    expect(loss).toBeDefined();
    expect(loss.resolveAt.getTime()).toBeLessThan(recalled.wave.arriveAt!.getTime());
    f.clock.set(at(1));
    const handler = HANDLERS.monument_loss!;
    await handler({ db: f.db, clock: f.clock }, loss);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('LOST');
    expect(await f.db.select().from(monumentShipLots)).toHaveLength(0);
  });

  it('delivers a returning fleet through its native handler without duplicated load', async () => {
    const selections = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
    await f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections, clock: f.clock }));
    const arrival = await event('monument_arrival');
    f.clock.set(arrival.row.resolveAt);
    await arrival.handler({ db: f.db, clock: f.clock }, arrival.row);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('HOME');
    const [before] = await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId));
    await arrival.handler({ db: f.db, clock: f.clock }, arrival.row);
    expect((await f.db.select().from(planets).where(eq(planets.id, wave.originPlanetId)))[0]?.deuterium).toBe(before!.deuterium);
  });

  it('does not schedule losses or respawns beyond the actual season cutoff', async () => {
    await cloud(0.00001);
    await settle(0);
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_loss'))).toHaveLength(0);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(new Date(season!.endsAt.getTime() - 1));
    const selections = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
    await f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections, clock: f.clock }));
    expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'monument_respawn'))).toHaveLength(0);
  });

  it('rejects malformed native event payloads without settling or leaking ships', async () => {
    const [fake] = await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'monument_arrival', refId: wave.id,
      payload: { generation: -1 }, resolveAt: at(0) }).returning();
    const handler = HANDLERS.monument_arrival!;
    await expect(handler({ db: f.db, clock: f.clock }, fake!)).rejects.toThrow();
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('HOLD');
  });

  it('freezes personal Dominion from immutable monument shares after their source target is gone', async () => {
    // No live wave remains: this test isolates the journal query from the closing fleet adapter.
    await f.db.delete(monuments).where(eq(monuments.id, m.id));
    await f.db.delete(units).where(eq(units.location, wave.unitLocation));
    const [battle] = await f.db.insert(monumentBattles).values({ seasonId: f.seasonId, monumentId: m.id, triggerWaveId: wave.id,
      monumentOrdinal: m.ordinal, monumentPosition: { x: m.x, y: m.y, z: m.z },
      attackerFleet: { DART: 1 }, defenderFleet: { COURIER: 1 }, attackerSurvivors: { DART: 1 }, defenderSurvivors: {},
      grade: 'DECISIVE', rounds: [], control: 'ATTACKER', lootDeuterium: 0,
      lootValue: 0, attackerLossValue: 0, defenderLossValue: 100, rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
      eligible: true, rawExchange: 100, transfer: 100, createdAt: at(0) }).returning();
    for (const [owner, side, delta] of [[0, 'ATTACK', 100], [1, 'DEFENCE', -100]] as const) {
      await f.db.insert(monumentBattleParticipants).values({ battleId: battle!.id, seasonId: f.seasonId, playerId: f.playerIds[owner]!,
        side, waveIds: [wave.id], fleet: {}, survivors: {}, losses: {}, damage: [], lootDeuterium: 0, dominionDelta: delta, createdAt: at(0) });
      await f.db.update(players).set(delta > 0 ? { dominionTaken: delta } : { dominionLost: -delta }).where(eq(players.id, f.playerIds[owner]!));
    }
    const [end] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_end')));
    f.clock.set(end!.resolveAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, end!);
    expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]?.status).toBe('frozen');
  });
});
