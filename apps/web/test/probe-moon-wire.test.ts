import { describe, expect, it } from 'vitest';
import { intelSchema } from '../src/api/schemas.js';

/*
  LIVE BUG 2026-11-24: the server writes a probe's moon reading as `ProbeMoonReading`
  (apps/server/src/db/schema.ts) — the band is `fleet`. The client's schema asked for `fleetSize`,
  so the first probe of a world with a moon failed the whole /api/intel parse and the Intel tab broke.
  This payload is the server's wire shape, byte for byte, not the client's idea of it.
*/
const wireReport = {
  missionId: 'm1', targetPlanetId: 'them', spatiallyCurrent: true, targetName: 'Vega', targetUsername: 'Ali',
  at: '2026-11-24T10:00:00.000Z', accuracy: 0.8, detected: false,
  stock: { low: 100, high: 200 }, deuteriumStock: null, defence: { low: 10, high: 14 },
  fleetSize: { low: 20, high: 30 }, fleetHome: true, deathStar: 'UNKNOWN',
  moon: {
    rarity: 'COMMON', cracks: 0, lastHitAt: null, closedUntil: null,
    gateReadyAt: '2026-11-24T12:00:00.000Z', fleet: { low: 5, high: 9 }, hopping: false,
  },
};
const wire = {
  watching: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  probeReports: [wireReport],
};

describe('a probe report with a moon reading, as the server sends it', () => {
  it('parses, and the moon band reaches the client as fleetSize', () => {
    const parsed = intelSchema.parse(JSON.parse(JSON.stringify(wire)));
    expect(parsed.probeReports[0]!.moon).toMatchObject({
      rarity: 'COMMON', fleetSize: { low: 5, high: 9 }, hopping: false, gateReadyAt: new Date('2026-11-24T12:00:00.000Z'),
    });
  });

  it('still parses a report read before moons existed', () => {
    const { moon: _moon, ...old } = wireReport;
    expect(intelSchema.parse({ ...wire, probeReports: [old] }).probeReports[0]!.moon).toBeUndefined();
  });
});
