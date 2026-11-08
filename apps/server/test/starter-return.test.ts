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

  // F5: a haul lands in the works and loses what finds no room; the story counts what landed.
  it('counts only what a haul landed, and says what found no room', async () => {
    const me = await aboard(world, 'Me');
    world.f.clock.advance(60);
    const at = world.f.clock.now();
    await tell(me.vesselId, 'FLEET_HOME', { kind: 'MINE', cargo: { alloy: 200, crystal: 100, deuterium: 0 }, part: false, ships: 1, wasted: { alloy: 50, crystal: 0, deuterium: 0 } }, at);
    const { entries } = await story(me.headers);
    expect(entries.find(entry => entry.kind === 'fleet_returned')).toMatchObject({ params: { resources: 250, alloy: 150, crystal: 100, deuterium: 0, lost: 50, ships: 1 } });
  });

  // F5: an outpost raid's two outcomes the card leads with, as the signal says them.
  it('carries the outpost, the first victory and who got there first on a raid result', async () => {
    const me = await aboard(world, 'Me');
    world.f.clock.advance(60);
    const at = world.f.clock.now();
    await tell(me.vesselId, 'BATTLE_REPORT', { grade: 'DECISIVE', attacking: true, opponent: 'Tevis', opponentKind: 'OUTPOST', loot: { alloy: 60, crystal: 0, deuterium: 0 }, lost: 0, firstVictory: true }, at);
    await tell(me.vesselId, 'BATTLE_REPORT', { grade: 'DECISIVE', attacking: true, opponent: 'Eldeth', opponentKind: 'OUTPOST', loot: { alloy: 0, crystal: 0, deuterium: 0 }, lost: 0, beatenBy: 'Early' }, new Date(at.getTime() - 1000));
    const raids = (await story(me.headers)).entries.filter(entry => entry.kind === 'raid_result');
    expect(raids.map(entry => entry.params)).toEqual([
      { grade: 'DECISIVE', loot: 60, lost: 0, opponent: 'Tevis', firstVictory: true },
      { grade: 'DECISIVE', loot: 0, lost: 0, opponent: 'Eldeth', beatenBy: 'Early' },
    ]);
  });

  // F5: what came back online while the player was away and has not been announced yet, in ladder order.
  it('names what opened and is still to be announced', async () => {
    const me = await aboard(world, 'Me', { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1, SHIPYARD: 1 });
    await world.f.db.update(vessels).set({ unlocksSeen: ['production', 'intel'] }).where(eq(vessels.id, me.vesselId));
    world.f.clock.advance(60);
    const told = await story(me.headers);
    expect(told.newUnlocks).toContain('fleet');
    expect(told.newUnlocks).not.toContain('production');
    expect(told.newUnlocks).not.toContain('intel');
  });

  // F5: the card leads with the player's own orders, so the cap never drops one for other news.
  it('keeps the player\'s own orders when there is more to tell than the card holds', async () => {
    const me = await aboard(world, 'Me');
    world.f.clock.advance(60);
    const at = world.f.clock.now();
    for (let i = 0; i < 6; i++) await tell(me.vesselId, 'BATTLE_REPORT', { grade: 'REPELLED', attacking: false, opponent: `Raider ${String(i)}`, loot: { alloy: 0, crystal: 0, deuterium: 0 }, lost: 0 }, new Date(at.getTime() - i * 1000));
    await tell(me.vesselId, 'BATTLE_REPORT', { grade: 'DECISIVE', attacking: true, opponent: 'Tevis', opponentKind: 'OUTPOST', loot: { alloy: 60, crystal: 0, deuterium: 0 }, lost: 0 }, new Date(at.getTime() - 30_000));
    await tell(me.vesselId, 'FLEET_HOME', { kind: 'MINE', cargo: { alloy: 70, crystal: 30, deuterium: 0 }, part: false, ships: 1 }, at);
    const kinds = (await story(me.headers)).entries.map(entry => entry.kind);
    expect(kinds.slice(0, 2)).toEqual(['raid_result', 'fleet_returned']);
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
