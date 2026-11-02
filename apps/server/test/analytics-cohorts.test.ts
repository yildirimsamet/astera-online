import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { analyticsEvents, analyticsSessions, analyticsVisitors } from '../src/db/schema.js';
import { seedWorld, testDb } from './helpers.js';
import { analyticsCohorts } from '../src/services/analyticsCohorts.js';
afterAll(async () => { await (await testDb()).close(); });

it('attributes retention to the first observed ready build, follows returns across builds and excludes continuous sessions from returns', async () => {
  const f = await seedWorld(4), start = f.clock.now(), hour = 3600000;
  async function context(index: number, build: string, offset = 0) {
    const visitorId = randomUUID(), contextId = randomUUID(), sessionId = randomUUID(), at = new Date(start.getTime() + offset);
    await f.db.insert(analyticsVisitors).values({ id: visitorId, contextId, accountId: f.accountIds[index], credentialHash: randomUUID(),
      createdAt: at, expiresAt: new Date(at.getTime() + 86400000), metadata: { contextId, scope: 'anonymous', policyVersion: 1, platform: 'web',
        build, locale: 'tr', campaign: { utm_source: 'twitter' } } });
    await f.db.insert(analyticsSessions).values({ id: sessionId, contextId, visitorId, accountId: f.accountIds[index], firstAt: at, lastAt: at });
    return async (offsets: number[], name = 'game_ready') => {
      await f.db.insert(analyticsEvents).values(offsets.map((offset, sequence) => ({ id: randomUUID(), visitorId, sessionId,
        accountId: f.accountIds[index], name, mode: 'live' as const, source: 'client_observation' as const, sequence,
        occurredAt: new Date(start.getTime() + offset), receivedAt: new Date(start.getTime() + offset), timeTrusted: true, payloadHash: randomUUID(), properties: {} })));
    };
  }
  await (await context(0, 'v1'))([0]);
  await (await context(0, 'v2', 25 * hour))([25 * hour]);
  const ongoing = await context(1, 'v1'); await ongoing([0]);
  await ongoing(Array.from({ length: 75 }, (_, index) => (index + 1) * 20 * 60000), 'interaction');
  await ongoing([25 * hour]);
  await (await context(2, 'v1', 24 * hour))([24 * hour]);
  await (await context(3, 'v1'))([0], 'training_started');
  const now = new Date(start.getTime() + 48 * hour);
  const rows = await analyticsCohorts(f.db, start, now, sql`SELECT id FROM analytics_visitors`);
  expect(rows.find(row => row.build === 'v1')).toMatchObject({ visits: 4, accounts: 4, anchorAccounts: 3,
    retention: { d1: { mature: 2, returned: 1, pending: 1 }, d7: { mature: 0, returned: 0, pending: 3 } } });
  expect(rows.find(row => row.build === 'v2')).toMatchObject({ visits: 1, accounts: 1, anchorAccounts: 0,
    retention: { d1: { mature: 0, returned: 0, pending: 0 } } });
});
