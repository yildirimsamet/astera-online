import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { MONUMENT_SEASON_DEFAULTS, RADIATION_BOMB, RADIATION_BOMB_VISUAL, toWorld, worldRadius, travelExact, distance } from '@astera/rules';
import { buildings, hpRadiationSources, monuments, notifications, planets, players, radiationBombFlights,
  seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { baysInUse } from '../src/services/flight.js';
import { recomputePlayerWealth } from '../src/services/planet.js';
import { grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
});
afterAll(async () => { await (await testDb()).close(); });
const target = () => ({ kind: 'PLANET' as const, id: f.planetIds[1]! });
const launch = (key = randomUUID(), level: 1 | 2 | 3 = 1) => launchRadiationBomb(f.db, {
  playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, target: target(), level,
  key, acknowledgeShieldLoss: true, clock: f.clock,
});
async function ready(level: 1 | 2 | 3 = 1) {
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, level, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  return built.assetId;
}

it.each(['HIT', 'INEFFECTIVE'] as const)('refreshes spent bomb inventory value once after %s', async outcome => {
  await ready();
  const sent = await launch();
  const value = await f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!, f.clock.now()));
  if (outcome === 'INEFFECTIVE') await f.db.update(players).set({
    newcomerShieldUntil: new Date(new Date(sent.arriveAt).getTime() + 60000),
  }).where(eq(players.id, f.playerIds[1]!));
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]!.wealth).toBe(value - 52000);
});

it.each([1, 2, 3] as const)('freezes L%i flight endpoints outside both bodies so the warhead hits the surface at the unchanged arrival time', async level => {
  await placeAt(f.db, f.planetIds[1]!, { x: 5000 });
  await ready(level);
  const result = await launch(randomUUID(), level);
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId));
  const [from] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const [to] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
  const cores = await f.db.select().from(buildings).where(eq(buildings.type, 'CORE'));
  const radius = (id: string) => worldRadius(cores.find(row => row.planetId === id)!.level);
  const centre = (p: { x: number; y: number; z: number }) => new Float64Array(toWorld(p));
  const separation = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    Math.hypot(...centre(a).map((n, i) => n - centre(b)[i]!));
  // The normalized hull is one unit long; its centre must stop half a hull outside the surface.
  const length = RADIATION_BOMB_VISUAL[level].length;
  expect(separation(flight!.targetPosition, to!)).toBeCloseTo(radius(to!.id) + length / 2, 8);
  expect(separation(flight!.originPosition, from!)).toBeCloseTo(radius(from!.id) + length / 2, 8);
  expect(new Date(result.arriveAt).getTime()).toBe(Math.ceil(f.clock.now().getTime() + travelExact(distance(from!, to!), RADIATION_BOMB.speed) * 60000));
  // Later building changes cannot move the already-published trajectory.
  await setLevel(f.db, f.planetIds[1]!, 'CORE', 13);
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId)))[0]!.targetPosition).toEqual(flight!.targetPosition);
});

it('launches one physical bomb, holds a flight bay and stock slot, and replays a retry without another flight', async () => {
  const assetId = await ready();
  const key = randomUUID();
  const beforeBays = await baysInUse(f.db, f.planetIds[0]!);
  const first = await launch(key);
  expect(await launch(key)).toEqual(first);
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(1);
  expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(beforeBays + 1);
  const [asset] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, assetId));
  expect(asset).toMatchObject({ status: 'LAUNCHED', missionId: null });
  await expect(ready()).rejects.toMatchObject({ code: 'RADIATION_BOMB_EXISTS' });
  expect(new Date(first.arriveAt).getTime()).toBeGreaterThan(f.clock.now().getTime());
});

it('refuses own and protected planets before consuming the weapon or spending the attacker shield', async () => {
  const assetId = await ready();
  await expect(launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: f.planetIds[0]! }, level: 1, key: randomUUID(), clock: f.clock }))
    .rejects.toMatchObject({ code: 'SELF_ATTACK' });
  const until = new Date(f.clock.now().getTime() + 3600000);
  await f.db.update(players).set({ newcomerShieldUntil: until });
  await expect(launch()).rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
  const [attacker] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(attacker!.newcomerShieldUntil).toEqual(until);
  await f.db.update(players).set({ newcomerShieldUntil: null });
  await f.db.update(planets).set({ protectedUntil: until }).where(eq(planets.id, f.planetIds[1]!));
  await expect(launch()).rejects.toMatchObject({ code: 'OCCUPATION_PROTECTED' });
  const [asset] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, assetId));
  expect(asset!.status).toBe('READY');
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(0);
});

it('allows an Aegis-charged target and creates precisely one half-hour source and one recipient notice', async () => {
  await ready(3);
  await f.db.update(planets).set({ shield: 500 }).where(eq(planets.id, f.planetIds[1]!));
  const result = await launch(randomUUID(), 3);
  f.clock.set(new Date(result.arriveAt));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  const sources = await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.bombFlightId, result.flightId));
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({ origin: 'BOMB', anchorKind: 'PLANET', anchorId: f.planetIds[1], radiationLevel: 3, intensityHpPerMinute: 18 });
  expect(sources[0]!.activeUntil!.getTime() - sources[0]!.activeFrom.getTime()).toBe(1800000);
  expect(sources[0]!.activeFrom).toEqual(new Date(result.arriveAt));
  const notices = await f.db.select().from(notifications).where(eq(notifications.refId, result.flightId));
  expect(notices.filter(notice => notice.playerId === f.playerIds[1] && notice.kind === 'radiation_bomb_result')).toHaveLength(1);
  const [planet] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
  expect(planet!.empUntil).toBeNull();
  expect(planet!.empHits).toBe(0);
  expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(0);
  expect((await ready(3))).toBeTruthy();
});

it.each(['NEWCOMER', 'RECOVERY', 'OCCUPATION'] as const)('consumes the flight without radiation when %s protection starts while airborne', async protection => {
  const assetId = await ready();
  const result = await launch();
  const until = new Date(new Date(result.arriveAt).getTime() + 3600000);
  if (protection === 'OCCUPATION') await f.db.update(planets).set({ protectedUntil: until }).where(eq(planets.id, f.planetIds[1]!));
  else await f.db.update(players).set(protection === 'NEWCOMER' ? { newcomerShieldUntil: until } : { recoveryShieldUntil: until })
    .where(eq(players.id, f.playerIds[1]!));
  f.clock.set(new Date(result.arriveAt));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  expect(await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.bombFlightId, result.flightId))).toHaveLength(0);
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId));
  expect(flight!.status).toBe('INEFFECTIVE');
  const notices = await f.db.select().from(notifications).where(eq(notifications.refId, result.flightId));
  expect(notices).toHaveLength(2);
  expect(notices.every(notice => notice.kind === 'radiation_bomb_result' && notice.payload.outcome === 'INEFFECTIVE')).toBe(true);
  const [asset] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, assetId));
  expect(asset!.status).toBe('CONSUMED');
});

it('hits a target that became the attacker’s world while airborne, unless its current protection prevents impact', async () => {
  await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, f.planetIds[1]!));
  await ready();
  const result = await launch();
  await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, protectedUntil: null }).where(eq(planets.id, f.planetIds[1]!));
  f.clock.set(new Date(result.arriveAt));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  expect(await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.bombFlightId, result.flightId))).toHaveLength(1);
});

it('preserves the scheduled impact window when the worker processes arrival late', async () => {
  await ready();
  const result = await launch();
  f.clock.set(new Date(new Date(result.arriveAt).getTime() + 2 * 3600000));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  const [source] = await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.bombFlightId, result.flightId));
  expect(source!.activeFrom.toISOString()).toBe(result.arriveAt);
  expect(source!.activeUntil!.getTime()).toBe(new Date(result.arriveAt).getTime() + 1800000);
});

it('flies to a real moving monument without creating a fake planet mission and ignores planetary battery coverage there', async () => {
  await ready(2);
  const [monument] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1,
    ...MONUMENT_SEASON_DEFAULTS.positions[0]!, capacity: 100000, productionPerMinute: 3,
    garrison: { DART: 5 }, garrisonTemplate: { DART: 5 }, settledAt: f.clock.now() }).returning();
  const result = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'MONUMENT', id: monument!.id }, level: 2, key: randomUUID(), acknowledgeShieldLoss: true, clock: f.clock });
  f.clock.set(new Date(result.arriveAt));
  await resolveRadiationBomb(f.db, result.flightId, f.clock);
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, result.flightId));
  expect(flight).toMatchObject({ targetKind: 'MONUMENT', targetPlanetId: null, targetMonumentId: monument!.id, status: 'HIT' });
  const [source] = await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.bombFlightId, result.flightId));
  expect(source).toMatchObject({ anchorKind: 'MONUMENT', anchorId: monument!.id, intensityHpPerMinute: 12.5 });
});
