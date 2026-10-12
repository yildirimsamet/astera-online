import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { HULLS, missionFuel, monumentFuelReserves } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, notifications, planets, players, seasons } from '../src/db/schema.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { recallMonument, resolveMonumentReturn } from '../src/services/monumentMovement.js';
import { closeSeasonMonuments } from '../src/services/monumentSeasonClose.js';
import { loadLocked, recomputePlayerWealth } from '../src/services/planet.js';
import { quoteMonumentRecall } from '../src/services/monumentView.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(1, 20261012);
  await f.db.update(seasons).set({ rulesetVersion: 17 }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 8);
  await setLevel(f.db, f.planetIds[0]!, 'HANGAR', 10);
  await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
  await giveUnits(f.db, f.planetIds[0]!, { RAMPART: 2, COURIER: 2 });
  const [row] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1,
    x: 6000, y: 0, z: 0, capacity: 100_000, garrison: {}, productionPerMinute: 0, settledAt: f.clock.now() }).returning();
  target = row!;
});
afterAll(async () => { await (await testDb()).close(); });
const input = () => ({ senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, monumentId: target.id,
  fleet: { RAMPART: 2, COURIER: 2 }, purpose: 'ATTACK' as const, acknowledgeShieldLoss: true, clock: f.clock });
async function held() {
  const sent = await f.db.transaction(tx => sendMonument(tx, input()));
  f.clock.set(new Date(sent.wave.arriveAt!.getTime() + 1));
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
  return sent;
}

it('charges actual outbound fuel plus a separately described return reserve', async () => {
  const quote = await f.db.transaction(tx => quoteMonument(tx, input()));
  expect(quote.returnFuelReserve).toBeGreaterThan(0);
  expect(quote.fuel).toBe(quote.outboundFuel! + quote.returnFuelReserve!);
  const sent = await f.db.transaction(tx => sendMonument(tx, input()));
  const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  expect(lots.reduce((sum, lot) => sum + lot.returnFuelReserve, 0)).toBe(sent.quote.returnFuelReserve);
  expect(lots.every(lot => lot.fuelRefund === 0)).toBe(true);
});

it('covers an outbound recall as well as a monument departure for an existing out-of-disc home', async () => {
  await f.db.update(planets).set({ x: 8000, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
  const quote = await f.db.transaction(tx => quoteMonument(tx, input()));
  // Both endpoints of a recall may lie in the existing radius-8000 home sphere.
  expect(quote.returnFuelReserve).toBe(monumentFuelReserves(input().fleet, 16_000).total);
});

it('removes spent return fuel from cached wealth as soon as recall commits', async () => {
  const sent = await f.db.transaction(tx => sendMonument(tx, input()));
  f.clock.advance(1);
  const before = await f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!));
  const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  const quote = await f.db.transaction(tx => quoteMonumentRecall(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId,
    waveId: sent.wave.id, selections: lots.map(lot => ({ lotId: lot.id, count: lot.count })), at: f.clock.now(), adminUsernames: [] }));
  expect(quote.returnFuel).toBeGreaterThan(0);
  await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId: sent.wave.id, all: true, clock: f.clock }));
  const [owner] = await f.db.select({ wealth: players.wealth }).from(players).where(eq(players.id, f.playerIds[0]!));
  expect(owner!.wealth).toBe(before - quote.returnFuel);
});

it('pays only the partial return group on arrival and cannot pay twice on event replay', async () => {
  const sent = await held();
  const [courier] = (await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id))).filter(lot => lot.hull === 'COURIER');
  const quote = await f.db.transaction(tx => quoteMonumentRecall(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId,
    waveId: sent.wave.id, selections: [{ lotId: courier!.id, count: 1 }], at: f.clock.now(), adminUsernames: [] }));
  expect(quote.returnFuel).toBeGreaterThan(0);
  expect(quote.fuelRefund).toBeGreaterThan(0);
  const returned = await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId: sent.wave.id,
    selections: [{ lotId: courier!.id, count: 1 }], clock: f.clock }));
  const [part] = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, returned.wave.id));
  expect(part!.returnFuelReserve).toBe(0);
  expect(part!.fuelRefund).toBeGreaterThan(0);
  const route = returned.wave.route[0]!;
  const span = Math.hypot(route.to.x - route.from.x, route.to.y - route.from.y, route.to.z - route.from.z);
  expect(part!.fuelRefund).toBeCloseTo(courier!.returnFuelReserve / 2 - missionFuel({ COURIER: 1 }, span, 1), 10);
  expect(quote.fuelRefund).toBeCloseTo(part!.fuelRefund, 8);
  f.clock.set(returned.wave.arriveAt!);
  const before = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  const event = { waveId: returned.wave.id, generation: returned.wave.generation, at: f.clock.now() };
  await f.db.transaction(tx => resolveMonumentReturn(tx, event));
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(home!.deuterium - before.deuterium).toBeCloseTo(part!.fuelRefund, 8);
  await f.db.transaction(tx => resolveMonumentReturn(tx, event));
  expect((await f.db.select().from(planets).where(eq(planets.id, home!.id)))[0]!.deuterium).toBe(home!.deuterium);
  const remaining = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  expect(remaining.reduce((sum, lot) => sum + lot.returnFuelReserve, 0)).toBeGreaterThan(0);
});

it('burns the reserve of a ship destroyed in HOLD and refunds none of it', async () => {
  const sent = await held();
  const beforeLots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  const lostFuel = beforeLots.reduce((sum, lot) => sum + lot.returnFuelReserve + lot.fuelRefund, 0);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', intensityHpPerMinute: HULLS.RAMPART.hp * 2, activeFrom: f.clock.now() });
  f.clock.advance(1);
  const before = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
  expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id)))[0]!.status).toBe('LOST');
  expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.deuterium).toBe(before.deuterium);
  const [notice] = (await f.db.select().from(notifications)).filter(row => row.kind === 'radiation_lost');
  expect(notice?.payload).toMatchObject({ lostFuel });
});

it('reports only the owner’s fuel shares burned in combat', async () => {
  await f.db.update(monuments).set({ garrison: { LEVIATHAN: 100 } }).where(eq(monuments.id, target.id));
  const sent = await f.db.transaction(tx => sendMonument(tx, input()));
  const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  const lostFuel = lots.reduce((sum, lot) => sum + lot.returnFuelReserve + lot.fuelRefund, 0);
  f.clock.set(sent.wave.arriveAt!);
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
  const [notice] = (await f.db.select().from(notifications)).filter(row => row.kind === 'raid_result');
  expect(notice?.payload).toMatchObject({ survivors: 0, lostFuel });
});

it('closes escrow on the season’s direct home delivery instead of inventing a return charge', async () => {
  const sent = await held();
  const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  const reserve = lots.reduce((sum, lot) => sum + lot.returnFuelReserve, 0);
  const before = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  await f.db.transaction(tx => closeSeasonMonuments(tx, { seasonId: f.seasonId, cutoff: f.clock.now(), adminUsernames: [] }));
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(home!.deuterium - before.deuterium).toBeCloseTo(reserve, 8);
  const [receipt] = (await f.db.select().from(notifications)).filter(row => row.kind === 'fleet_returned');
  expect(receipt?.payload).toMatchObject({ trip: 'monument', reason: 'FREEZE', fuelRefund: reserve });
});
