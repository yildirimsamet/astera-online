import { describe, expect, it } from 'vitest';
import { DatabasePoolProbe, type ReservablePool } from '../src/services/databasePoolProbe.js';
import { RuntimeMetrics } from '../src/services/runtimeMetrics.js';

describe('database pool capacity telemetry', () => {
  it('measures a real reservation and releases it immediately', async () => {
    const metrics = new RuntimeMetrics();
    let releases = 0;
    const pool: ReservablePool = {
      reserve: () => Promise.resolve({ release: () => { releases += 1; } }),
    };
    const probe = new DatabasePoolProbe(pool, metrics);

    await probe.sample();

    expect(metrics.status().databasePool).toMatchObject({
      acquireErrors: 0,
      acquireMs: { samples: 1 },
    });
    expect(releases).toBe(1);
    await probe.stop();
    metrics.close();
  });

  it('coalesces samples while the pool is saturated and counts failures', async () => {
    const metrics = new RuntimeMetrics();
    let reservations = 0;
    let rejectReservation: ((reason: Error) => void) | null = null;
    const blocked = new Promise<never>((_resolve, reject) => {
      rejectReservation = reject;
    });
    const pool: ReservablePool = {
      reserve: () => {
        reservations += 1;
        return blocked;
      },
    };
    const probe = new DatabasePoolProbe(pool, metrics);

    const first = probe.sample();
    const second = probe.sample();
    expect(reservations).toBe(1);
    rejectReservation!(new Error('pool unavailable'));
    await Promise.all([first, second]);

    expect(metrics.status().databasePool).toMatchObject({
      acquireErrors: 1,
      acquireMs: { samples: 0 },
    });
    await probe.stop();
    metrics.close();
  });
});

describe('route and operation telemetry', () => {
  it('counts response statuses, refusal reasons, and idempotent outcomes without player data', () => {
    const metrics = new RuntimeMetrics();
    const route = '/api/intergalactic-convoy/launch';

    metrics.observeRoute('POST', route, 200, 12, 512);
    metrics.observeRoute('POST', route, 409, 4, 96);
    metrics.observeRefusal('POST', route, 'CONVOY_QUOTE_CHANGED');
    metrics.observeOperation('intergalactic-convoy.launch', 'accepted');
    metrics.observeOperation('intergalactic-convoy.launch', 'replay');

    const status = metrics.status();
    expect(status.routes[`POST ${route}`]).toMatchObject({
      requests: 2,
      errors: 0,
      responseStatuses: { 200: 1, 409: 1 },
    });
    expect(status.refusals[`POST ${route}`]).toEqual({ CONVOY_QUOTE_CHANGED: 1 });
    expect(status.operations['intergalactic-convoy.launch']).toEqual({ accepted: 1, replay: 1 });
    metrics.close();
  });
});
