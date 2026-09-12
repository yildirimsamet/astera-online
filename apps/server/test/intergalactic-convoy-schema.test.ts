import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { GALAXY_EVENTS, type IntergalacticConvoyEffect } from '@astera/rules';
import {
  eventKind,
  galaxyEventOccurrenceKind,
  galaxyEventOccurrences,
  intergalacticConvoyRuns,
  notificationKind,
} from '../src/db/schema.js';
import { baysInUse } from '../src/services/flight.js';
import { planetView } from '../src/services/planetView.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

const effect: IntergalacticConvoyEffect =
  GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]?.effect
  ?? (() => { throw new Error('missing convoy definition'); })();

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2); });
afterAll(async () => { await (await testDb()).close(); });

async function occurrence(sequence = 0): Promise<string> {
  const startsAt = new Date(f.clock.now().getTime() + (sequence + 1) * 60_000);
  const [row] = await f.db.insert(galaxyEventOccurrences).values({
    seasonId: f.seasonId,
    sequence,
    kind: 'INTERGALACTIC_CONVOY',
    definitionVersion: 1,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 120 * 60_000),
    effect,
  }).returning({ id: galaxyEventOccurrences.id });
  if (row === undefined) throw new Error('occurrence was not inserted');
  return row.id;
}

function run(occurrenceId: string, overrides: Partial<typeof intergalacticConvoyRuns.$inferInsert> = {}) {
  const departAt = f.clock.now();
  const arriveAt = new Date(departAt.getTime() + 60_000);
  const engagementEndsAt = new Date(arriveAt.getTime() + 5_000);
  const homeAt = new Date(engagementEndsAt.getTime() + 90_000);
  return {
    seasonId: f.seasonId,
    occurrenceId,
    planetId: f.planetIds[0]!,
    ownerPlayerId: f.playerIds[0]!,
    fleet: { DART: 1 },
    tech: {},
    interceptX: 0.123456789012345,
    interceptY: -321.123456789012,
    interceptZ: 456.987654321098,
    engagementEndX: 3.12345678901234,
    engagementEndY: -319.123456789012,
    engagementEndZ: 455.987654321098,
    returnX: 1_000.12345678901,
    returnY: -900.123456789012,
    returnZ: 100.123456789012,
    departAt,
    arriveAt,
    engagementEndsAt,
    homeAt,
    productionCap: { alloy: 100, crystal: 50, deuterium: 20 },
    resourceQualityFactor: 0.5,
    shipQualityFactor: 0.25,
    quotedResourceReward: { alloy: 50, crystal: 25, deuterium: 10 },
    ...overrides,
  } satisfies typeof intergalacticConvoyRuns.$inferInsert;
}

describe('the additive convoy schema', () => {
  it('appends every enum value without moving existing values', () => {
    expect(galaxyEventOccurrenceKind.enumValues).toEqual([
      'ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY',
    ]);
    expect(eventKind.enumValues.slice(-2)).toEqual(['convoy_arrival', 'convoy_return']);
    expect(notificationKind.enumValues.at(-1)).toBe('convoy_result');
  });

  it('round-trips coordinates at double precision and keeps unresolved rewards null', async () => {
    const occurrenceId = await occurrence();
    const input = run(occurrenceId);
    const [row] = await f.db.insert(intergalacticConvoyRuns).values(input).returning();
    expect(row?.status).toBe('outbound');
    expect(row?.interceptX).toBe(input.interceptX);
    expect(row?.engagementEndY).toBe(input.engagementEndY);
    expect(row?.returnZ).toBe(input.returnZ);
    expect(row?.quotedResourceReward).toEqual(input.quotedResourceReward);
    expect(row?.resourceReward).toBeNull();
    expect(row?.awardedFleet).toBeNull();
  });

  it('holds one flight bay for both active legs and releases it only when done', async () => {
    const occurrenceId = await occurrence();
    const [row] = await f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId)).returning();
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(1);
    expect((await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock)))
      .convoyLaunchLocked).toBe(true);

    await f.db.update(intergalacticConvoyRuns).set({
      status: 'returning',
      resourceReward: { alloy: 0, crystal: 0, deuterium: 0 },
      awardedFleet: {},
    }).where(eq(intergalacticConvoyRuns.id, row!.id));
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(1);

    await f.db.update(intergalacticConvoyRuns).set({ status: 'done' })
      .where(eq(intergalacticConvoyRuns.id, row!.id));
    expect(await baysInUse(f.db, f.planetIds[0]!)).toBe(0);
    expect((await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock)))
      .convoyLaunchLocked).toBe(false);
  });

  it('allows one active run per physical world across occurrences', async () => {
    const firstOccurrence = await occurrence(0);
    const secondOccurrence = await occurrence(1);
    const [first] = await f.db.insert(intergalacticConvoyRuns)
      .values(run(firstOccurrence))
      .returning({ id: intergalacticConvoyRuns.id });
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(secondOccurrence)))
      .rejects.toThrow();

    await f.db.update(intergalacticConvoyRuns).set({
      status: 'done',
      resourceReward: { alloy: 0, crystal: 0, deuterium: 0 },
      awardedFleet: {},
    }).where(eq(intergalacticConvoyRuns.id, first!.id));
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(secondOccurrence)))
      .resolves.toBeDefined();
  });

  it('allows a world to raid each occurrence only once, even after done', async () => {
    const occurrenceId = await occurrence();
    const [first] = await f.db.insert(intergalacticConvoyRuns)
      .values(run(occurrenceId))
      .returning({ id: intergalacticConvoyRuns.id });
    await f.db.update(intergalacticConvoyRuns).set({
      status: 'done',
      resourceReward: { alloy: 0, crystal: 0, deuterium: 0 },
      awardedFleet: {},
    }).where(eq(intergalacticConvoyRuns.id, first!.id));
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId)))
      .rejects.toThrow();
  });

  it('keeps the two database locks authoritative under concurrent insertion', async () => {
    const firstOccurrence = await occurrence(0);
    const secondOccurrence = await occurrence(1);
    const outcomes = await Promise.allSettled([
      f.db.insert(intergalacticConvoyRuns).values(run(firstOccurrence)),
      f.db.insert(intergalacticConvoyRuns).values(run(secondOccurrence)),
    ]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const active = await f.db.select().from(intergalacticConvoyRuns).where(and(
      eq(intergalacticConvoyRuns.planetId, f.planetIds[0]!),
      eq(intergalacticConvoyRuns.status, 'outbound'),
    ));
    expect(active).toHaveLength(1);
  });

  it('requires resolved reward state outside outbound and distinguishes empty awards', async () => {
    const occurrenceId = await occurrence();
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId, {
      status: 'returning',
    }))).rejects.toThrow();
    const [row] = await f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId, {
      status: 'returning',
      resourceReward: { alloy: 0, crystal: 0, deuterium: 0 },
      awardedFleet: {},
    })).returning();
    expect(row?.resourceReward).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect(row?.awardedFleet).toEqual({});
  });

  it('rejects invalid quality, timestamp order and negative resource snapshots', async () => {
    const occurrenceId = await occurrence();
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId, {
      resourceQualityFactor: Number.NaN,
    }))).rejects.toThrow();
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId, {
      engagementEndsAt: f.clock.now(),
    }))).rejects.toThrow();
    await expect(f.db.insert(intergalacticConvoyRuns).values(run(occurrenceId, {
      quotedResourceReward: { alloy: -1, crystal: 0, deuterium: 0 },
    }))).rejects.toThrow();
  });
});
