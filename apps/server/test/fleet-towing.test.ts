import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { MULTI_WORLD, sensorSphere, type Fleet } from '@astera/rules';
import { pirateRaids, units, unknownSignals, seasons, planets } from '../src/db/schema.js';
import { pendingThreads } from '../src/services/session.js';
import { loadTrafficSnapshot, projectGalaxyTraffic, type SensorPost } from '../src/services/traffic.js';
import { pendingSchema, trafficSchema } from '../../web/src/api/schemas.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2, 4242, { pirates: true }); });
afterAll(async () => { const { close } = await testDb(); await close(); });

const at = { x: 100, y: 0, z: 100 };
const eye = (identified: boolean): SensorPost[] => [{ ...sensorSphere(at, 900, 900),
  identify: identified ? 1e6 : 0, detect: 1e6, planetId: f.planetIds[1]!, telescope: identified,
  warn: 0, revealsSize: true, revealsKind: true }];
const contacts = async (sensors: SensorPost[], owner = f.playerIds[1]!) => projectGalaxyTraffic(
  await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now()), null, f.clock.now(), owner, [], sensors, new Set(), null, new Set());

it('publishes a captured pirate hull on owner and identified observer flights, with no Radar leak', async () => {
  const now = f.clock.now();
  const [raid] = await f.db.insert(pirateRaids).values({seasonId: f.seasonId, planetId: f.planetIds[0]!,
    ownerPlayerId: f.playerIds[0]!, pirateIndex: 0, status: 'returning', fleet: {DART: 3},
    capturedHull: 'TALON', interceptX: at.x, interceptY: at.y, interceptZ: at.z,
    departAt: new Date(+now - 600_000), arriveAt: new Date(+now - 60_000), returnDepartAt: new Date(+now - 30_000),
    homeAt: new Date(+now + 600_000)}).returning();
  await f.db.insert(units).values({planetId: f.planetIds[0]!, hull: 'DART', count: 3, location: `pirate:${raid!.id}`});
  const own = (await pendingThreads(f.db, f.planetIds[0]!, now)).find(t => t.id === raid!.id);
  expect(own).toMatchObject({fleet: {DART: 3, TALON: 1}, towing: {TALON: 1}});
  expect(pendingSchema.parse({pending: own ? [own] : []}).pending[0]).toHaveProperty('towing', {TALON: 1});
  const seen = (await contacts(eye(true))).find(t => t.id === raid!.id);
  expect(seen).toMatchObject({fleet: {DART: 3, TALON: 1}, towing: {TALON: 1}});
  expect(trafficSchema.parse({contacts: seen ? [seen] : []}).contacts[0]).toHaveProperty('towing', {TALON: 1});
  expect((await contacts(eye(false))).find(t => t.id === raid!.id)).not.toHaveProperty('towing');
  expect((await contacts([])).find(t => t.id === raid!.id)).toBeUndefined();
  expect((await contacts(eye(true), f.playerIds[0])).find(t => t.id === raid!.id)).toBeUndefined();
});

it.each(['returning', 'outbound', 'recalled'] as const)('shows physical signal flights (%s) without publishing the private signal outcome', async status => {
  const now = f.clock.now();
  const fleet: Fleet = {DART: 1, COURIER: 1, TALON: 1};
  const [signal] = await f.db.insert(unknownSignals).values({seasonId: f.seasonId, playerId: f.playerIds[0]!,
    seed: 'private-seed', ...at, appearedAt: new Date(+now - 600_000), expiresAt: new Date(+now + 600_000),
    status, originPlanetId: f.planetIds[0]!, origin: {x: 50, y: 0, z: 50}, fleet,
    departAt: new Date(+now - 60_000), arriveAt: new Date(+now + 600_000),
    returnDepartAt: new Date(+now - 30_000), returnAt: new Date(+now + 600_000),
    outcome: status === 'returning' ? {kind: 'DERELICT', hull: 'TALON', damageBp: 5000} : null}).returning();
  const own = (await pendingThreads(f.db, f.planetIds[0]!, now)).find(t => t.id === signal!.id);
  const seen = (await contacts(eye(true))).find(t => t.id === signal!.id);
  expect(seen).toMatchObject({kind: 'fleet', fleet});
  if (status === 'returning') {
    expect(own).toHaveProperty('towing', {TALON: 1});
    expect(seen).toHaveProperty('towing', {TALON: 1});
  } else {
    expect(own).not.toHaveProperty('towing');
    expect(seen).not.toHaveProperty('towing');
  }
  for (const key of ['outcome', 'seed', 'origin', 'originPlanetId', 'playerId', 'path', 'loot', 'returnAt']) expect(seen).not.toHaveProperty(key);
  expect((await contacts(eye(false))).find(t => t.id === signal!.id)).not.toHaveProperty('towing');
  expect((await contacts([])).find(t => t.id === signal!.id)).toBeUndefined();
  expect((await contacts(eye(true), f.playerIds[0])).find(t => t.id === signal!.id)).toBeUndefined();
});

it('shares the live HP signal roster and safe home between owner and observer', async () => {
  await f.db.update(seasons).set({rulesetVersion: MULTI_WORLD.monumentRulesetVersion}).where(eq(seasons.id, f.seasonId));
  const now = f.clock.now();
  const [signal] = await f.db.insert(unknownSignals).values({seasonId: f.seasonId, playerId: f.playerIds[0]!,
    seed: 'hp-roster', ...at, appearedAt: new Date(+now - 600_000), expiresAt: new Date(+now + 600_000),
    status: 'returning', originPlanetId: f.planetIds[1]!, origin: {x: 50, y: 0, z: 50},
    fleet: {DART: 1, COURIER: 1, TALON: 1},
    departAt: new Date(+now - 120_000), arriveAt: new Date(+now - 60_000),
    returnDepartAt: new Date(+now - 30_000), returnAt: new Date(+now + 600_000),
    outcome: {kind: 'DERELICT', hull: 'TALON', damageBp: 5000}}).returning();
  // The original pad changed controller and the prize no longer exists in the physical roster.
  for (const hull of ['DART', 'COURIER'] as const) await f.db.insert(units).values({
    planetId: f.planetIds[1]!, hull, count: 1, location: `unknown-signal:${signal!.id}`});
  const own = (await pendingThreads(f.db, f.planetIds[0]!, now)).find(t => t.id === signal!.id);
  const seen = (await contacts(eye(true))).find(t => t.id === signal!.id);
  expect(own?.fleet).toEqual({DART: 1, COURIER: 1});
  expect(seen?.fleet).toEqual(own?.fleet);
  expect(own).not.toHaveProperty('towing');
  expect(seen).not.toHaveProperty('towing');
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(own?.path?.to).toEqual({x: home!.x, y: home!.y, z: home!.z});
});
