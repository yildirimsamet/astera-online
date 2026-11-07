import { STARTER, fleetSpeed, missionFuel, outpostName, travelExact } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pendingSchema } from '../../web/src/api/schemas.js';
import { vesselMissions, vesselUnits, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, get, pass, placeShip, post, siteOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const WARRIOR = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, RADAR: 1, TELESCOPE: 1 };

describe('a fleet aboard', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const home = async (id: string) => {
    const rows = await world.f.db.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, id), eq(vesselUnits.location, 'HOME')));
    return Object.fromEntries(rows.filter(row => row.count > 0).map(row => [row.hull, row.count]));
  };
  /** A ship that has had its first fight: the Attack door is what a raid on an outpost goes through (§3.7). */
  const fighter = async (name: string) => {
    const person = await aboard(world, name, WARRIOR);
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'] }).where(eq(vessels.id, person.vesselId));
    return person;
  };
  const outpost = async (headers: Record<string, string>) => {
    void headers;
    return siteOf(world, 'OUTPOST');
  };

  it('flies for real: leaves the hangar, arrives when the rule says', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 6 });
    const site = await outpost(me.headers);
    await placeShip(world, me.vesselId, { x: site.x - 300, y: site.y, z: site.z });
    const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
    expect(answer.statusCode).toBe(200);
    const { arriveAt } = answer.json<{ arriveAt: string }>();
    const minutes = (new Date(arriveAt).getTime() - world.f.clock.now().getTime()) / 60_000;
    expect(minutes).toBeCloseTo(travelExact(300, fleetSpeed({ DART: 6 }, {})), 1);
    expect(await home(me.vesselId)).toEqual({});
    expect(pendingSchema.parse(await get(world, '/api/starter/pending', me.headers)).pending[0]).toMatchObject({ kind: 'fleet', recallable: true });
  });

  it('reports a raid on an outpost as an outpost', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 6 });
    const site = await outpost(me.headers);
    await placeShip(world, me.vesselId, { x: site.x - 300, y: site.y, z: site.z });
    await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
    await pass(world, 30);
    const { reports } = await get<{ reports: { opponentKind: string }[] }>(world, '/api/starter/reports', me.headers);
    expect(reports[0]?.opponentKind).toBe('OUTPOST');
  });

  it('names an outpost on the flight strip as the map does', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 6 });
    const site = await outpost(me.headers);
    await placeShip(world, me.vesselId, { x: site.x - 300, y: site.y, z: site.z });
    await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
    const { pending } = pendingSchema.parse(await get(world, '/api/starter/pending', me.headers));
    expect(pending[0]).toMatchObject({ targetName: outpostName(site.id) });
  });

  it('needs ships it has, and at home', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 2 });
    const site = await outpost(me.headers);
    const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 3 } });
    expect(answer.statusCode).toBe(409);
    expect(answer.json<{ error: string }>().error).toBe('NOT_ENOUGH_SHIPS');
  });

  it('flies as many attacks as it has bays', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 4 });
    const site = await outpost(me.headers);
    expect((await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 2 } })).statusCode).toBe(200);
    const second = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 2 } });
    expect(second.statusCode).toBe(409);
    expect(second.json<{ error: string }>().error).toBe('NO_ATTACK_BAY');
  });

  it('answers a repeated key with the same flight', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 2 });
    const site = await outpost(me.headers);
    const headers = { ...me.headers, 'idempotency-key': 'same-key-0001' };
    const first = await post(world, '/api/starter/fleet/launch', headers, { targetPlanetId: site.id, fleet: { DART: 1 } });
    const second = await post(world, '/api/starter/fleet/launch', headers, { targetPlanetId: site.id, fleet: { DART: 1 } });
    expect(second.json<{ missionId: string }>().missionId).toBe(first.json<{ missionId: string }>().missionId);
    const rows = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    expect(rows).toHaveLength(1);
  });

  it('flies free until the fuel plant works, and pays once it does', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 6 });
    const site = await outpost(me.headers);
    await placeShip(world, me.vesselId, { x: site.x - 300, y: site.y, z: site.z });
    await world.f.db.update(vessels).set({ deuterium: 0 }).where(eq(vessels.id, me.vesselId));
    const free = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 1 } });
    expect(free.statusCode).toBe(200);
    await post(world, `/api/starter/fleet/${free.json<{ missionId: string }>().missionId}/recall`, me.headers);
    await pass(world, 30);

    await world.f.db.update(vessels).set({ modules: { ...WARRIOR, DEUTERIUM_PLANT: 1 }, deuterium: 0 }).where(eq(vessels.id, me.vesselId));
    const dry = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
    expect(dry.statusCode).toBe(409);
    expect(dry.json<{ error: string }>().error).toBe('INSUFFICIENT_DEUTERIUM');

    const fuel = missionFuel({ DART: 6 }, 300, 2);
    await world.f.db.update(vessels).set({ deuterium: fuel + 5 }).where(eq(vessels.id, me.vesselId));
    expect((await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } })).statusCode).toBe(200);
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(row!.deuterium).toBeLessThan(6);
  });

  it('gives its fuel gift once: the plant comes with twenty', () => {
    expect(STARTER.deuteriumGrant).toBe(20);
  });

  it('turns back on a recall and lands where it left', async () => {
    const me = await fighter('Me');
    await arm(world, me.vesselId, { DART: 2 });
    const site = await outpost(me.headers);
    await placeShip(world, me.vesselId, { x: site.x - 800, y: site.y, z: site.z });
    const { missionId } = (await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 2 } })).json<{ missionId: string }>();
    world.f.clock.advance(2);
    const recall = await post(world, `/api/starter/fleet/${missionId}/recall`, me.headers);
    expect(recall.statusCode).toBe(200);
    const home_ = new Date(recall.json<{ arriveAt: string }>().arriveAt).getTime();
    expect((home_ - world.f.clock.now().getTime()) / 60_000).toBeCloseTo(2, 1);
    await pass(world, 3);
    expect(await home(me.vesselId)).toEqual({ DART: 2 });
    const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, missionId));
    expect(mission!.status).toBe('DONE');
  });

  it('cannot recall twice, or someone else\'s flight', async () => {
    const me = await fighter('Me');
    const them = await aboard(world, 'Them', WARRIOR);
    await arm(world, me.vesselId, { DART: 2 });
    const site = await outpost(me.headers);
    const { missionId } = (await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 2 } })).json<{ missionId: string }>();
    expect((await post(world, `/api/starter/fleet/${missionId}/recall`, them.headers)).statusCode).toBe(404);
    expect((await post(world, `/api/starter/fleet/${missionId}/recall`, me.headers)).statusCode).toBe(200);
    expect((await post(world, `/api/starter/fleet/${missionId}/recall`, me.headers)).statusCode).toBe(409);
  });

  it('warns a radar in reach exactly when the fleet crosses into it', async () => {
    const me = await aboard(world, 'Me', { ...WARRIOR });
    const them = await aboard(world, 'Them', { ...WARRIOR });
    const facts = ['FIRST_BATTLE_REPORT' as const];
    await world.f.db.update(vessels).set({ facts, pvpOpenAt: world.f.clock.now() }).where(eq(vessels.id, me.vesselId));
    await world.f.db.update(vessels).set({ facts, pvpOpenAt: world.f.clock.now() }).where(eq(vessels.id, them.vesselId));
    await arm(world, me.vesselId, { DART: 2 });
    await arm(world, them.vesselId, { DART: 1 });
    await placeShip(world, me.vesselId, { x: -700 });
    await placeShip(world, them.vesselId, { x: 700 });
    await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: them.vesselId, fleet: { DART: 2 } });
    const told = async () => (await get<{ notifications: { kind: string }[] }>(world, '/api/starter/notifications', them.headers)).notifications.map(n => n.kind);
    // 800 of 1400 at Radar 1 (600): nothing yet at the start.
    expect(await told()).not.toContain('RADAR_WARNING');
    const flight = travelExact(1400, fleetSpeed({ DART: 2 }, {}));
    await pass(world, flight * (800 / 1400) + 0.1);
    expect(await told()).toContain('RADAR_WARNING');
  });
});
