import { describe, expect, it } from 'vitest';
import { planetSchema } from '../src/api/schemas.js';
import { worksAt } from '../src/lib/projection.js';
import { planetView } from './fixtures.js';

describe('unknown signal production window at the client boundary', () => {
  it('parses a separate signal deadline and preserves the recovery deadline', () => {
    const base = planetView();
    const at = new Date('2026-10-17T09:00:00Z');
    const parsed = planetSchema.parse(JSON.parse(JSON.stringify({ ...base, planet: {
      ...base.planet, signalBoostUntil: at, productionBoostUntil: at,
    } })));
    expect(parsed.planet.signalBoostUntil).toEqual(at);
    expect(parsed.planet.productionBoostUntil).toEqual(at);
  });

  it.each([false, true])('projects the signal bonus additively with recovery=%s', recovery => {
    const at = new Date('2026-10-17T09:00:00Z');
    const planet = { ...planetView().planet, snapshotAt: at, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
      signalBoostUntil: new Date(at.getTime() + 3_600_000),
      productionBoostUntil: recovery ? new Date(at.getTime() + 3_600_000) : null };
    const projected = worksAt(planet, at.getTime(), at.getTime() + 3_600_000);
    expect(projected.bufferAlloy).toBeCloseTo(planet.alloyPerHour * (recovery ? 2.5 : 2), 6);
    expect(projected.bufferCrystal).toBeCloseTo(planet.crystalPerHour * (recovery ? 2.5 : 2), 6);
  });
});
