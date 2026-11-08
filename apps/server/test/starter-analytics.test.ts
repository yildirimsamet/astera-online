import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyticsEvents, botProfiles, vesselMissions, vesselNotifications, vesselOrders, vessels } from '../src/db/schema.js';
import { recoverAnalyticsCommands } from '../src/services/analyticsFacts.js';
import { flushServerAnalytics } from '../src/services/analyticsServerFacts.js';
import { purgeAnalytics, revokeAnalyticsVisitor } from '../src/services/playerAnalytics.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, pass, post, siteOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

const MINER = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3 };
const opaque = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');

/**
 * THE SHIP'S ORDERS ARE MEASURED THE WAY A WORLD'S ARE (plan 2026-11-08 F1). An order the player
 * gave is accepted once, at the moment it was given, under the row's own id; its result is recorded
 * under the same id, so the chain order → result → viewed is read by server ids.
 */
describe('a colony ship order, from acceptance to result', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld({ ANALYTICS_ENABLED: 'true' }); });
  afterEach(async () => { await world.built.close(); });

  const visit = async (headers: Record<string, string>) => {
    const answer = await world.app.inject({ method: 'POST', url: '/api/analytics/visitors', headers, payload: {
      scope: 'player', policyVersion: 1, contextId: randomUUID(), platform: 'web', locale: 'tr', build: 'test', campaign: {} } });
    return answer.json<{ credential: string; visitorId: string }>();
  };
  const facts = (name: string) => world.f.db.select().from(analyticsEvents).where(and(eq(analyticsEvents.name, name), eq(analyticsEvents.source, 'server_fact')));
  const recover = async () => { await recoverAnalyticsCommands(world.f.db, world.f.clock); await recoverAnalyticsCommands(world.f.db, world.f.clock); };

  it('accepts a repair once, at the moment it was ordered, and records its end under the same id', async () => {
    const me = await aboard(world, 'Me');
    await enrich(world, me.vesselId);
    const { credential, visitorId } = await visit(me.headers);
    const attemptId = randomUUID(), orderedAt = world.f.clock.now();
    const headers = { ...me.headers, 'x-analytics-visitor': credential, 'x-analytics-attempt': attemptId };
    expect((await post(world, '/api/starter/repair', headers, { module: 'REFINERY', stage: 2 })).statusCode).toBe(200);
    const [order] = await world.f.db.select().from(vesselOrders).where(eq(vesselOrders.vesselId, me.vesselId));
    await recover();
    const accepted = await facts('command_accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ id: order!.id, accountId: me.id, visitorId, playerId: null, seasonId: null, occurredAt: orderedAt,
      properties: { subject: 'VESSEL_CONSTRUCTION', code: 'REFINERY:2', count: 1, refId: order!.id, attemptId } });
    expect(await facts('outcome_resolved')).toHaveLength(0);

    await pass(world, 24 * 60);
    await recover();
    const resolved = await facts('outcome_resolved');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ accountId: me.id, visitorId, occurredAt: order!.readyAt,
      properties: { subject: 'VESSEL_CONSTRUCTION', code: 'REPAIR_DONE', refId: order!.id, phase: 'result_recorded', attemptId } });
  });

  it('measures nothing for a player who gave no permission, and never refuses the order for it', async () => {
    const me = await aboard(world, 'Me');
    await enrich(world, me.vesselId);
    expect((await post(world, '/api/starter/repair', me.headers, { module: 'REFINERY', stage: 2 })).statusCode).toBe(200);
    expect((await post(world, '/api/starter/repair', { ...me.headers, 'x-analytics-visitor': 'x'.repeat(43) }, { module: 'EXTRACTOR', stage: 1 })).statusCode).toBe(200);
    await pass(world, 24 * 60);
    await recover();
    expect(await world.f.db.select().from(analyticsEvents)).toHaveLength(0);
    const orders = await world.f.db.select().from(vesselOrders).where(eq(vesselOrders.vesselId, me.vesselId));
    expect(orders.every(order => order.analyticsVisitHash === null && order.orderedAt !== null)).toBe(true);
  });

  it('keeps out a ship whose account is not a person', async () => {
    const me = await aboard(world, 'Me');
    await enrich(world, me.vesselId);
    const { credential } = await visit(me.headers);
    await world.f.db.insert(botProfiles).values({ accountId: me.id, ordinal: 900_001, persona: 'steady', nextActionAt: world.f.clock.now(), createdAt: world.f.clock.now() });
    expect((await post(world, '/api/starter/repair', { ...me.headers, 'x-analytics-visitor': credential }, { module: 'REFINERY', stage: 2 })).statusCode).toBe(200);
    await recover();
    expect(await facts('command_accepted')).toHaveLength(0);
  });

  it('counts a mining run from its launch and records what really came home', async () => {
    const me = await aboard(world, 'Me', MINER);
    await arm(world, me.vesselId, { PROSPECTOR: 2 });
    await enrich(world, me.vesselId, 100, 100, 0);
    const { credential } = await visit(me.headers);
    const headers = { ...me.headers, 'x-analytics-visitor': credential };
    const rock = await siteOf(world, 'ASTEROID');
    const launchedAt = world.f.clock.now();
    expect((await post(world, '/api/starter/mining/launch', headers, { asteroidId: opaque(rock.id), craft: 1 })).statusCode).toBe(200);
    const [run] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    // The works are full of Alloy: whatever Alloy the run brings home has nowhere to go.
    await world.f.db.update(vessels).set({ bufferAlloy: 1_000_000 }).where(eq(vessels.id, me.vesselId));
    await pass(world, 60);
    await recover();
    const accepted = await facts('command_accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ occurredAt: launchedAt, properties: { subject: 'VESSEL_MINE', code: 'MINE', refId: run!.id } });
    const [home] = await world.f.db.select().from(vesselNotifications).where(and(eq(vesselNotifications.refId, run!.id), eq(vesselNotifications.kind, 'FLEET_HOME')));
    const payload = home!.payload as { cargo: Record<'alloy' | 'crystal' | 'deuterium', number>; wasted: Record<'alloy' | 'crystal' | 'deuterium', number> };
    const sum = (r: Record<'alloy' | 'crystal' | 'deuterium', number>) => r.alloy + r.crystal + r.deuterium;
    expect(payload.wasted.alloy).toBeGreaterThan(0);
    const resolved = await facts('outcome_resolved');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.properties).toMatchObject({ subject: 'VESSEL_MINE', code: 'FLEET_HOME', refId: run!.id,
      count: Math.round(sum(payload.wasted)), value: Math.round(sum(payload.cargo) - sum(payload.wasted)) });
  });

  it('keeps the launch as the moment of the order when the run is called back', async () => {
    const me = await aboard(world, 'Me', MINER);
    await arm(world, me.vesselId, { PROSPECTOR: 2 });
    const { credential } = await visit(me.headers);
    const headers = { ...me.headers, 'x-analytics-visitor': credential };
    const rock = await siteOf(world, 'ASTEROID');
    const launchedAt = world.f.clock.now();
    expect((await post(world, '/api/starter/mining/launch', headers, { asteroidId: opaque(rock.id), craft: 1 })).statusCode).toBe(200);
    const [run] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    world.f.clock.set(new Date(launchedAt.getTime() + (run!.arriveAt.getTime() - launchedAt.getTime()) / 2));
    expect((await post(world, `/api/starter/mining/runs/${run!.id}/recall`, headers)).statusCode).toBe(200);
    await recover();
    const accepted = await facts('command_accepted');
    expect(accepted.find(fact => fact.properties.refId === run!.id)?.occurredAt).toEqual(launchedAt);
  });

  it('confirms a collect from its answer, as an action with no row of its own', async () => {
    const me = await aboard(world, 'Me');
    const { credential } = await visit(me.headers);
    const attemptId = randomUUID();
    expect((await post(world, '/api/starter/collect', { ...me.headers, 'x-analytics-visitor': credential, 'x-analytics-attempt': attemptId })).statusCode).toBe(200);
    await flushServerAnalytics(world.app);
    const accepted = await facts('command_accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.properties).toMatchObject({ code: 'collect', phase: 'response_confirmed', attemptId });
  });

  it('forgets the visit behind an order when that permission is withdrawn, and after the retention window', async () => {
    const me = await aboard(world, 'Me', MINER);
    await arm(world, me.vesselId, { PROSPECTOR: 2 });
    await enrich(world, me.vesselId);
    const { credential } = await visit(me.headers);
    const headers = { ...me.headers, 'x-analytics-visitor': credential, 'x-analytics-attempt': randomUUID() };
    expect((await post(world, '/api/starter/repair', headers, { module: 'EXTRACTOR', stage: 1 })).statusCode).toBe(200);
    const rock = await siteOf(world, 'ASTEROID');
    expect((await post(world, '/api/starter/mining/launch', headers, { asteroidId: opaque(rock.id), craft: 1 })).statusCode).toBe(200);
    const traced = async () => [
      ...(await world.f.db.select({ hash: vesselOrders.analyticsVisitHash, attempt: vesselOrders.analyticsAttemptId }).from(vesselOrders).where(eq(vesselOrders.vesselId, me.vesselId))),
      ...(await world.f.db.select({ hash: vesselMissions.analyticsVisitHash, attempt: vesselMissions.analyticsAttemptId }).from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId))),
    ];
    expect((await traced()).every(row => row.hash !== null && row.attempt !== null)).toBe(true);
    await revokeAnalyticsVisitor(world.f.db, credential);
    expect((await traced()).every(row => row.hash === null && row.attempt === null)).toBe(true);

    const again = await visit(me.headers);
    expect((await post(world, '/api/starter/repair', { ...me.headers, 'x-analytics-visitor': again.credential }, { module: 'EXTRACTOR', stage: 2 })).statusCode).toBe(200);
    world.f.clock.advance(30 * 24 * 60);
    await purgeAnalytics(world.f.db, world.f.clock);
    expect((await traced()).every(row => row.hash === null)).toBe(true);
  });
});
