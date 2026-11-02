import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { analyticsBatchSchema, analyticsEventSchema, analyticsVisitorSchema } from '../../web/src/api/analyticsSchemas.js';

const event = () => ({
  id: randomUUID(), version: 1, name: 'training_scene_visible', source: 'client_observation',
  mode: 'training', contextId: randomUUID(), sessionId: randomUUID(), sequence: 1,
  occurredAt: Date.now(), elapsedMs: 0,
  properties: { scene: 'welcome', trainingVersion: 'flight-school-1' },
});

describe('player analytics wire boundary', () => {
  it('accepts bounded observations but never client-created server facts or identities', () => {
    expect(analyticsEventSchema.safeParse(event()).success).toBe(true);
    for (const extra of [{ source: 'server_fact' }, { accountId: randomUUID() }, { name: 'command_committed' }]) {
      expect(analyticsEventSchema.safeParse({ ...event(), ...extra }).success).toBe(false);
    }
  });
  it('does not accept form contents, arbitrary error messages or non-finite clocks', () => {
    for (const properties of [{ password: 'private' }, { message: 'secret' }, { url: '?token=secret' }]) {
      expect(analyticsEventSchema.safeParse({ ...event(), properties }).success).toBe(false);
    }
    expect(analyticsEventSchema.safeParse({ ...event(), occurredAt: Infinity }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ ...event(), elapsedMs: -1 }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ ...event(), sequence: 2147483648 }).success).toBe(false);
  });
  it('bounds both batch cardinality and UTF-8 payload bytes', () => {
    expect(analyticsBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(analyticsBatchSchema.safeParse({ events: Array.from({ length: 33 }, event) }).success).toBe(false);
    const large = { ...event(), properties: { code: 'c'.repeat(128), scene: 's'.repeat(128), trainingVersion: 'v'.repeat(128),
      surface: 's'.repeat(128), subject: 's'.repeat(128), phase: 'p'.repeat(128), variant: 'v'.repeat(128), refId: randomUUID() } };
    expect(analyticsEventSchema.safeParse(large).success).toBe(true);
    expect(analyticsBatchSchema.safeParse({ events: Array.from({ length: 32 }, () => large) }).success).toBe(false);
  });
  it('requires a versioned scope and limits campaign fields', () => {
    const visit = { policyVersion: 1, scope: 'anonymous', platform: 'web', locale: 'tr', build: 'test',
      contextId: randomUUID(), campaign: { utm_source: 'twitter' } };
    expect(analyticsVisitorSchema.safeParse(visit).success).toBe(true);
    expect(analyticsVisitorSchema.safeParse({ ...visit, scope: 'invalid' }).success).toBe(false);
    expect(analyticsVisitorSchema.safeParse({ ...visit, campaign: { utm_source: 'x'.repeat(129) } }).success).toBe(false);
    expect(analyticsVisitorSchema.safeParse({ ...visit, campaign: { token: 'private' } }).success).toBe(false);
  });
});
