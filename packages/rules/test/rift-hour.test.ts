import { describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  GALAXY_EVENT_KINDS,
  SYNTHESIS,
  galaxyEventConfigForRuleset,
  galaxyEventKindsForRuleset,
  generateGalaxyEventSchedule,
} from '../src/index.js';

/** 2026-12-01 00:00 TRT = 2026-11-30 21:00 UTC. */
const SEASON_START_MS = Date.UTC(2026, 10, 30, 21, 0, 0);

const plan = (kinds: readonly ('RIFT_HOUR' | 'ASTERIUM_STORM')[]) => generateGalaxyEventSchedule({
  seasonStartsAtUnixMinute: SEASON_START_MS / 60_000,
  seasonDurationMinutes: 2 * 24 * 60,
  kinds,
  config: galaxyEventConfigForRuleset(SYNTHESIS.rulesetVersion),
  rngFor: () => { throw new Error('a fixed lane draws nothing'); },
});

/**
 * YARIK SAATİ (owner 2026-11-27): the Yarık opens twice a day, in this window and in the Asteryum Fırtınası.
 * This one seeds no Asteryum; it only opens the room.
 */
describe('Yarık Saati on the galaxy calendar', () => {
  it('is appended last, after the storm (D156)', () => {
    expect(GALAXY_EVENT_KINDS).toEqual(['ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY', 'ASTERIUM_STORM', 'RIFT_HOUR']);
  });

  it('comes with the storm: from the synthesis ruleset on, never before', () => {
    expect(galaxyEventKindsForRuleset(SYNTHESIS.rulesetVersion - 1)).not.toContain('RIFT_HOUR');
    expect(galaxyEventKindsForRuleset(SYNTHESIS.rulesetVersion)).toContain('RIFT_HOUR');
  });

  it('runs every day 17:00–18:00 Türkiye time', () => {
    expect(GALAXY_EVENTS.definitions.RIFT_HOUR.schedule).toBe('FIXED_DAILY');
    const hours = plan(['RIFT_HOUR']);
    expect(hours.map((event) => [event.startsAtMinute, event.endsAtMinute])).toEqual([
      [17 * 60, 18 * 60],
      [24 * 60 + 17 * 60, 24 * 60 + 18 * 60],
    ]);
    expect(hours.map((event) => [event.kind, event.effect])).toEqual([['RIFT_HOUR', { roomVersion: 1 }], ['RIFT_HOUR', { roomVersion: 1 }]]);
    expect(hours.map((event) => event.sequence)).toEqual([0, 1]);
  });

  it('never overlaps the storm: the two are the day\'s two openings', () => {
    const both = plan(['ASTERIUM_STORM', 'RIFT_HOUR']);
    for (const a of both) for (const b of both) {
      if (a === b) continue;
      expect(a.endsAtMinute <= b.startsAtMinute || b.endsAtMinute <= a.startsAtMinute).toBe(true);
    }
    expect(both.filter((event) => event.kind === 'ASTERIUM_STORM')).toHaveLength(2);
  });
});
