import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselBattleReports, vesselMissions, vesselNotifications, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, get, pass } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('pirates at a ship', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const flights = (id: string) => world.f.db.select().from(vesselMissions).where(eq(vesselMissions.targetVesselId, id));
  const sweep = () => sweepStarterWorld(world.f.db, world.f.clock);
  const seen = (id: string) => world.f.db.update(vessels).set({ lastSeenAt: world.f.clock.now() }).where(eq(vessels.id, id));

  it('send nothing before the radar works', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1 });
    await seen(me.vesselId);
    await sweep();
    expect(await flights(me.vesselId)).toHaveLength(0);
  });

  it('send a scout once the radar works, to a player who is here, and it turns back without a fight', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, RADAR: 1 });
    await seen(me.vesselId);
    await sweep();
    const [scout] = await flights(me.vesselId);
    expect(scout?.kind).toBe('SCOUT');
    await pass(world, 60);
    expect(await world.f.db.select().from(vesselBattleReports)).toHaveLength(0);
    const [after] = await flights(me.vesselId);
    expect(after!.status).toBe('DONE');
  });

  it('name the scout to a telescope, and only a telescope', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, RADAR: 1 });
    await seen(me.vesselId);
    await sweep();
    const [scout] = await flights(me.vesselId);
    interface Pending { pending: { kind: string; raider?: string }[] }
    await world.f.db.update(vesselMissions).set({ fromX: me.position.x + 300, fromY: me.position.y, fromZ: me.position.z }).where(eq(vesselMissions.id, scout!.id));
    const radarOnly = (await get<Pending>(world, '/api/starter/pending', me.headers)).pending.find(thread => thread.kind === 'incoming');
    expect(radarOnly).toBeDefined();
    expect(radarOnly).not.toHaveProperty('raider');
    await world.f.db.update(vesselMissions).set({ fromX: me.position.x + 20, fromY: me.position.y, fromZ: me.position.z }).where(eq(vesselMissions.id, scout!.id));
    const seenThread = (await get<Pending>(world, '/api/starter/pending', me.headers)).pending.find(thread => thread.kind === 'incoming');
    expect(seenThread).toMatchObject({ raider: 'SCOUT' });
  });

  it('send one scout, not one a sweep', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, RADAR: 1 });
    await seen(me.vesselId);
    await sweep();
    await sweep();
    expect(await flights(me.vesselId)).toHaveLength(1);
  });

  it('wait for a player who is away', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, RADAR: 1 });
    await world.f.db.update(vessels).set({ lastSeenAt: new Date(world.f.clock.now().getTime() - 3_600_000) }).where(eq(vessels.id, me.vesselId));
    await sweep();
    expect(await flights(me.vesselId)).toHaveLength(0);
  });

  it('bring the first real raid after the Aegis, as many as the fleet; its report opens Attack and the station', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, RADAR: 1, AEGIS: 1 });
    await arm(world, me.vesselId, { DART: 2 });
    await world.f.db.update(vessels).set({ shield: 75 }).where(eq(vessels.id, me.vesselId));
    await seen(me.vesselId);
    await sweep();
    await pass(world, 60);
    await seen(me.vesselId);
    await sweep();
    const raid = (await flights(me.vesselId)).find(flight => flight.kind === 'PIRATE');
    expect(raid?.fleet).toEqual({ DART: 2 });
    await pass(world, 60);
    const body = await get<{ vessel: { features: string[]; facts: string[] } }>(world, '/api/starter/vessel', me.headers);
    expect(body.vessel.facts).toContain('FIRST_BATTLE_REPORT');
    expect(body.vessel.features).toContain('attack');
  });

  it('names pirates in the report as pirates, not as a commander called PIRATE', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, RADAR: 1, AEGIS: 1 });
    await arm(world, me.vesselId, { DART: 2 });
    await seen(me.vesselId);
    await sweep();
    await pass(world, 60);
    await seen(me.vesselId);
    await sweep();
    await pass(world, 60);
    const { reports } = await get<{ reports: { opponentKind: string; opponentPlanet: string; opponentPlanetId: string | null }[] }>(world, '/api/starter/reports', me.headers);
    expect(reports[0]).toMatchObject({ opponentKind: 'PIRATES', opponentPlanet: '', opponentPlanetId: null });
    const signals = await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, me.vesselId));
    expect(signals.find(signal => signal.kind === 'BATTLE_REPORT')?.payload).toMatchObject({ opponentKind: 'PIRATES' });
  });
});
