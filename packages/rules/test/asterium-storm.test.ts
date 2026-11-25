import { describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  GALAXY_EVENT_KINDS,
  MOON,
  SYNTHESIS,
  galaxyEventConfigForRuleset,
  galaxyEventKindsForRuleset,
  generateGalaxyEventSchedule,
  synthesisEnabled,
} from '../src/index.js';

/** 2026-12-01 00:00 TRT = 2026-11-30 21:00 UTC. */
const SEASON_START_MS = Date.UTC(2026, 10, 30, 21, 0, 0);

describe('Asteryum Fırtınası on the galaxy calendar (plan §3.2, K3)', () => {
  it('is appended last, so no older lane loses a draw (D156)', () => {
    expect(GALAXY_EVENT_KINDS).toEqual(['ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY', 'ASTERIUM_STORM']);
  });

  it('belongs to seasons from the synthesis ruleset on, never to older ones', () => {
    expect(SYNTHESIS.rulesetVersion).toBeGreaterThan(MOON.rulesetVersion);
    expect(galaxyEventKindsForRuleset(SYNTHESIS.rulesetVersion - 1)).not.toContain('ASTERIUM_STORM');
    expect(galaxyEventKindsForRuleset(SYNTHESIS.rulesetVersion)).toContain('ASTERIUM_STORM');
  });

  it('runs every day 21:00–22:00 Türkiye time', () => {
    const definition = GALAXY_EVENTS.definitions.ASTERIUM_STORM;
    expect(definition.schedule).toBe('FIXED_DAILY');
    const plan = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: SEASON_START_MS / 60_000,
      seasonDurationMinutes: 3 * 24 * 60,
      kinds: ['ASTERIUM_STORM'],
      config: galaxyEventConfigForRuleset(SYNTHESIS.rulesetVersion),
      rngFor: () => { throw new Error('a fixed lane draws nothing'); },
    });
    expect(plan.map((event) => [event.startsAtMinute, event.endsAtMinute])).toEqual([
      [21 * 60, 22 * 60],
      [24 * 60 + 21 * 60, 24 * 60 + 22 * 60],
      [48 * 60 + 21 * 60, 48 * 60 + 22 * 60],
    ]);
    expect(plan.every((event) => event.kind === 'ASTERIUM_STORM')).toBe(true);
    expect(plan.map((event) => event.sequence)).toEqual([0, 1, 2]);
  });
});

describe('synthesisEnabled: a dealt ruleset or one live activation instant, main galaxies only', () => {
  it('mirrors the moon switch', () => {
    const main = { role: 'MAIN' as const };
    expect(synthesisEnabled({ rulesetVersion: 20, synthesisStartsAt: null }, main)).toBe(false);
    expect(synthesisEnabled({ rulesetVersion: 20, synthesisStartsAt: new Date(0) }, main)).toBe(true);
    expect(synthesisEnabled({ rulesetVersion: SYNTHESIS.rulesetVersion }, main)).toBe(true);
    expect(synthesisEnabled({ rulesetVersion: SYNTHESIS.rulesetVersion }, { role: 'WAITING' })).toBe(false);
  });
});
