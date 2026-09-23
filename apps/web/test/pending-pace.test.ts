import { describe, expect, it } from 'vitest';
import { pendingSchema } from '../src/api/schemas.js';

/**
 * THE PACE A FLIGHT FLIES AT. Spec S1 (docs/ui-v2/gozlemevi.md).
 *
 * The server states it on your own craft (`missions.pace`, 1 = full speed) so the
 * Fleet page can label a slowed flight. Optional: an inbound attack never carries
 * it, and a server that predates the field must still parse.
 */
describe('the pace on a pending thread', () => {
  const thread = { kind: 'fleet', targetName: 'Kestrel', minutesRemaining: 9, arriveAt: '2026-09-23T12:09:00Z' };

  it('reads the pace the server sends on your own flight', () => {
    const parsed = pendingSchema.parse({ pending: [{ ...thread, pace: 0.5 }] });
    expect(parsed.pending[0]!.pace).toBe(0.5);
  });

  it('parses a thread without one', () => {
    expect(pendingSchema.parse({ pending: [thread] }).pending[0]!.pace).toBeUndefined();
  });

  it('refuses a pace that is no speed at all', () => {
    expect(() => pendingSchema.parse({ pending: [{ ...thread, pace: 0 }] })).toThrow();
    expect(() => pendingSchema.parse({ pending: [{ ...thread, pace: 1.5 }] })).toThrow();
  });
});
