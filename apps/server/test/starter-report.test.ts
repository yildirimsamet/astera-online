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

  const fought = async () => {
    const me = await aboard(world, 'Raider', READY);
    const them = await aboard(world, 'Target', READY);
    const past = new Date(world.f.clock.now().getTime() - 3_600_000);
    for (const id of [me.vesselId, them.vesselId]) await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: past }).where(eq(vessels.id, id));
    await arm(world, me.vesselId, { DART: 6 });
    await arm(world, them.vesselId, { DART: 2 });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, them.vesselId, { x: 300 });
    await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: them.vesselId, fleet: { DART: 6 } });
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
