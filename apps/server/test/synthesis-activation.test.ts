import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import type { Db } from '../src/db/client.js';
import { galaxyEventOccurrences, moons, neutralPlanetState, notifications, planets, scheduledEvents, seasons } from '../src/db/schema.js';
import { activeGalaxyEvents, loadGalaxyEventSchedule, nextPublicGalaxyEvent, processGalaxyEventLifecycle } from '../src/services/galaxyEvents.js';
import { createSeason } from '../src/services/season.js';
import { activateSynthesis } from '../src/services/synthesisActivation.js';
import { seasonHasSynthesis } from '../src/services/synthesis.js';
import { joinSettled, makeAccount, testDb, truncateAll } from './helpers.js';

/*
  ASTERYUM OPENS IN THE LIVE SEASON (K12): one explicit instant, never a ruleset bump. From it the season has
  the laboratory, every moon starts making Asteryum from that instant (nothing is minted for the past), and
  the Asteryum Fırtınası joins the galaxy calendar from its next window on.
*/
afterAll(async () => { await (await testDb()).close(); });

describe('activating Asteryum in a live season', () => {
  let db: Db;
  let clock: FixedClock;
  let seasonId: string;

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    clock = new FixedClock(new Date('2026-11-25T19:30:00.000Z')); // 22:30 TRT: today's storm is over
    const { season } = await createSeason(db, { shardCode: 'EU-AST', seed: 9_119, startsAt: new Date('2026-11-20T00:00:00.000Z'), days: 14, rulesetVersion: MOON.rulesetVersion });
    seasonId = season.id;
    await joinSettled(db, (await makeAccount(db, 'Watcher')).id, seasonId, clock);
    const [neutral] = await db.select({ planetId: neutralPlanetState.planetId }).from(neutralPlanetState)
      .innerJoin(planets, eq(planets.id, neutralPlanetState.planetId)).where(eq(planets.seasonId, seasonId)).limit(1);
    await db.delete(moons).where(eq(moons.planetId, neutral!.planetId));
    await db.insert(moons).values({
      planetId: neutral!.planetId, rarity: 'RARE', origin: 'SEED', visualSeed: 1,
      bornAt: new Date('2026-11-20T00:00:00.000Z'), asteriumSyncedAt: new Date('2026-11-20T00:00:00.000Z'), asteriumFraction: 0.4,
    });
  });

  it('reports without writing unless applied', async () => {
    const result = await activateSynthesis(db, { seasonId, clock, apply: false });
    expect(result).toMatchObject({ status: 'READY', applied: false });
    expect(await seasonHasSynthesis(db, seasonId)).toBe(false);
  });

  it('opens from now: no past Asteryum, storms from the next window, and only once', async () => {
    const result = await activateSynthesis(db, { seasonId, clock, apply: true });
    expect(result).toMatchObject({ status: 'ACTIVATED', applied: true });
    expect(await seasonHasSynthesis(db, seasonId)).toBe(true);
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    expect(season!.synthesisStartsAt?.toISOString()).toBe(clock.now().toISOString());
    const stamped = await db.select().from(moons);
    expect(stamped.every((moon) => moon.asteriumSyncedAt.getTime() === clock.now().getTime() && moon.asteriumFraction === 0)).toBe(true);
    const storms = await db.select().from(galaxyEventOccurrences)
      .where(and(eq(galaxyEventOccurrences.seasonId, seasonId), eq(galaxyEventOccurrences.kind, 'ASTERIUM_STORM')));
    expect(storms.length).toBeGreaterThan(0);
    expect(storms.every((storm) => storm.startsAt > clock.now())).toBe(true);
    expect(storms.map((storm) => storm.startsAt.toISOString())).toContain('2026-11-26T18:00:00.000Z');
    const lifecycle = await db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'galaxy_event_start'));
    expect(lifecycle.length).toBeGreaterThanOrEqual(storms.length);
    expect(await activateSynthesis(db, { seasonId, clock, apply: true })).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false });
    expect((await db.select().from(galaxyEventOccurrences).where(eq(galaxyEventOccurrences.kind, 'ASTERIUM_STORM'))).length).toBe(storms.length);
  });
});

/*
  THE STORM RIDES THE GALAXY CALENDAR (plan §3.2, G2): its start and end go through the same lifecycle,
  notice, Chronicle and active-event read as every other public event, and a storm row never breaks
  any reader of the calendar (D47: a lifecycle handler that throws stops the whole event queue).
*/
describe('the Asteryum Fırtınası on the galaxy calendar', () => {
  it('starts, announces, shows as active, ends, and leaves the schedule readable', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-11-25T19:30:00.000Z'));
    const { season } = await createSeason(db, { shardCode: 'EU-STM', seed: 9_120, startsAt: new Date('2026-11-20T00:00:00.000Z'), days: 14, rulesetVersion: MOON.rulesetVersion });
    const account = await makeAccount(db, 'Stormwatch');
    await joinSettled(db, account.id, season.id, clock);
    await activateSynthesis(db, { seasonId: season.id, clock, apply: true });
    const [storm] = await db.select().from(galaxyEventOccurrences)
      .where(and(eq(galaxyEventOccurrences.seasonId, season.id), eq(galaxyEventOccurrences.kind, 'ASTERIUM_STORM')))
      .orderBy(galaxyEventOccurrences.startsAt).limit(1);
    expect(await nextPublicGalaxyEvent(db, account.id, clock)).not.toBeNull();

    clock.set(new Date(storm!.startsAt.getTime() + 60_000));
    await processGalaxyEventLifecycle(db, { occurrenceId: storm!.id, seasonId: season.id, lifecycle: 'start', processedAt: clock.now() });
    const [notice] = await db.select().from(notifications).where(and(eq(notifications.kind, 'galaxy_event_started'), eq(notifications.refId, storm!.id)));
    expect(notice?.payload).toEqual({ eventKind: 'ASTERIUM_STORM', startsAt: storm!.startsAt.toISOString(), endsAt: storm!.endsAt.toISOString() });
    expect(await activeGalaxyEvents(db, account.id, clock)).toContainEqual(
      { id: storm!.id, kind: 'ASTERIUM_STORM', startsAt: storm!.startsAt, endsAt: storm!.endsAt },
    );
    await expect(loadGalaxyEventSchedule(db, season.id, season.startsAt)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'ASTERIUM_STORM' })]));

    clock.set(storm!.endsAt);
    await processGalaxyEventLifecycle(db, { occurrenceId: storm!.id, seasonId: season.id, lifecycle: 'end', processedAt: clock.now() });
    expect(await db.select().from(notifications).where(and(eq(notifications.kind, 'galaxy_event_ended'), eq(notifications.refId, storm!.id)))).toHaveLength(1);
    expect((await activeGalaxyEvents(db, account.id, clock)).map((event) => event.id)).not.toContain(storm!.id);
  });
});

/*
  THE YARIK SAATİ COMES WITH ASTERYUM (owner 2026-11-27): the Yarık opens only in its two daily windows, so a
  season that opens Asteryum gets both of them, and the next-event countdown names them there too, though the
  season's ruleset (20) predates both.
*/
describe('activating Asteryum also deals the Yarık Saati', () => {
  it('adds the daily Yarık Saati from its next window, and the countdown names it', async () => {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-11-25T19:30:00.000Z'));
    const { season } = await createSeason(db, { shardCode: 'EU-RFT', seed: 9_121, startsAt: new Date('2026-11-20T00:00:00.000Z'), days: 14, rulesetVersion: MOON.rulesetVersion });
    const account = await makeAccount(db, 'Riftwatch');
    await joinSettled(db, account.id, season.id, clock);
    const result = await activateSynthesis(db, { seasonId: season.id, clock, apply: true });
    expect(result.riftHours).toBeGreaterThan(0);
    const hours = await db.select().from(galaxyEventOccurrences)
      .where(and(eq(galaxyEventOccurrences.seasonId, season.id), eq(galaxyEventOccurrences.kind, 'RIFT_HOUR')));
    expect(hours).toHaveLength(result.riftHours);
    expect(hours.map((hour) => hour.startsAt.toISOString())).toContain('2026-11-26T14:00:00.000Z');

    clock.set(new Date('2026-11-26T13:59:00.000Z'));
    expect(await nextPublicGalaxyEvent(db, account.id, clock)).toEqual({ kind: 'RIFT_HOUR', startsAt: new Date('2026-11-26T14:00:00.000Z') });
  });
});
