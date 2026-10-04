import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_CAPACITY, MULTI_WORLD } from '@astera/rules';
import { monuments, monumentShipLots, monumentWaves, planets, seasons, units } from '../src/db/schema.js';
import { baysInUse } from '../src/services/flight.js';
import { secedeColony } from '../src/services/loyalty.js';
import { recallMonument } from '../src/services/monumentMovement.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let wave: typeof monumentWaves.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(4, 20_261_003);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(eq(planets.id, f.planetIds[3]!));
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 0, controllerPlayerId: f.playerIds[0]!, settledAt: f.clock.now() }).returning())[0]!;
  const id = randomUUID();
  wave = (await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id, playerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[3]!, unitLocation: `monument:${id}`, purpose: 'REINFORCE', sentFleet: { DART: 1, COURIER: 1 },
    tech: {}, route: [], fuelPaid: 18, status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now() }).returning())[0]!;
  await f.db.insert(monumentShipLots).values([
    { waveId: id, hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25, deuterium: 0 },
    { waveId: id, hull: 'COURIER', count: 1, damageBp: 2000, remainderBp: 0.5, deuterium: 200.125 },
  ]);
  await f.db.insert(units).values([
    { planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, location: wave.unitLocation, hull: 'DART', count: 1 },
    { planetId: wave.originPlanetId, ownerPlayerId: wave.playerId, location: wave.unitLocation, hull: 'COURIER', count: 1 },
  ]);
});
afterAll(async () => { await (await testDb()).close(); });
const stored = () => f.db.select().from(monumentWaves).where(eq(monumentWaves.id, wave.id)).then((rows) => rows[0]!);
const capture = () => f.db.transaction((tx) => transferPlanetControl(tx, { targetPlanetId: wave.originPlanetId,
  newPlayerId: f.playerIds[1]!, expectedControllerPlayerId: wave.playerId, protectedUntil: f.clock.now(), now: f.clock.now() }));

describe('monument origin ownership', () => {
  it('moves a terminal root with its active recall fragment so origin cleanup cannot cascade away the fragment', async () => {
    const root = randomUUID();
    await f.db.insert(monumentWaves).values({ id: root, seasonId: f.seasonId, monumentId: m.id, playerId: wave.playerId,
      originPlanetId: wave.originPlanetId, unitLocation: `monument:${root}`, purpose: 'REINFORCE', sentFleet: {}, tech: {},
      route: [], fuelPaid: 0, status: 'LOST', sentAt: f.clock.now(), resolvedAt: f.clock.now(), radiationSettledAt: f.clock.now() });
    await f.db.update(monumentWaves).set({ rootWaveId: root }).where(eq(monumentWaves.id, wave.id));
    await capture();
    expect((await f.db.select().from(monumentWaves)).every((row) => row.originPlanetId === f.planetIds[0])).toBe(true);
    expect(await stored()).toMatchObject({ rootWaveId: root, status: 'HOLD' });
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(1);
  });

  it.each(['OUTBOUND', 'HOLD', 'RETURNING'] as const)('keeps %s ships, cargo and their bay personal when the origin colony changes hands', async (status) => {
    if (status !== 'HOLD') await f.db.update(monumentWaves).set({ status, arriveAt: new Date(f.clock.now().getTime() + 60_000),
      returnReason: status === 'RETURNING' ? 'RECALLED' : null }).where(eq(monumentWaves.id, wave.id));
    const cargo = await f.db.select().from(monumentShipLots);
    await capture();
    expect(await stored()).toMatchObject({ originPlanetId: f.planetIds[0], playerId: wave.playerId, status, fuelPaid: 18, generation: 0 });
    expect(await f.db.select().from(monumentShipLots)).toEqual(cargo);
    const parked = await f.db.select().from(units).where(eq(units.location, wave.unitLocation));
    expect(parked.every((row) => row.planetId === f.planetIds[0] && row.ownerPlayerId === wave.playerId)).toBe(true);
    expect(parked.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    expect(await baysInUse(f.db, wave.originPlanetId)).toBe(0);
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(1);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(wave.playerId);
  });

  it('moves the anchor to the capital on secession without healing, recalling or repricing the load', async () => {
    const cargo = await f.db.select().from(monumentShipLots);
    await f.db.transaction((tx) => secedeColony(tx, wave.originPlanetId, f.clock.now(), randomUUID()));
    expect(await stored()).toMatchObject({ originPlanetId: f.planetIds[0], status: 'HOLD' });
    expect(await f.db.select().from(monumentShipLots)).toEqual(cargo);
    expect((await f.db.select().from(units).where(eq(units.location, wave.unitLocation))).every((row) => row.planetId === f.planetIds[0])).toBe(true);
  });

  it('lets secession and a physical recall race without deadlock, duplicate load or lost ships', async () => {
    const selections = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
    const results = await Promise.allSettled([
      f.db.transaction((tx) => secedeColony(tx, wave.originPlanetId, f.clock.now(), randomUUID())),
      f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections, clock: f.clock })),
    ]);
    for (const row of results) if (row.status === 'rejected') expect(row.reason).toMatchObject({ code: 'PLACEMENT_CHANGED' });
    if (results[0].status === 'rejected') await f.db.transaction((tx) => secedeColony(tx, wave.originPlanetId, f.clock.now(), randomUUID()));
    if (results[1].status === 'rejected') {
      const fresh = (await f.db.select().from(monumentShipLots)).map((lot) => ({ lotId: lot.id, count: lot.count }));
      await f.db.transaction((tx) => recallMonument(tx, { playerId: wave.playerId, waveId: wave.id, selections: fresh, clock: f.clock }));
    }
    expect(await stored()).toMatchObject({ originPlanetId: f.planetIds[0], status: 'RETURNING' });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
    expect((await f.db.select().from(monumentShipLots)).reduce((sum, row) => sum + row.deuterium, 0)).toBe(200.125);
    expect((await f.db.select().from(units).where(eq(units.location, wave.unitLocation))).reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it('rolls the anchor and physical units back when the expected colony controller is stale', async () => {
    await expect(f.db.transaction((tx) => transferPlanetControl(tx, { targetPlanetId: wave.originPlanetId,
      newPlayerId: f.playerIds[1]!, expectedControllerPlayerId: f.playerIds[2]!, protectedUntil: f.clock.now(), now: f.clock.now() })))
      .rejects.toMatchObject({ code: 'TARGET_CHANGED' });
    expect((await stored()).originPlanetId).toBe(wave.originPlanetId);
    expect((await f.db.select().from(units).where(eq(units.location, wave.unitLocation))).every((row) => row.planetId === wave.originPlanetId)).toBe(true);
  });
});
