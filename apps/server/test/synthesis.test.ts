import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import type { Db } from '../src/db/client.js';
import {
  moons, neutralPlanetState, notifications, playerAsterium, playerCapsules, planets, scheduledEvents, seasons, synthesisJobs,
} from '../src/db/schema.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import {
  cancelSynthesis, creditAsterium, settleWorldMoonAsterium, startSynthesis, synthesisView,
} from '../src/services/synthesis.js';
import { createSeason } from '../src/services/season.js';
import { onSynthesisComplete } from '../src/worker/handlers.js';
import { joinSettled, makeAccount, setLevel, testDb, truncateAll } from './helpers.js';

/** SENTEZ LABORATUVARI — service and moon production (plan 2026-11-24 §3.3–§3.4, S1–S5). */

const HOUR_MIN = 60;
let db: Db;
let clock: FixedClock;
let seasonId: string;
let a: { playerId: string; planetId: string };
let b: { playerId: string; planetId: string };
let colonyIds: string[];

afterAll(async () => { await (await testDb()).close(); });

beforeEach(async () => {
  ({ db } = await testDb());
  await truncateAll(db);
  clock = new FixedClock(new Date('2026-11-25T00:00:00.000Z'));
  const { season } = await createSeason(db, {
    shardCode: 'EU-SYN', seed: 7_331, startsAt: clock.now(), days: 14, rulesetVersion: MOON.rulesetVersion,
  });
  seasonId = season.id;
  await db.update(seasons).set({ synthesisStartsAt: clock.now() }).where(eq(seasons.id, seasonId));
  a = await joinSettled(db, (await makeAccount(db, 'Lab owner')).id, seasonId, clock);
  b = await joinSettled(db, (await makeAccount(db, 'Lab rival')).id, seasonId, clock);
  const neutrals = await db.select({ planetId: neutralPlanetState.planetId }).from(neutralPlanetState)
    .innerJoin(planets, eq(planets.id, neutralPlanetState.planetId)).where(eq(planets.seasonId, seasonId)).limit(2);
  colonyIds = neutrals.map((row) => row.planetId);
  await db.update(planets).set({ kind: 'COLONY', controllerPlayerId: a.playerId, statsOwnerPlayerId: a.playerId })
    .where(inArray(planets.id, colonyIds));
  await db.delete(neutralPlanetState).where(inArray(neutralPlanetState.planetId, colonyIds));
  await db.delete(moons).where(inArray(moons.planetId, colonyIds));
  await setLevel(db, a.planetId, 'CORE', 10);
  await db.update(planets).set({ alloy: 50_000, crystal: 50_000, deuterium: 5_000 }).where(eq(planets.id, a.planetId));
});

async function moonOn(planetId: string, rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'): Promise<void> {
  await db.insert(moons).values({
    planetId, rarity, origin: 'SEED', visualSeed: 1, bornAt: clock.now(), asteriumSyncedAt: clock.now(), asteriumFraction: 0,
  });
}
const balanceOf = async (playerId: string): Promise<number> =>
  (await db.select({ n: playerAsterium.balance }).from(playerAsterium).where(eq(playerAsterium.playerId, playerId)))[0]?.n ?? 0;
const capsulesOf = async (playerId: string): Promise<Record<string, number>> => Object.fromEntries(
  (await db.select().from(playerCapsules).where(eq(playerCapsules.playerId, playerId))).map((row) => [row.capsuleId, row.quantity]),
);
const capital = async () => (await db.select().from(planets).where(eq(planets.id, a.planetId)))[0]!;
const giveAsterium = (playerId: string, amount: number) => db.transaction((tx) => creditAsterium(tx, playerId, amount, clock.now()));
const start = (capsule: 'OPTIC_VEIL' | 'SILENT_THRUST', quantity: number, playerId = a.playerId) =>
  db.transaction((tx) => startSynthesis(tx, playerId, capsule, quantity, clock));
const cancel = (playerId = a.playerId) => db.transaction((tx) => cancelSynthesis(tx, playerId, clock));
const code = async (run: () => Promise<unknown>): Promise<string | undefined> => {
  try { await run(); return undefined; } catch (error) { return (error as { code?: string }).code; }
};

describe('S1 the laboratory view', () => {
  it('is dark in a season without Asteryum', async () => {
    await db.update(seasons).set({ synthesisStartsAt: null, rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, seasonId));
    expect((await synthesisView(db, a.playerId, clock)).enabled).toBe(false);
    await giveAsterium(a.playerId, 8);
    expect(await code(() => start('OPTIC_VEIL', 1))).toBe('SYNTHESIS_DISABLED');
  });

  it('shows the stock, the moons and the lock below Komuta Merkezi 10', async () => {
    await setLevel(db, a.planetId, 'CORE', 9);
    await moonOn(colonyIds[0]!, 'RARE');
    await giveAsterium(a.playerId, 14);
    const view = await synthesisView(db, a.playerId, clock);
    expect(view).toMatchObject({ enabled: true, unlocked: false, coreLevel: 9, requiredCore: 10, asterium: 14, perDay: 1.5 });
    expect(view.moons).toHaveLength(1);
    expect(view.capsules).toEqual({ OPTIC_VEIL: 0, SILENT_THRUST: 0 });
    expect(view.job).toBeNull();
  });

  it('opens at Komuta Merkezi 10', async () => {
    expect((await synthesisView(db, a.playerId, clock)).unlocked).toBe(true);
  });
});

describe('S2 starting a batch', () => {
  it('refuses below the Core, while busy, short of Asteryum or resources, past the season, or a bad quantity', async () => {
    await giveAsterium(a.playerId, 100);
    await setLevel(db, a.planetId, 'CORE', 9);
    expect(await code(() => start('OPTIC_VEIL', 1))).toBe('SYNTHESIS_LOCKED');
    await setLevel(db, a.planetId, 'CORE', 10);
    expect(await code(() => start('OPTIC_VEIL', 0))).toBe('INVALID_QUANTITY');
    expect(await code(() => start('OPTIC_VEIL', 21))).toBe('INVALID_QUANTITY');
    expect(await code(() => start('OPTIC_VEIL', 18))).toBe('INSUFFICIENT_RESOURCES'); // 54,000 crystal
    await db.update(playerAsterium).set({ balance: 3 }).where(eq(playerAsterium.playerId, a.playerId));
    expect(await code(() => start('OPTIC_VEIL', 1))).toBe('INSUFFICIENT_ASTERIUM');
    await db.update(playerAsterium).set({ balance: 100 }).where(eq(playerAsterium.playerId, a.playerId));
    await start('OPTIC_VEIL', 1);
    expect(await code(() => start('SILENT_THRUST', 1))).toBe('SYNTHESIS_BUSY');
  });

  it('refuses a batch whose last capsule would land after the season ends', async () => {
    await giveAsterium(a.playerId, 100);
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    clock.set(new Date(season!.endsAt.getTime() - 50 * 60_000));
    expect(await code(() => start('OPTIC_VEIL', 2))).toBe('SEASON_ENDING');
  });

  it('takes the batch price at once, freezes what was paid and books the last capsule', async () => {
    await giveAsterium(a.playerId, 20);
    const before = await capital();
    const result = await start('OPTIC_VEIL', 3);
    const after = await capital();
    expect(before.alloy - after.alloy).toBeCloseTo(6_000, 6);
    expect(before.crystal - after.crystal).toBeCloseTo(9_000, 6);
    expect(before.deuterium - after.deuterium).toBeCloseTo(750, 6);
    expect(await balanceOf(a.playerId)).toBe(8);
    const [job] = await db.select().from(synthesisJobs).where(eq(synthesisJobs.playerId, a.playerId));
    expect(job).toMatchObject({ capsuleId: 'OPTIC_VEIL', quantity: 3, delivered: 0, paidAlloy: 6_000, paidCrystal: 9_000, paidDeuterium: 750, paidAsterium: 12 });
    expect(job!.completesAt.getTime() - job!.startedAt.getTime()).toBe(90 * 60_000);
    const events = await db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'synthesis_complete'), eq(scheduledEvents.refId, job!.id)));
    expect(events).toHaveLength(1);
    expect(events[0]!.resolveAt.getTime()).toBe(job!.completesAt.getTime());
    expect(result.synthesis.job).toMatchObject({ capsuleId: 'OPTIC_VEIL', quantity: 3, delivered: 0 });
  });
});

describe('S3 cancelling', () => {
  it('keeps what was made and returns half of the unmade share', async () => {
    await giveAsterium(a.playerId, 12);
    await start('OPTIC_VEIL', 3);
    clock.advance(35); // one made
    const before = await capital();
    await cancel();
    const after = await capital();
    expect(await capsulesOf(a.playerId)).toMatchObject({ OPTIC_VEIL: 1 });
    // 2 of 3 unmade: half of 4,000 alloy, 6,000 crystal, 500 deuterium, 8 Asteryum. Production also ran 35 min.
    expect(after.alloy - before.alloy).toBeGreaterThanOrEqual(2_000 - 1e-6);
    expect(after.alloy - before.alloy).toBeLessThan(2_000 + 5_000);
    expect(await balanceOf(a.playerId)).toBe(4);
    expect(await db.select().from(synthesisJobs)).toHaveLength(0);
    expect(await db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'synthesis_complete'))).toHaveLength(0);
  });

  it('finishes instead of cancelling once the last capsule is due, and refuses a cancel with nothing running', async () => {
    await giveAsterium(a.playerId, 8);
    await start('OPTIC_VEIL', 2);
    clock.advance(HOUR_MIN);
    const balance = await balanceOf(a.playerId);
    await cancel();
    expect(await capsulesOf(a.playerId)).toMatchObject({ OPTIC_VEIL: 2 });
    expect(await balanceOf(a.playerId)).toBe(balance);
    expect(await code(() => cancel())).toBe('NO_SYNTHESIS');
  });
});

describe('S4 completion: the worker and a lazy read agree', () => {
  it('delivers exactly the batch and tells the commander once', async () => {
    await giveAsterium(a.playerId, 12);
    await start('OPTIC_VEIL', 3);
    clock.advance(31);
    expect((await synthesisView(db, a.playerId, clock)).capsules.OPTIC_VEIL).toBe(1);
    clock.advance(60);
    const [event] = await db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'synthesis_complete'));
    await Promise.all([
      onSynthesisComplete({ db, clock }, event!),
      synthesisView(db, a.playerId, clock),
      onSynthesisComplete({ db, clock }, event!),
    ]);
    expect(await capsulesOf(a.playerId)).toMatchObject({ OPTIC_VEIL: 3 });
    expect(await db.select().from(synthesisJobs)).toHaveLength(0);
    const ready = await db.select().from(notifications)
      .where(and(eq(notifications.playerId, a.playerId), eq(notifications.kind, 'synthesis_ready')));
    expect(ready).toHaveLength(1);
    // The press lands in the laboratory: the capital, its Tactical tab, the lab's own bay (owner 2026-11-25).
    expect(ready[0]!.payload).toMatchObject({ capsuleId: 'OPTIC_VEIL', quantity: 3, planetId: a.planetId, group: 'tactical', itemId: 'synthesis-lab' });
  });

  it('ignores a cancelled batch’s stale event when a new batch runs', async () => {
    await giveAsterium(a.playerId, 20);
    await start('OPTIC_VEIL', 1);
    const [stale] = await db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'synthesis_complete'));
    await cancel();
    await start('SILENT_THRUST', 1);
    clock.advance(31);
    await onSynthesisComplete({ db, clock }, stale!);
    expect(await capsulesOf(a.playerId)).toEqual({});
    expect(await db.select().from(synthesisJobs)).toHaveLength(1);
  });
});

describe('S5 moons make Asteryum for their holder', () => {
  it('pays by rarity, from every moon held', async () => {
    await moonOn(colonyIds[0]!, 'COMMON');
    await moonOn(colonyIds[1]!, 'LEGENDARY');
    clock.advance(24 * HOUR_MIN);
    const view = await synthesisView(db, a.playerId, clock);
    expect(view.asterium).toBe(1 + 3);
    expect(view.perDay).toBe(4);
    expect((await synthesisView(db, a.playerId, clock)).asterium).toBe(4);
  });

  it('makes nothing while a Death Star keeps the moon shut', async () => {
    await moonOn(colonyIds[0]!, 'LEGENDARY'); // one per 8 h
    clock.advance(8 * HOUR_MIN);
    await db.transaction((tx) => settleWorldMoonAsterium(tx, colonyIds[0]!, clock.now()));
    await db.update(moons).set({ closedUntil: new Date(clock.now().getTime() + 3 * 3_600_000) }).where(eq(moons.planetId, colonyIds[0]!));
    expect(await balanceOf(a.playerId)).toBe(1);
    clock.advance(3 * HOUR_MIN);
    expect((await synthesisView(db, a.playerId, clock)).asterium).toBe(1);
    clock.advance(8 * HOUR_MIN);
    expect((await synthesisView(db, a.playerId, clock)).asterium).toBe(2);
  });

  it('pays the old holder up to a capture and starts the new one from zero', async () => {
    await moonOn(colonyIds[0]!, 'EPIC'); // one per 12 h
    clock.advance(18 * HOUR_MIN);
    await db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colonyIds[0]!, newPlayerId: b.playerId, expectedControllerPlayerId: a.playerId,
      now: clock.now(), protectedUntil: clock.now(),
    }));
    expect(await balanceOf(a.playerId)).toBe(1);
    clock.advance(6 * HOUR_MIN);
    expect((await synthesisView(db, b.playerId, clock)).asterium).toBe(0);
    clock.advance(6 * HOUR_MIN);
    expect((await synthesisView(db, b.playerId, clock)).asterium).toBe(1);
    expect((await synthesisView(db, a.playerId, clock)).asterium).toBe(1);
  });

  // Owner 2026-11-25: the moon says how much it has made. The count is the holder's, and starts again with a new one.
  it('counts what a moon has paid its holder through either path, and a new holder starts at zero', async () => {
    await moonOn(colonyIds[0]!, 'LEGENDARY'); // one per 8 h
    const produced = async (): Promise<number | undefined> =>
      (await db.select({ produced: moons.asteriumProduced }).from(moons).where(eq(moons.planetId, colonyIds[0]!)))[0]?.produced;
    clock.advance(16 * HOUR_MIN);
    await synthesisView(db, a.playerId, clock);
    await db.transaction((tx) => settleWorldMoonAsterium(tx, colonyIds[0]!, clock.now()));
    expect(await produced()).toBe(2);
    clock.advance(8 * HOUR_MIN);
    await db.transaction((tx) => settleWorldMoonAsterium(tx, colonyIds[0]!, clock.now()));
    expect(await produced()).toBe(3);
    await db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colonyIds[0]!, newPlayerId: b.playerId, expectedControllerPlayerId: a.playerId,
      now: clock.now(), protectedUntil: clock.now(),
    }));
    expect(await produced()).toBe(0);
  });

  it('keeps what a moon paid after the moon is gone', async () => {
    await moonOn(colonyIds[0]!, 'LEGENDARY');
    clock.advance(16 * HOUR_MIN);
    await db.transaction((tx) => settleWorldMoonAsterium(tx, colonyIds[0]!, clock.now()));
    await db.delete(moons).where(eq(moons.planetId, colonyIds[0]!));
    expect((await synthesisView(db, a.playerId, clock)).asterium).toBe(2);
  });
});

