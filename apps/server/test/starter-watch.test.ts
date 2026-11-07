import { telescopeSlots } from '@astera/rules';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, placeShip, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface Intel { watching: { slot: number; targetPlanetId: string; targetName: string; ownerName: string; reading: { status: string }; cooldownUntil: string | null }[] }

describe('watching a ship', () => {
  let world: StarterWorld;
  const watch = (headers: Record<string, string>, targetPlanetId: string, slot = 0) => post(world, '/api/starter/watch', headers, { targetPlanetId, slot });
  const near = async (stage = 1, x = 300) => {
    const me = await aboard(world, 'Me', { SURVEY: 1, TELESCOPE: stage });
    const other = await aboard(world, 'Other');
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, other.vesselId, { x });
    return { me, other };
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('is closed until the telescope works', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1 });
    const other = await aboard(world, 'Other');
    expect((await watch(me.headers, other.vesselId)).json<{ error: string }>().error).toBe('FEATURE_LOCKED');
  });

  it('shows the watched ship on the intel page, with its fleet\'s state', async () => {
    const { me, other } = await near();
    const answer = await watch(me.headers, other.vesselId);
    expect(answer.statusCode).toBe(200);
    const intel = await get<Intel>(world, '/api/starter/intel', me.headers);
    expect(intel.watching[0]).toMatchObject({ slot: 0, targetPlanetId: other.vesselId, targetName: 'Other', ownerName: 'Other' });
    expect(['HOME', 'UNKNOWN', 'AWAY', 'RETURNING']).toContain(intel.watching[0]!.reading.status);
  });

  it('holds as many as the telescope has slots', async () => {
    const { me, other } = await near(1);
    const slots = telescopeSlots(1);
    const bad = await watch(me.headers, other.vesselId, slots);
    expect(bad.json()).toMatchObject({ error: 'BAD_SLOT', params: { context: 'ship', slots } });
    const { me: big } = await near(3);
    expect(telescopeSlots(3)).toBe(2);
    expect((await watch(big.headers, other.vesselId, 1)).statusCode).not.toBe(400);
  });

  it('reaches only as far as the telescope sees', async () => {
    const { me, other } = await near(1, 800);
    expect((await watch(me.headers, other.vesselId)).json()).toMatchObject({ error: 'OUT_OF_RANGE', params: { context: 'ship', reach: expect.any(Number) as number } });
  });

  it('waits out its cooldown before it may be pointed elsewhere', async () => {
    const { me, other } = await near();
    const second = await aboard(world, 'Second');
    await placeShip(world, second.vesselId, { x: 200 });
    await watch(me.headers, other.vesselId);
    const again = await watch(me.headers, second.vesselId);
    expect(again.statusCode).toBe(409);
    expect(again.json<{ error: string }>().error).toBe('WATCH_COOLDOWN');
  });

  it('does not watch itself', async () => {
    const { me } = await near();
    expect((await watch(me.headers, me.vesselId)).json<{ error: string }>().error).toBe('SELF_WATCH');
  });
});
