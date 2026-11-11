import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { battleReplayResponseSchema } from '../../web/src/api/battleReplaySchemas.js';
import { notificationsSchema } from '../../web/src/api/schemas.js';
import { vesselBattleReports, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, get, pass, placeShip, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const READY = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, RADAR: 1, TELESCOPE: 1, HANGAR: 3 };

describe('what a battle leaves behind', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const fought = async (attackers = 6, defenders = 2) => {
    const me = await aboard(world, 'Raider', READY);
    const them = await aboard(world, 'Target', READY);
    const past = new Date(world.f.clock.now().getTime() - 3_600_000);
    for (const id of [me.vesselId, them.vesselId]) await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: past }).where(eq(vessels.id, id));
    await arm(world, me.vesselId, { DART: attackers });
    await arm(world, them.vesselId, { DART: defenders });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, them.vesselId, { x: 300 });
    await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: them.vesselId, fleet: { DART: attackers } });
    await pass(world, 5);
    return { me, them };
  };

  it('tells both sides, once each', async () => {
    const { me, them } = await fought();
    for (const person of [me, them]) {
      const { notifications } = notificationsSchema.parse(await get(world, '/api/starter/notifications', person.headers));
      expect(notifications.filter(n => n.kind === 'BATTLE_REPORT')).toHaveLength(1);
    }
  });

  it('opens a replay in the schema the player reads', async () => {
    const { me } = await fought();
    const [report] = await world.f.db.select().from(vesselBattleReports);
    const body = await get(world, `/api/starter/reports/BATTLE/${report!.id}/replay`, me.headers);
    expect(battleReplayResponseSchema.safeParse(body).success).toBe(true);
  });

  it.each([[1, 4, false], [2, 4, true]] as const)('gates starter reports and replays together (%s vs %s)', async (a, d, visible) => {
    const { me, them } = await fought(a, d);
    const [stored] = await world.f.db.select().from(vesselBattleReports);
    expect(stored).toBeDefined();
    for (const [reader, attacking] of [[me, true], [them, false]] as const) {
      const response = await get<{ reports: { theirFleet: object; enemyFleetVisibility?: string; rounds: object[] }[] }>(world, '/api/starter/reports', reader.headers);
      expect(response.reports[0]).toMatchObject({ theirFleet: !attacking ? { DART: a } : visible ? { DART: d } : {},
        enemyFleetVisibility: !attacking || visible ? 'FULL' : 'INSUFFICIENT_FORCE' });
      for (const round of response.reports[0]!.rounds) {
        expect(round).not.toHaveProperty('retreats');
        expect(round).not.toHaveProperty('casualties');
        expect(round).not.toHaveProperty('explosions');
      }
      const replay = await world.app.inject({ url: `/api/starter/reports/BATTLE/${stored!.id}/replay`, headers: reader.headers });
      expect(replay.statusCode).toBe(!attacking || visible ? 200 : 403);
    }
  });

  it('keeps historical uncertainty separate from force denial, including the defender replay', async () => {
    const { me, them } = await fought();
    const [stored] = await world.f.db.select().from(vesselBattleReports);
    if (!stored) throw new Error('missing battle');
    const { attackerVisible: _permission, ...result } = stored.result;
    await world.f.db.update(vesselBattleReports).set({ result }).where(eq(vesselBattleReports.id, stored.id));
    const attack = await get<{ reports: { enemyFleetVisibility?: string; theirFleet: object }[] }>(world, '/api/starter/reports', me.headers);
    expect(attack.reports[0]).toMatchObject({ enemyFleetVisibility: 'UNKNOWN', theirFleet: {} });
    const response = await world.app.inject({ url: `/api/starter/reports/BATTLE/${stored.id}/replay`, headers: me.headers });
    expect(response.statusCode).toBe(404);
    const defence = await get<{ reports: { replayStatus?: string }[] }>(world, '/api/starter/reports', them.headers);
    expect(defence.reports[0]).toMatchObject({ replayStatus: 'AVAILABLE' });
    expect((await world.app.inject({ url: `/api/starter/reports/BATTLE/${stored.id}/replay`, headers: them.headers })).statusCode).toBe(200);
  });

  it('opens Attack for a defender who never pressed anything', async () => {
    const me = await aboard(world, 'Raider', READY);
    const them = await aboard(world, 'Target', READY);
    const past = new Date(world.f.clock.now().getTime() - 3_600_000);
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: past }).where(eq(vessels.id, me.vesselId));
    await world.f.db.update(vessels).set({ pvpOpenAt: past }).where(eq(vessels.id, them.vesselId));
    await arm(world, me.vesselId, { DART: 6 });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, them.vesselId, { x: 300 });
    await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: them.vesselId, fleet: { DART: 6 } });
    await pass(world, 5);
    const body = await get<{ vessel: { features: string[] } }>(world, '/api/starter/vessel', them.headers);
    expect(body.vessel.features).toContain('attack');
  });
});
