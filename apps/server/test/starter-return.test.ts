import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { returnSchema } from '../../web/src/api/schemas.js';
import { vesselNotifications, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('what the ship tells a returning commander', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const story = async (headers: Record<string, string>) => returnSchema.parse(await get(world, '/api/starter/return', headers));
  const tell = (vesselId: string, kind: string, payload: Record<string, unknown>, at: Date) => world.f.db.insert(vesselNotifications).values({ vesselId, kind, refId: crypto.randomUUID(), payload, createdAt: at });

  it('reads as the main story does, in the shape the away card reads', async () => {
    const me = await aboard(world, 'Me');
    world.f.clock.advance(120);
    const told = await story(me.headers);
    expect(told.awayMinutes).toBeGreaterThanOrEqual(120);
    expect(told.pending).toEqual([]);
  });

  it('names the raid, the fleet home and the probe that was seen', async () => {
    const me = await aboard(world, 'Me');
    world.f.clock.advance(60);
    const at = world.f.clock.now();
    await tell(me.vesselId, 'BATTLE_REPORT', { grade: 'PARTIAL', attacking: false, opponent: 'Other', loot: { alloy: 40, crystal: 10, deuterium: 0 }, lost: 2 }, at);
    await tell(me.vesselId, 'BATTLE_REPORT', { grade: 'DECISIVE', attacking: true, opponent: 'Other', loot: { alloy: 90, crystal: 0, deuterium: 0 }, lost: 1 }, at);
    await tell(me.vesselId, 'FLEET_HOME', { kind: 'MINE', cargo: { alloy: 70, crystal: 30, deuterium: 0 }, part: false }, at);
    await tell(me.vesselId, 'PROBE_DETECTED', {}, at);
    await tell(me.vesselId, 'PROBE_DETECTED', {}, at);
    const { entries } = await story(me.headers);
    expect(entries.find(entry => entry.kind === 'raided')).toMatchObject({ params: { grade: 'PARTIAL', loot: 50, lost: 2 } });
    expect(entries.find(entry => entry.kind === 'raid_result')).toMatchObject({ params: { grade: 'DECISIVE', loot: 90, lost: 1 } });
    expect(entries.find(entry => entry.kind === 'fleet_returned')).toMatchObject({ params: { resources: 100, alloy: 70, crystal: 30, deuterium: 0 } });
    expect(entries.find(entry => entry.kind === 'scan_detected')).toMatchObject({ params: { count: 2 } });
  });

  it('says what piled up in the buffers', async () => {
    const me = await aboard(world, 'Me', { REFINERY: 3, EXTRACTOR: 1 });
    await world.f.db.update(vessels).set({ bufferAlloy: 120, bufferCrystal: 40 }).where(eq(vessels.id, me.vesselId));
    world.f.clock.advance(60);
    const { entries } = await story(me.headers);
    const accrued = entries.find(entry => entry.kind === 'accrued');
    expect(accrued?.kind === 'accrued' && accrued.params.alloy).toBeGreaterThanOrEqual(120);
  });

  it('counts the deuterium waiting in the works too', async () => {
    const me = await aboard(world, 'Me', { REFINERY: 3, EXTRACTOR: 1, DEUTERIUM_PLANT: 1 });
    await world.f.db.update(vessels).set({ bufferAlloy: 120, bufferCrystal: 40, bufferDeuterium: 25 }).where(eq(vessels.id, me.vesselId));
    const { entries } = await story(me.headers);
    const accrued = entries.find(entry => entry.kind === 'accrued');
    expect(accrued?.kind === 'accrued' && accrued.params.deuterium).toBeGreaterThanOrEqual(25);
  });

  it('tells it once: a dismissal closes the window, and reading it does not', async () => {
    const me = await aboard(world, 'Me');
    world.f.clock.advance(60);
    await tell(me.vesselId, 'PROBE_DETECTED', {}, world.f.clock.now());
    expect((await story(me.headers)).entries.some(entry => entry.kind === 'scan_detected')).toBe(true);
    const told = await story(me.headers);
    expect(told.entries.some(entry => entry.kind === 'scan_detected')).toBe(true);
    await post(world, '/api/starter/return/seen', me.headers, { asOf: told.asOf.toISOString() });
    const after = await story(me.headers);
    expect(after.entries.some(entry => entry.kind === 'scan_detected')).toBe(false);
    expect(after.awayMinutes).toBe(0);
  });

  it('will not let a client close the window on the future', async () => {
    const me = await aboard(world, 'Me');
    const later = new Date(world.f.clock.now().getTime() + 86_400_000);
    await post(world, '/api/starter/return/seen', me.headers, { asOf: later.toISOString() });
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(row!.returnSeenAt!.getTime()).toBeLessThanOrEqual(world.f.clock.now().getTime());
  });
});
