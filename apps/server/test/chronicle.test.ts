import { eq } from 'drizzle-orm';
import { SEASON } from '@astera/rules';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import {
  galaxyEvents,
  scheduledEvents,
  seasons,
  type GalaxyEventPayload,
} from '../src/db/schema.js';
import { publicPlanetIdentity, readChronicle, recordGalaxyEvent } from '../src/services/chronicle.js';
import { upgradeBuilding } from '../src/services/build.js';
import { ensureSeasonActs } from '../src/services/season.js';
import { grant, seedWorld, settleBuilds, setLevel, testDb, type Fixture } from './helpers.js';
import { EventWorker } from '../src/worker/loop.js';

const silent = pino({ level: 'silent' });

const publicPlanetName = (payload: GalaxyEventPayload): string => {
  if (!('planetName' in payload)) throw new Error('expected a public planet identity payload');
  return payload.planetName;
};

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('Galaxy Chronicle', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2);
  });

  async function record(refId: string, occurredAt: Date) {
    await f.db.transaction(async (tx) => {
      const identity = await publicPlanetIdentity(tx, f.planetIds[1]!);
      expect(identity).toBeDefined();
      await recordGalaxyEvent(tx, {
        seasonId: f.seasonId,
        kind: 'bombardment',
        refId,
        subjectPlanetId: f.planetIds[1]!,
        payload: identity!,
        occurredAt,
      });
    });
  }

  it('keeps one public snapshot per source and exposes no combat intel', async () => {
    await record('mission-1', f.clock.now());
    await record('mission-1', f.clock.now());

    const page = await readChronicle(f.db, f.accountIds[0]!, f.clock, 30);
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({
      kind: 'bombardment',
      subjectPlanetId: f.planetIds[1],
      payload: { commanderName: 'Tester1' },
    });
    expect(typeof publicPlanetName(page.events[0]!.payload)).toBe('string');
    expect(Object.keys(page.events[0]!.payload).sort()).toEqual(['commanderName', 'planetName']);
  });

  it('reads only the last 24 hours and cursor-pages same-instant rows without loss', async () => {
    await record('expired', new Date(f.clock.now().getTime() - 24 * 60 * 60_000 - 1));
    for (const ref of ['a', 'b', 'c']) await record(ref, f.clock.now());

    const first = await readChronicle(f.db, f.accountIds[0]!, f.clock, 2);
    expect(first.events).toHaveLength(2);
    expect(first.nextBefore).not.toBeNull();
    const second = await readChronicle(f.db, f.accountIds[0]!, f.clock, 2, first.nextBefore!);
    expect(second.events).toHaveLength(1);
    expect(new Set([...first.events, ...second.events].map((event) => event.id))).toHaveLength(3);
  });

  it('records only a public Core tier crossing, not every Core level', async () => {
    await grant(f.db, f.planetIds[0]!, 500_000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 5);

    await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock); // 5 → 6, still tier 2
    await settleBuilds(f, f.planetIds[0]);
    expect(await f.db.select().from(galaxyEvents)).toHaveLength(0);
    await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock); // 6 → 7, tier 3
    await settleBuilds(f, f.planetIds[0]);

    const [event] = await f.db.select().from(galaxyEvents).where(eq(galaxyEvents.kind, 'core_tier'));
    expect(event).toMatchObject({
      subjectPlanetId: f.planetIds[0],
      payload: { commanderName: 'Tester0', tier: 3 },
    });
    expect(typeof publicPlanetName(event!.payload)).toBe('string');
  });

  it('repairs missing live-season Act beats after the enum migration, exactly once', async () => {
    await f.db
      .delete(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_act'));

    expect(await ensureSeasonActs(f.db)).toBe(3);
    expect(await ensureSeasonActs(f.db)).toBe(0);

    const [season] = await f.db
      .select({ startsAt: seasons.startsAt, endsAt: seasons.endsAt })
      .from(seasons)
      .where(eq(seasons.id, f.seasonId));
    const acts = await f.db
      .select({ payload: scheduledEvents.payload, resolveAt: scheduledEvents.resolveAt })
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_act'))
      .orderBy(scheduledEvents.resolveAt);
    const duration = season!.endsAt.getTime() - season!.startsAt.getTime();
    expect(acts).toHaveLength(3);
    expect(acts.map((event) => event.payload?.act)).toEqual(
      SEASON.actBoundaries.map((act) => act.id),
    );
    expect(acts.map((event) => event.resolveAt.getTime())).toEqual(
      SEASON.actBoundaries.map((act) => season!.startsAt.getTime() + duration * act.share),
    );
  });

  it('publishes each scheduled season act at its authored instant exactly once', async () => {
    const [war] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_act'))
      .orderBy(scheduledEvents.resolveAt)
      .limit(1);
    expect(war).toBeDefined();
    f.clock.set(war!.resolveAt);
    const worker = new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      silent,
    );
    await worker.tick();
    await worker.tick();

    const events = await f.db.select().from(galaxyEvents).where(eq(galaxyEvents.kind, 'season_act'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      subjectPlanetId: null,
      payload: { act: 'war' },
      occurredAt: war!.resolveAt,
    });
  });
});
