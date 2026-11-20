import { describe, expect, it } from 'vitest';
import { planetSchema } from '../src/api/schemas.js';
import { worksAt } from '../src/lib/projection.js';
import { planetView } from './fixtures.js';

/** Kuruluş Saati at the client (plan 2026-11-20 §5.1): the works fill as the server fills them. */
describe('the newcomer hour at the client boundary', () => {
  it('parses the hour\'s end, and reads a server that does not send it as no hour', () => {
    const base = planetView();
    const at = new Date('2026-11-20T10:00:00Z');
    const parsed = planetSchema.parse(JSON.parse(JSON.stringify({ ...base, planet: { ...base.planet, newcomerBoostUntil: at } })));
    expect(parsed.planet.newcomerBoostUntil).toEqual(at);
    expect(planetSchema.parse(JSON.parse(JSON.stringify(base))).planet.newcomerBoostUntil ?? null).toBeNull();
  });

  it('fills the alloy and crystal works five-fold until the hour ends, and the deuterium works at their rate', () => {
    const at = new Date('2026-11-20T10:00:00Z');
    const planet = { ...planetView().planet, snapshotAt: at, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
      deuteriumPerHour: 30, bufferDeuteriumCap: 10_000, newcomerBoostUntil: new Date(at.getTime() + 30 * 60_000) };
    const projected = worksAt(planet, at.getTime(), at.getTime() + 3_600_000);
    // Half an hour at five-fold, half an hour at the rate.
    expect(projected.bufferAlloy).toBeCloseTo(planet.alloyPerHour * 3, 6);
    expect(projected.bufferCrystal).toBeCloseTo(planet.crystalPerHour * 3, 6);
    expect(projected.bufferDeuterium).toBeCloseTo(30, 6);
  });
});
