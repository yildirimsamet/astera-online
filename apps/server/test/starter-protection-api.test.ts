import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselBotState, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, pass, placeShip, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const READY = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, RADAR: 1, TELESCOPE: 1, HANGAR: 3 };

describe('who may be attacked', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const pair = async () => {
    const me = await aboard(world, 'Raider', READY);
    const them = await aboard(world, 'Target', READY);
    const past = new Date(world.f.clock.now().getTime() - 3_600_000);
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: past }).where(eq(vessels.id, me.vesselId));
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: past }).where(eq(vessels.id, them.vesselId));
    await arm(world, me.vesselId, { DART: 12 });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, them.vesselId, { x: 300 });
    return { me, them };
  };
  const attack = (headers: Record<string, string>, id: string, extra: object = {}) =>
    post(world, '/api/starter/fleet/launch', headers, { targetPlanetId: id, fleet: { DART: 2 }, ...extra });
  const code = (answer: { json: () => { error: string } }) => answer.json().error;

  it('keeps Attack shut until the first battle report', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ facts: [] }).where(eq(vessels.id, me.vesselId));
    expect(code(await attack(me.headers, them.vesselId))).toBe('FEATURE_LOCKED');
  });

  /**
   * OWNER 2026-11-08 (N2): an outpost victory opens the report, not ship hunting. Asked straight at the
   * API, a victor with no shield of its own is refused, and a person and a server-run ship answer the
   * same: nothing in the refusal tells them apart.
   */
  it('refuses an outpost victor with no shield, the same for a person and for a server-run ship', async () => {
    const { me, them } = await pair();
    const crew = await aboard(world, 'Crewed', READY);
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: new Date(world.f.clock.now().getTime() - 3_600_000) }).where(eq(vessels.id, crew.vesselId));
    await placeShip(world, crew.vesselId, { x: -300 });
    const now = world.f.clock.now();
    await world.f.db.insert(vesselBotState).values({ vesselId: crew.vesselId, persona: 'steady', nextActionAt: now, sessionUntilAt: now, createdAt: now });
    await world.f.db.update(vessels).set({ modules: { REFINERY: 3, SURVEY: 1, SHIPYARD: 1, HANGAR: 3 }, pvpOpenAt: null }).where(eq(vessels.id, me.vesselId));
    const person = await attack(me.headers, them.vesselId);
    const crewed = await attack(me.headers, crew.vesselId);
    expect([person.statusCode, code(person)]).toEqual([403, 'FEATURE_LOCKED']);
    expect([crewed.statusCode, crewed.json()]).toEqual([person.statusCode, person.json()]);
  });

  it('refuses a ship with no Aegis yet', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ modules: { REFINERY: 1 }, pvpOpenAt: null }).where(eq(vessels.id, them.vesselId));
    expect(code(await attack(me.headers, them.vesselId))).toBe('PVP_PROTECTED');
  });

  it('refuses a ship inside its first twelve hours', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ pvpOpenAt: new Date(world.f.clock.now().getTime() + 3_600_000) }).where(eq(vessels.id, them.vesselId));
    expect(code(await attack(me.headers, them.vesselId))).toBe('PVP_PROTECTED');
  });

  it('asks before an attack gives up your own shield, and then gives it up', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ pvpOpenAt: new Date(world.f.clock.now().getTime() + 3_600_000) }).where(eq(vessels.id, me.vesselId));
    expect(code(await attack(me.headers, them.vesselId))).toBe('ATTACK_DROPS_SHIELD');
    expect((await attack(me.headers, them.vesselId, { acknowledgeShieldLoss: true })).statusCode).toBe(200);
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(row!.pvpOpenAt!.getTime()).toBeLessThanOrEqual(world.f.clock.now().getTime());
  });

  it('allows a third attack on the same target only after the window', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ modules: { ...READY, HANGAR: 3 } }).where(eq(vessels.id, me.vesselId));
    for (let i = 0; i < 2; i++) {
      expect((await attack(me.headers, them.vesselId)).statusCode).toBe(200);
      await world.f.db.update(vessels).set({ recoveryUntil: null }).where(eq(vessels.id, them.vesselId));
      await pass(world, 10);
      await world.f.db.update(vessels).set({ recoveryUntil: null }).where(eq(vessels.id, them.vesselId));
    }
    expect(code(await attack(me.headers, them.vesselId))).toBe('BASH_LIMIT');
  });

  it('refuses a ship ready to jump, and one past its fourteen days', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ enlistedAt: new Date(world.f.clock.now().getTime() - (STARTER.pvp.lockAfterDays + 1) * 86_400_000) }).where(eq(vessels.id, me.vesselId));
    expect(code(await attack(me.headers, them.vesselId))).toBe('PVP_LOCKED');
  });

  it('never lets a probe be refused for any of that', async () => {
    const { me, them } = await pair();
    await world.f.db.update(vessels).set({ modules: { REFINERY: 1 }, pvpOpenAt: null }).where(eq(vessels.id, them.vesselId));
    await world.f.db.update(vessels).set({ alloy: 500, crystal: 500 }).where(eq(vessels.id, me.vesselId));
    expect((await post(world, '/api/starter/probe', me.headers, { targetPlanetId: them.vesselId })).statusCode).toBe(200);
  });

  it('is the same rule for a ship flying at the main galaxy: it cannot', async () => {
    const { me } = await pair();
    const answer = await attack(me.headers, world.f.planetIds[0]!);
    expect(answer.statusCode).toBe(404);
  });
});
