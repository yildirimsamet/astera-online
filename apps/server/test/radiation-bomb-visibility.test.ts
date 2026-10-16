import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { sensorSphere, radarRange } from '@astera/rules';
import { planets, players, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb } from '../src/services/radiationBomb.js';
import { pendingThreads } from '../src/services/session.js';
import { loadTrafficSnapshot, projectGalaxyTraffic, type SensorPost } from '../src/services/traffic.js';
import { grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let flightId: string;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  await placeAt(f.db, f.planetIds[0]!, { x: 0 });
  await placeAt(f.db, f.planetIds[1]!, { x: 8000 });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 13); await setLevel(f.db, f.planetIds[1]!, 'CORE', 13); await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 5);
  await grant(f.db, f.planetIds[0]!, 500000, 500000);
  await grant(f.db, f.planetIds[1]!, 500000, 500000);
  await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, f.planetIds[0]!));
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 2, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 2, key: randomUUID(), clock: f.clock });
  flightId = sent.flightId;
  f.clock.set(new Date((new Date(sent.departAt).getTime() + new Date(sent.arriveAt).getTime()) / 2));
});
afterAll(async () => { await (await testDb()).close(); });
it('publishes the owner’s exact outward flight, level and stock, with no recall action', async () => {
  const own = await pendingThreads(f.db, f.planetIds[0]!, f.clock.now());
  const thread = own.find(row => row.id === flightId);
  expect(thread).toMatchObject({ kind: 'radiation_bomb', radiationBombLevel: 2, originPlanetId: f.planetIds[0], targetPlanetId: f.planetIds[1], leg: 'outbound' });
  expect(thread?.path).toBeDefined();
  expect(thread?.recallable).toBeUndefined();
});
it('keeps an unseen bomb absent, gives Radar an anonymous contact and Telescope an identified hull without route metadata', async () => {
  const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
  const contacts = (posts: SensorPost[], owner = f.playerIds[1]!) => projectGalaxyTraffic(snapshot,
    f.planetIds[1]!, f.clock.now(), owner, [f.planetIds[1]!], posts, new Set(), null, new Set());
  expect(contacts([]).some(row => row.id === flightId)).toBe(false);
  const at = { x: 6000, y: 0, z: 0 };
  const radar = { ...sensorSphere(at, 0, 1, f.planetIds[1]), planetId: f.planetIds[1]!, telescope: false,
    warn: 0, revealsSize: false, revealsKind: false };
  const anonymous = contacts([radar]).find(row => row.id === flightId);
  expect(anonymous).toMatchObject({ kind: 'unknown' });
  expect(anonymous).not.toHaveProperty('radiationBombLevel');
  const telescope = { ...radar, ...sensorSphere(at, 1, 0, f.planetIds[1]), telescope: true };
  const identified = contacts([telescope]).find(row => row.id === flightId);
  expect(identified).toMatchObject({ kind: 'radiation_bomb', radiationBombLevel: 2 });
  for (const key of ['originPlanetId', 'targetPlanetId', 'ownerPlayerId', 'arriveAt', 'route']) expect(identified).not.toHaveProperty(key);
  expect(contacts([telescope], f.playerIds[0]).some(row => row.id === flightId)).toBe(false);
});

it('adds a private incoming warning only inside the target Radar circle and never hands the defender the trajectory', async () => {
  const {giveSatellite,giveInstrument}=await import('./helpers.js');
  await giveSatellite(f.db,f.planetIds[1]!,'UPLINK');
  await giveInstrument(f.db,f.planetIds[1]!,'RADAR',1);
  const [flight]=await f.db.select().from((await import('../src/db/schema.js')).radiationBombFlights);
  f.clock.set(new Date(flight!.arriveAt.getTime()-1000));
  const incoming=(await pendingThreads(f.db,f.planetIds[1]!,f.clock.now())).find(row=>row.contactId===flightId);
  expect(incoming).toMatchObject({kind:'incoming',targetPlanetId:f.planetIds[1]});
  expect(incoming).not.toHaveProperty('path'); expect(incoming).not.toHaveProperty('originPlanetId');
  expect(incoming).not.toHaveProperty('radiationBombLevel');
});

it('measures the warning circle from the actual planet centre, not the offset surface collision point', async () => {
  const { giveSatellite, giveInstrument } = await import('./helpers.js');
  const { radiationBombFlights } = await import('../src/db/schema.js');
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 1);
  const [flight] = await f.db.select().from(radiationBombFlights);
  const x = 8000 - radarRange(1) - 1;
  const progress = (x - flight!.originPosition.x) / (flight!.targetPosition.x - flight!.originPosition.x);
  f.clock.set(new Date(flight!.departAt.getTime() + progress * (flight!.arriveAt.getTime() - flight!.departAt.getTime())));
  const incoming = (await pendingThreads(f.db, f.planetIds[1]!, f.clock.now())).find(row => row.contactId === flightId);
  expect(incoming).toBeUndefined();
});

it('keeps the existing Radar L5 origin-name benefit without disclosing a bomb route or attacker identity', async () => {
  const { giveSatellite, giveInstrument } = await import('./helpers.js');
  const { radiationBombFlights } = await import('../src/db/schema.js');
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 5);
  const [flight] = await f.db.select().from(radiationBombFlights);
  const [origin] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  f.clock.set(new Date(flight!.arriveAt.getTime() - 1000));
  const incoming = (await pendingThreads(f.db, f.planetIds[1]!, f.clock.now())).find(row => row.contactId === flightId);
  expect(incoming).toMatchObject({ kind: 'incoming', radiationBombLevel: 2, originName: origin!.name });
  for (const key of ['path', 'originPlanetId', 'ownerPlayerId']) expect(incoming).not.toHaveProperty(key);
});

it('delivers one Radar warning through the real worker while the missile is still airborne', async () => {
  const { giveSatellite, giveInstrument }=await import('./helpers.js');
  const { EventWorker }=await import('../src/worker/loop.js');
  const { pino }=await import('pino');
  const { notifications, radiationBombFlights }=await import('../src/db/schema.js');
  await giveSatellite(f.db,f.planetIds[1]!,'UPLINK');
  await giveInstrument(f.db,f.planetIds[1]!,'RADAR',1);
  const [flight]=await f.db.select().from(radiationBombFlights);
  f.clock.set(new Date(flight!.arriveAt.getTime()-1000));
  const worker=new EventWorker(f.db,f.clock,{pollMs:1,batch:100,staleMinutes:5},pino({level:'silent'}));
  await worker.tick();await worker.tick();
  expect((await f.db.select().from(notifications).where(eq(notifications.refId,flightId))))
    .toMatchObject([{playerId:f.playerIds[1],kind:'incoming_fleet'}]);
});
