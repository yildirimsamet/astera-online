import { beforeEach, describe, expect, it } from 'vitest';
import { planetSchema, type PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { factorLabel, hostFactor } from '../src/lib/supportFactor.js';
import { planetView } from './fixtures.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the Dominion factor where the host reads it (owner, 2026-10-02):
 * said so a real effect never reads "×1", and measured against the line the battle would
 * actually field — guns a Core outage or an EMP has silenced do not fire.
 */

const NOW = Date.parse('2026-10-02T12:00:00Z');

function world(over: Record<string, unknown> = {}, planetOver: Record<string, unknown> = {}): PlanetView {
  const base = planetView({ fleet: { DART: 40 }, ground: { BASTION: 10 } });
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...base,
    ...over,
    planet: { ...base.planet, ...planetOver },
    rulesetVersion: 15,
    clanSupport: {
      room: { used: 0, reserved: 0, total: 470 },
      waves: [{
        id: 'w', status: 'STATIONED', sender: { playerId: 'a', name: 'A' }, host: { playerId: 'h', name: 'H' },
        originPlanetId: 'o', hostPlanetId: 'h', hostPlanetName: 'H', fleet: { DART: 40 }, bulk: 80, damaged: false,
        sentAt: new Date(NOW - 3_600_000).toISOString(), arriveAt: new Date(NOW - 1_800_000).toISOString(),
        stationedAt: new Date(NOW - 1_800_000).toISOString(), expiresAt: new Date(NOW + 3_600_000).toISOString(),
        returnAt: null, returnReason: null, outOfBand: false, battles: 0,
      }],
    },
  })));
}

describe('the factor as a figure', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('drops a whole factor’s decimals and keeps one otherwise', () => {
    expect(factorLabel(2)).toBe('2');
    expect(factorLabel(1.333)).toBe('1.3');
    expect(factorLabel(5)).toBe('5');
  });

  it('never rounds a real effect down to ×1', () => {
    expect(factorLabel(1.04)).toBe('1.04');
    expect(factorLabel(1.001)).toBe('1');
  });
});

describe('the factor against the line that would fire', () => {
  it('counts the guns while the Core runs', () => {
    const online = hostFactor(world(), NOW);
    expect(online).toBeGreaterThan(1);
    expect(online).toBeLessThan(2);
  });

  it('leaves silenced guns out — a Core outage, or an EMP still running', () => {
    const online = hostFactor(world(), NOW);
    const outage = hostFactor(world({
      faults: [{ id: 'f', kind: 'CORE_OUTAGE', startedAt: new Date(NOW - 60_000).toISOString(),
        cost: { alloy: 1, crystal: 1, deuterium: 0 }, repair: null }],
    }), NOW);
    const emp = hostFactor(world({}, { empUntil: new Date(NOW + 60_000).toISOString() }), NOW);
    const empOver = hostFactor(world({}, { empUntil: new Date(NOW - 60_000).toISOString() }), NOW);
    // 40 Darts against 40 Darts: exactly double once the Bastions are dark.
    expect(outage).toBe(2);
    expect(emp).toBe(2);
    expect(empOver).toBe(online);
  });
});
