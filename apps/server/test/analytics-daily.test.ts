import { afterAll, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { seedWorld, testDb, type Fixture } from './helpers.js';
import { analyticsDailyAggregates, analyticsEvents, analyticsSessions, analyticsVisitors } from '../src/db/schema.js';
import { refreshDailyAnalytics } from '../src/services/analyticsDaily.js';
let f: Fixture;
beforeEach(async () => { f = await seedWorld(1); });
afterAll(async () => { await (await testDb()).close(); });
it('retains only coarse totals and upserts rather than adding the same observations twice', async () => {
  const visitorId = randomUUID(), sessionId = randomUUID(), contextId = randomUUID(), at = f.clock.now();
  await f.db.insert(analyticsVisitors).values({ id: visitorId, contextId, credentialHash: randomUUID(), createdAt: at, expiresAt: at,
    metadata: { contextId, platform: 'web', locale: 'tr', build: 'test', scope: 'anonymous', policyVersion: 1, campaign: {} } });
  await f.db.insert(analyticsSessions).values({ id: sessionId, visitorId, contextId, firstAt: at, lastAt: at });
  await f.db.insert(analyticsEvents).values({ id: randomUUID(), visitorId, sessionId, source: 'client_observation', mode: 'live',
    name: 'play_clicked', occurredAt: at, receivedAt: at, sequence: 0, timeTrusted: true, payloadHash: 'test', properties: {} });
  await refreshDailyAnalytics(f.db, f.clock); await refreshDailyAnalytics(f.db, f.clock);
  const rows = await f.db.select().from(analyticsDailyAggregates).where(eq(analyticsDailyAggregates.name, 'play_clicked'));
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ events: 1, visitors: 1 });
  expect(JSON.stringify(rows)).not.toContain(visitorId); expect(JSON.stringify(rows)).not.toContain(contextId);
  f.clock.advance(31 * 24 * 60); await refreshDailyAnalytics(f.db, f.clock);
  expect(await f.db.select().from(analyticsDailyAggregates)).toHaveLength(0);
});
