import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { MULTI_WORLD } from '@astera/rules';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorEvents, honorSeasons, missions, scheduledEvents, seasons } from '../src/db/schema.js';
import { honorEvidenceSchema, replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { honorOwnerReference, observeHonorOwner } from '../src/services/honorReference.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import { launchAttack } from '../src/services/mission.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

// Owner 2026-11-12: the fight counts as much as the two navies allow. The day peak forgets
// ships destroyed in battle, and a second raid on a commander far below you is bullying.
const DAY = 86_400_000;
const activate = async (f: Fixture) => {
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  await f.db.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: f.clock.now() });
};

describe('Honor references read battle losses from the journal', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(3, 7719);
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 9);
    await activate(f);
  });
  const fleets = async (...darts: number[]) => {
    for (const [index, count] of darts.entries()) await giveUnits(f.db, f.planetIds[index]!, { DART: count });
  };
  const observe = () => f.db.transaction(async tx => {
    for (const id of [...f.playerIds].sort()) await observeHonorOwner(tx, id, f.clock.now());
  });
  const reference = (index: number, at = f.clock.now()) => honorOwnerReference(f.db, f.seasonId, f.playerIds[index]!, at);
  const preview = () => honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, new Set());
  const member = (index: number, loss = 0) => ({ id: f.playerIds[index]!, tier: 3, navy: 100_000, weight: 10_000,
    civilianWeight: 0, loss, combatLoss: loss, lootLost: 0 });
  /** One booked raid: `attack` on `defence`, with what each of them lost in it. */
  const book = (attack: number, defence: number, lost: { attack?: number[]; defence?: number } = {}, over: Partial<HonorEvidence> = {}) =>
    f.db.transaction(tx => settleHonor(tx, f.seasonId, { source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
      attack: (lost.attack ?? [0]).map(loss => member(attack, loss)), defence: [member(defence, lost.defence)],
      selectedDefenders: [f.playerIds[defence]!],
      relations: [{ a: f.playerIds[attack]!, b: f.playerIds[defence]!, related: false }], ...over }));

  it('drops a battle loss from the day peak at once and keeps any other drop for the day', async () => {
    await fleets(100, 100); await observe();
    const peak = await reference(1), dart = peak.navy / 100;
    f.clock.advance(60);
    await fleets(100, 20); await observe();
    expect(await reference(1)).toEqual(peak);
    await book(0, 1, { defence: 80 * dart });
    expect(await reference(1)).toEqual({ ...peak, navy: 20 * dart });
    expect((await reference(0)).navy).toBe(peak.navy);
  });

  it('nets only the destroyed part of a mixed drop, summed over an attacker\'s waves', async () => {
    await fleets(100, 100); await observe();
    const dart = (await reference(0)).navy / 100, before = f.clock.now();
    f.clock.advance(60);
    await fleets(30, 100); await observe();
    await book(0, 1, { attack: [20 * dart, 10 * dart] });
    expect((await reference(0)).navy).toBe(70 * dart);
    expect((await reference(0, before)).navy).toBe(100 * dart);
  });

  it('forgets the loss with the day it happened in', async () => {
    await fleets(100, 100); await observe();
    const dart = (await reference(1)).navy / 100;
    f.clock.advance(60);
    await fleets(100, 20); await observe();
    await book(0, 1, { defence: 80 * dart });
    f.clock.set(new Date(f.clock.now().getTime() + DAY));
    expect((await reference(1)).navy).toBe(20 * dart);
  });

  it('judges an attacker by the fleet that survived its last battle', async () => {
    await fleets(100, 20); await observe();
    const dart = (await reference(0)).navy / 100;
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'NONE' });
    f.clock.advance(60);
    await fleets(20, 20); // no observation: the preview samples the present itself
    expect(await preview()).toMatchObject({ militaryReturn: 'NONE' });
    await book(0, 2, { attack: [80 * dart] });
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'FULL', repeatRaid: false });
  });

  it('stops paying for a commander somebody else has just broken', async () => {
    await fleets(100, 100, 100); await observe();
    const dart = (await reference(1)).navy / 100;
    expect(await preview()).toMatchObject({ militaryReturn: 'FULL' });
    f.clock.advance(60);
    await fleets(100, 20, 100); await observe();
    expect(await preview()).toMatchObject({ militaryReturn: 'FULL' });
    await book(2, 1, { defence: 80 * dart });
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'NONE', repeatRaid: false });
  });

  it('warns before a second raid inside the day, only where the navies pay nothing', async () => {
    await fleets(100, 20, 100); await observe();
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'NONE', repeatRaid: false });
    await book(1, 0); // being raided by them is not raiding them
    f.clock.advance(1);
    await book(0, 2, {}, { defence: [member(2), member(1)], selectedDefenders: [f.playerIds[2]!], relations: [
      { a: f.playerIds[0]!, b: f.playerIds[2]!, related: false }, { a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }] });
    expect(await preview()).toMatchObject({ kind: 'PEER', repeatRaid: false }); // they only stood in another's line
    f.clock.advance(1);
    const at = f.clock.now().getTime();
    await book(0, 1);
    expect(await preview()).toMatchObject({ kind: 'WEAK', militaryReturn: 'NONE', repeatRaid: true });
    f.clock.set(new Date(at + DAY - 1));
    expect(await preview()).toMatchObject({ kind: 'WEAK', repeatRaid: true });
    f.clock.set(new Date(at + DAY));
    expect(await preview()).toMatchObject({ kind: 'PEER', repeatRaid: false });
  });

  it('never calls a second fight between comparable navies a repeat', async () => {
    await fleets(100, 40); await observe();
    await book(0, 1);
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'HALF', repeatRaid: false });
  });

  it('tells only the commander whose own return visit was the bullying', async () => {
    const id = (index: number) => f.playerIds[index]!;
    // A shared raid: commander 2 is far above the defender, commander 0 comes back to them.
    const raid = (eventId: string, ownNavy: number) => book(0, 1, { defence: 10_000 }, { id: eventId, weakNavyBand: 33,
      attack: [{ ...member(0), navy: ownNavy }, { ...member(2), tier: 5, navy: 400_000 }],
      relations: [{ a: id(0), b: id(1), related: false, repeatRaid: true }, { a: id(2), b: id(1), related: false }] });
    await raid('even', 100_000);
    await raid('far', 400_000);
    const sources = ['even', 'far'].map(eventId => ({ source: 'WORLD' as const, id: eventId }));
    const receipts = async (index: number) => {
      const found = await f.db.transaction(tx => readHonorReceipts(tx, id(index), sources));
      return sources.map(source => found.get(JSON.stringify([source.source, source.id]))!.breakdown);
    };
    const [even, far] = await receipts(0);
    expect(even).toMatchObject({ weakTargetDebit: true });
    expect(even).not.toHaveProperty('repeatRaid');
    expect(far).toMatchObject({ weakTargetDebit: true, repeatRaid: true });
    for (const breakdown of await receipts(2)) expect(breakdown).not.toHaveProperty('repeatRaid');
  });
});

describe('a second raid on a commander far below you', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24771);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion });
    for (const id of f.planetIds) { await setLevel(f.db, id, 'CORE', 12); await fuelUp(f.db, id, 50_000); }
    await giveUnits(f.db, f.planetIds[0]!, { DART: 400 });
    await giveUnits(f.db, f.planetIds[1]!, { DART: 20 });
    await activate(f);
  });
  const preview = () => honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, new Set());
  const raid = async () => {
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 100 }, f.clock);
    return { ...launch, land: async () => {
      f.clock.set(settledAt(launch.arriveAt));
      const [event] = await f.db.select().from(scheduledEvents)
        .where(and(eq(scheduledEvents.refId, launch.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
      await onMissionArrival({ db: f.db, clock: f.clock }, event!);
      // The same planet takes no second fleet until the first one is home again.
      const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launch.missionId));
      const [home] = await f.db.select().from(scheduledEvents)
        .where(and(eq(scheduledEvents.refId, back!.id), eq(scheduledEvents.kind, 'mission_arrival')));
      f.clock.set(home!.resolveAt);
      await onMissionArrival({ db: f.db, clock: f.clock }, home!);
    } };
  };
  const journal = () => f.db.select().from(honorEvents).orderBy(asc(honorEvents.at));
  const pair = () => ({ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false });

  it('leaves the first raid neutral, sanctions the return, and clears after a day', async () => {
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'NONE', repeatRaid: false });
    const first = await raid();
    expect(await preview()).toMatchObject({ kind: 'WEAK', repeatRaid: true }); // a fleet is already on its way
    await first.land();
    expect(await preview()).toMatchObject({ kind: 'WEAK', repeatRaid: true });

    f.clock.advance(13 * 60);
    await giveUnits(f.db, f.planetIds[1]!, { DART: 20 });
    const second = await raid(); await second.land();

    f.clock.advance(25 * 60);
    await giveUnits(f.db, f.planetIds[1]!, { DART: 20 });
    expect(await preview()).toMatchObject({ kind: 'PEER', repeatRaid: false });
    const third = await raid(); await third.land();

    const events = await journal();
    expect(events.map(row => row.sourceId)).toEqual([first.missionId, second.missionId, third.missionId]);
    expect(events.map(row => row.evidence.weakNavyBand)).toEqual([33, 33, 33]);
    expect(events.map(row => row.evidence.relations)).toEqual([[pair()], [{ ...pair(), repeatRaid: true }], [pair()]]);
    expect(events.map(row => row.outcome.pool.attack.exposures[0]!.bullying)).toEqual([false, true, false]);
    expect(events[0]!.outcome.attack.total).toBe(0);
    expect(events[1]!.outcome.attack.total).toBeLessThan(0);
    expect(events[2]!.outcome.attack.total).toBe(0);

    const sources = events.map(row => ({ source: row.source, id: row.sourceId }));
    const receipts = async (playerId: string) => {
      const found = await f.db.transaction(tx => readHonorReceipts(tx, playerId, sources));
      return sources.map(source => found.get(JSON.stringify([source.source, source.id]))!);
    };
    const mine = await receipts(f.playerIds[0]!);
    expect(mine[0]).toMatchObject({ delta: 0, reason: 'NO_GAIN', breakdown: { weakTargetDebit: false } });
    expect(mine[0]!.breakdown).not.toHaveProperty('repeatRaid');
    expect(mine[1]).toMatchObject({ reason: 'WEAK_TARGET', breakdown: { weakTargetDebit: true, repeatRaid: true } });
    expect(mine[2]!.breakdown).not.toHaveProperty('repeatRaid');
    expect((await receipts(f.playerIds[1]!))[1]!.breakdown).not.toHaveProperty('repeatRaid');
  });
});

describe('the 2026-11-12 table in the journal', () => {
  const evidence = (id: string, at: number, over: Partial<HonorEvidence> = {}): HonorEvidence => ({
    source: 'WORLD', id, at, eligible: true, weakNavyBand: 33,
    attack: [{ id: 'A', tier: 4, navy: 80_000, weight: 80_000, civilianWeight: 0, loss: 1_000, combatLoss: 1_000, lootLost: 0 }],
    defence: [{ id: 'D', tier: 4, navy: 20_000, defenceNavy: 20_000, weight: 20_000, civilianWeight: 0, loss: 10_000, combatLoss: 10_000, lootLost: 0 }],
    relations: [{ a: 'A', b: 'D', related: false }], ...over });
  const again = { relations: [{ a: 'A', b: 'D', related: false, repeatRaid: true as const }] };
  const totals = (rows: HonorEvidence[]) => replayHonor(rows, 4).events.map(row => row.attack.total);

  it('keeps one canonical form for a committed repeat', () => {
    expect(honorEvidenceSchema.parse(evidence('repeat', 1, again)).relations[0]).toEqual(again.relations[0]);
    expect(honorEvidenceSchema.parse(evidence('first', 1)).relations[0]).not.toHaveProperty('repeatRaid');
    expect(() => honorEvidenceSchema.parse({ ...evidence('bad', 1), relations: [{ a: 'A', b: 'D', related: false, repeatRaid: false }] })).toThrow();
  });

  it('charges a far smaller target nothing once, and more each time the attacker comes back', () => {
    // 5 × 10,000 harm at 50 micro per fifth, then × 1, × 1.5 and × 2, beside the whole loss.
    expect(totals([evidence('one', 1), evidence('two', 2, again), evidence('three', 3, again), evidence('four', 4, again)]))
      .toEqual([0, -2_600_000, -3_850_000, -5_100_000]);
  });

  it('never rewrites a fight frozen under the older table', () => {
    const old = evidence('old', 1, { weakNavyBand: 50 });
    expect(totals([old])).toEqual([-100_000]);
    expect(totals([old, evidence('new', 2)])).toEqual([-100_000, 0]);
    expect(totals([{ ...old, ...again }])).toEqual([-100_000]);
  });
});
