import { describe, expect, it } from 'vitest';
import { anythingInFlight } from '../src/galaxy/flightRate.js';

/**
 * WHAT COUNTS AS "SOMETHING IN THE AIR". Owner instruction, 2026-09-19: drills,
 * probes and fleets cross the disc at thirty frames a second. A pirate going round
 * its orbit is scenery that is always there — counting it would hold thirty for
 * the whole session and the ambient floor would never apply.
 */
const idle = { pending: [], runs: [], contacts: [] };

describe('anything in flight', () => {
  it('is nothing on a quiet disc', () => {
    expect(anythingInFlight(idle)).toBe(false);
  });

  it('is your own fleet or probe on its way', () => {
    expect(anythingInFlight({ ...idle, pending: [{ path: {} }] })).toBe(true);
    // A thread with no path is a warning, not a craft on the disc.
    expect(anythingInFlight({ ...idle, pending: [{}] })).toBe(false);
  });

  it('is your own drill out, until it is home', () => {
    expect(anythingInFlight({ ...idle, runs: [{ status: 'outbound' }] })).toBe(true);
    expect(anythingInFlight({ ...idle, runs: [{ status: 'returning' }] })).toBe(true);
    expect(anythingInFlight({ ...idle, runs: [{ status: 'done' }] })).toBe(false);
  });

  it.each(['fleet', 'probe', 'mining', 'harvest', 'unknown', 'death_star'])(
    'is somebody else’s %s crossing the disc',
    (kind) => {
      expect(anythingInFlight({ ...idle, contacts: [{ kind }] })).toBe(true);
    },
  );

  it('is not a pirate on its orbit, nor a battle that is only a flash', () => {
    expect(anythingInFlight({ ...idle, contacts: [{ kind: 'pirate' }] })).toBe(false);
    expect(anythingInFlight({ ...idle, contacts: [{ kind: 'fleet', effectOnly: true }] })).toBe(false);
  });
});
