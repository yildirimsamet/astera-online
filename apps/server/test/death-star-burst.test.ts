import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEATH_STAR } from '@astera/rules';
import { maintenanceWindows, missions, neutralPlanetState, notifications, planets, playerResearch, scheduledEvents, strategicAssets, strategicImpacts, units } from '../src/db/schema.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { onColonySecession } from '../src/services/loyalty.js';
import { publicWorlds } from '../src/services/publicGalaxy.js';
import { galaxyTraffic } from '../src/services/traffic.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { giveUnits, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('rapid Death Star launches and independent impacts', () => {
  let f: Fixture;
  let origins: string[];
  let target: string;

  beforeEach(async () => {
    f = await seedWorld(6);
    origins = f.planetIds.slice(0, 4);
    target = f.planetIds[5]!;
    for (const origin of origins) {
      if (origin !== origins[0]) await f.db.update(planets).set({
        kind: 'COLONY', controllerPlayerId: f.playerIds[0]!, statsOwnerPlayerId: f.playerIds[0]!,
      }).where(eq(planets.id, origin));
      await placeAt(f.db, origin, { x: 0 });
      await setLevel(f.db, origin, 'CORE', DEATH_STAR.requiredCore);
      await setLevel(f.db, origin, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    }
    await f.db.update(planets).set({
      kind: 'COLONY', controllerPlayerId: f.playerIds[4]!, statsOwnerPlayerId: f.playerIds[4]!,
    }).where(eq(planets.id, target));
    await setLevel(f.db, f.planetIds[4]!, 'CORE', DEATH_STAR.requiredCore);
    await placeAt(f.db, target, { x: 500 });
    await f.db.insert(playerResearch).values({
      playerId: f.playerIds[0]!, projectId: 'STRATEGIC_STOCKPILE', level: 1, completedAt: f.clock.now(),
    });
  });

  const arm = async (origin: string, count = 1) => {
    await f.db.insert(strategicAssets).values(Array.from({ length: count }, () => ({
      planetId: origin, status: 'READY' as const, startedAt: f.clock.now(), remainingSeconds: 0,
    })));
  };
  /** F0.9 (owner 2026-10-30): an interceptor may meet it anywhere along the leg, so the whole flight must clear a window. */
  it('refuses a strike that would be in the air during a planned maintenance window', async () => {
    await arm(origins[0]!);
    const now = f.clock.now().getTime();
    await f.db.insert(maintenanceWindows).values({
      startsAt: new Date(now + 60_000), endsAt: new Date(now + 20 * 60_000), createdAt: f.clock.now(),
    });
    await expect(launchDeathStar(f.db, origins[0]!, target, f.clock, f.playerIds[0]))
      .rejects.toMatchObject({ code: 'MAINTENANCE_IN_FLIGHT' });
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });

  const arrivals = async (ids: string[]) => f.db.select().from(scheduledEvents)
    .where(and(eq(scheduledEvents.kind, 'mission_arrival'), inArray(scheduledEvents.refId, ids)));
  const world = async () => (await f.db.select().from(planets).where(eq(planets.id, target)))[0]!;
  const release = async () => {
    const [event] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.refId, target), eq(scheduledEvents.status, 'pending'),
    ));
    if (event) await onColonySecession(f, event);
  };

  it('consumes one ready weapon exactly once under concurrent launch requests', async () => {
    await arm(origins[0]!);
    const answers = await Promise.allSettled(Array.from({ length: 5 }, () =>
      launchDeathStar(f.db, origins[0]!, target, f.clock, f.playerIds[0])));
    expect(answers.filter(answer => answer.status === 'fulfilled')).toHaveLength(1);
    for (const answer of answers) if (answer.status === 'rejected') {
      expect(answer.reason).toMatchObject({ code: 'DEATH_STAR_NOT_READY' });
    }
    const launched = await f.db.select().from(missions).where(eq(missions.kind, 'death_star'));
    expect(launched).toHaveLength(1);
  });

  it.each([200, 300, 1000])('retains all five hits and releases a 90-loyalty colony with %i ms launch spacing', async spacing => {
    await arm(origins[0]!, 2);
    for (const origin of origins.slice(1)) await arm(origin);
    const launchOrigins = [origins[0]!, origins[1]!, origins[2]!, origins[3]!, origins[0]!];
    const ids: string[] = [];
    for (const origin of launchOrigins) {
      ids.push((await launchDeathStar(f.db, origin, target, f.clock, f.playerIds[0])).missionId);
      f.clock.advance(spacing / 60_000);
    }
    const events = (await arrivals(ids)).sort((a, b) => a.resolveAt.getTime() - b.resolveAt.getTime());
    expect(events).toHaveLength(5);
    f.clock.set(events[0]!.resolveAt);
    await f.db.update(planets).set({ loyalty: 90, lastTickAt: f.clock.now() }).where(eq(planets.id, target));
    for (const [index, event] of events.entries()) {
      f.clock.set(event.resolveAt);
      await onMissionArrival(f, event);
      expect((await world()).empHits).toBe(index + 1);
    }
    expect((await world()).loyalty).toBe(0);
    f.clock.advance(1 / 60);
    await release();
    expect(await world()).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null, statsOwnerPlayerId: null, empHits: 5 });
    const impacts = await f.db.select().from(strategicImpacts).where(inArray(strategicImpacts.missionId, ids));
    expect(impacts).toHaveLength(5);
    expect(new Set(impacts.map(impact => impact.missionId)).size).toBe(5);
    const contacts = await galaxyTraffic(f.db, f.seasonId, f.planetIds[4]!, f.clock.now(), f.playerIds[4], [f.planetIds[4]!]);
    expect(contacts.filter(contact => ids.includes(contact.id) && contact.impact !== undefined)).toHaveLength(5);
    const defenderNotices = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[4]!), eq(notifications.kind, 'death_star_result'),
    ));
    expect(defenderNotices).toHaveLength(5);
    expect(new Set(defenderNotices.map(notice => notice.refId)).size).toBe(5);
    expect((await world()).empUntil?.getTime()).toBe(events[4]!.resolveAt.getTime() + DEATH_STAR.empMinutes * 60_000);
    // Redelivery after the ownership change must not apply a sixth hit or another loss.
    await Promise.all(events.map(event => onMissionArrival(f, event)));
    await release();
    expect((await world()).empHits).toBe(5);
    expect(await f.db.select().from(notifications).where(and(eq(notifications.playerId, f.playerIds[4]!), eq(notifications.kind, 'death_star_result'))))
      .toHaveLength(5);
    expect(await f.db.select().from(notifications).where(and(eq(notifications.kind, 'colony_lost'), eq(notifications.playerId, f.playerIds[4]!))))
      .toHaveLength(1);
  });

  it('resolves five simultaneous arrivals under competing transactions and deduplicates replay', async () => {
    await arm(origins[0]!, 2);
    for (const origin of origins.slice(1)) await arm(origin);
    const launched = await Promise.all([origins[0]!, ...origins.slice(1), origins[0]!].map(origin =>
      launchDeathStar(f.db, origin, target, f.clock, f.playerIds[0])));
    const events = await arrivals(launched.map(launch => launch.missionId));
    expect(new Set(events.map(event => event.resolveAt.getTime())).size).toBe(1);
    f.clock.set(events[0]!.resolveAt);
    await f.db.update(planets).set({ loyalty: 100, lastTickAt: f.clock.now() }).where(eq(planets.id, target));
    // Same-ETA ordering may defer a transaction; retry it just as the event queue does.
    let remaining = events;
    for (let pass = 0; pass < 5 && remaining.length > 0; pass++) {
      const answers = await Promise.allSettled(remaining.map(event => onMissionArrival(f, event)));
      remaining = remaining.filter((_, index) => answers[index]?.status === 'rejected');
    }
    expect(remaining).toHaveLength(0);
    expect((await world()).empHits).toBe(5);
    expect((await world()).loyalty).toBe(0);
    await release();
    expect((await world()).controllerPlayerId).toBeNull();
    await Promise.all(events.map(event => onMissionArrival(f, event)));
    expect((await world()).empHits).toBe(5);
    const publicTarget = (await publicWorlds(f.db, f.seasonId, f.clock.now())).find(planet => planet.id === target);
    expect(publicTarget?.state).toMatchObject({ kind: 'EMP', hits: 5 });
  });

  it.each([200, 300, 1000])('releases a full-loyalty colony after five hits spaced %i ms apart despite tiny regeneration', async spacing => {
    await arm(origins[0]!, 2);
    for (const origin of origins.slice(1)) await arm(origin);
    const ids: string[] = [];
    for (const origin of [origins[0]!, ...origins.slice(1), origins[0]!]) {
      ids.push((await launchDeathStar(f.db, origin, target, f.clock, f.playerIds[0])).missionId);
      f.clock.advance(spacing / 60_000);
    }
    const events = (await arrivals(ids)).sort((a, b) => a.resolveAt.getTime() - b.resolveAt.getTime());
    f.clock.set(events[0]!.resolveAt);
    await f.db.update(planets).set({ loyalty: 100, lastTickAt: f.clock.now() }).where(eq(planets.id, target));
    for (const event of events) { f.clock.set(event.resolveAt); await onMissionArrival(f, event); }
    expect((await world()).empHits).toBe(5);
    expect((await world()).loyalty).toBe(0);
    await release();
    expect((await world()).controllerPlayerId).toBeNull();
  });

  it('releases a colony after four hits when its initial loyalty is seventy', async () => {
    await giveUnits(f.db, target, { DART: 3 });
    const defenderCapital = f.planetIds[4]!;
    const [before] = await f.db.select().from(units).where(and(eq(units.planetId, defenderCapital), eq(units.hull, 'DART'), eq(units.location, 'home')));
    for (const origin of origins) await arm(origin);
    const launched = await Promise.all(origins.map(origin => launchDeathStar(f.db, origin, target, f.clock, f.playerIds[0])));
    const events = (await arrivals(launched.map(launch => launch.missionId))).sort((a, b) => (a.refId ?? '').localeCompare(b.refId ?? ''));
    f.clock.set(events[0]!.resolveAt);
    await f.db.update(planets).set({ loyalty: 70, lastTickAt: f.clock.now() }).where(eq(planets.id, target));
    for (const event of events) await onMissionArrival(f, event);
    f.clock.advance(1 / 60);
    await release();
    expect(await world()).toMatchObject({ kind: 'NEUTRAL', controllerPlayerId: null, statsOwnerPlayerId: null, empHits: 4 });
    expect(await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, target))).toHaveLength(1);
    const [returned] = await f.db.select().from(units).where(and(eq(units.planetId, defenderCapital), eq(units.hull, 'DART'), eq(units.location, 'home')));
    expect(returned?.count).toBe((before?.count ?? 0) + 3);
    expect(await f.db.select().from(units).where(and(eq(units.planetId, target), eq(units.hull, 'DART'), eq(units.location, 'home')))).toHaveLength(0);
  });

  it('starts a fresh scar count after the prior EMP expires and leaves protected misses unchanged', async () => {
    await f.db.update(planets).set({ empHits: 5, empUntil: f.clock.now() }).where(eq(planets.id, target));
    await arm(origins[0]!, 2);
    const first = await launchDeathStar(f.db, origins[0]!, target, f.clock, f.playerIds[0]);
    const [event] = await arrivals([first.missionId]);
    f.clock.set(first.arriveAt);
    await onMissionArrival(f, event!);
    expect((await world()).empHits).toBe(1);
    const second = await launchDeathStar(f.db, origins[0]!, target, f.clock, f.playerIds[0]);
    const [miss] = await arrivals([second.missionId]);
    f.clock.set(second.arriveAt);
    await f.db.update(planets).set({ protectedUntil: new Date(f.clock.now().getTime() + 60_000) }).where(eq(planets.id, target));
    await onMissionArrival(f, miss!);
    expect((await world()).empHits).toBe(1);
    const [impact] = await f.db.select().from(strategicImpacts).where(eq(strategicImpacts.missionId, second.missionId));
    expect(impact?.outcome).toBe('INEFFECTIVE');
  });

  it.each([20.005, 20.01, 20.02])('only clears sub-hundredth loyalty residue after a hit from %f loyalty', async loyalty => {
    await arm(origins[0]!);
    const launched = await launchDeathStar(f.db, origins[0]!, target, f.clock, f.playerIds[0]);
    const [event] = await arrivals([launched.missionId]);
    f.clock.set(launched.arriveAt);
    await f.db.update(planets).set({ loyalty, lastTickAt: f.clock.now() }).where(eq(planets.id, target));
    await onMissionArrival(f, event!);
    if (loyalty <= 20.01) {
      expect((await world()).loyalty).toBe(0);
      await release();
      expect((await world()).controllerPlayerId).toBeNull();
    } else {
      expect((await world()).loyalty).toBeCloseTo(0.02, 4);
      expect((await world()).controllerPlayerId).toBe(f.playerIds[4]);
    }
  });
});
