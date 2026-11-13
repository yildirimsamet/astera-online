import { STARTER } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { jumpOutlook } from '../src/starter/departurePlan.js';

/**
 * WHAT THE JUMP WILL MEET, SAID BEFORE THE PRESS (plan F7, moment 16). The engines, parts and tank
 * are gone (plan 2026-11-13 §5.6): what is left to read early is the frontier and the calendar.
 */
const NOW = Date.parse('2026-11-08T12:00:00Z');
const DAY = 86_400_000;
const target = (daysToEnd: number) => ({ seasonEndsAt: new Date(NOW + daysToEnd * DAY) });

describe('what the calendar and the frontier will say', () => {
  it('says at once that no galaxy has room', () => {
    expect(jumpOutlook(null, NOW)).toEqual({ kind: 'noFrontier' });
  });

  it('says the ship will land in the next season once the last days have begun', () => {
    expect(jumpOutlook(target(3.5), NOW)).toEqual({ kind: 'seasonClosed', daysLeft: 4 });
    expect(jumpOutlook(target(STARTER.migrationCutoffDays), NOW)).toMatchObject({ kind: 'seasonClosed' });
  });

  it('says nothing while this season still takes ships', () => {
    expect(jumpOutlook(target(STARTER.migrationCutoffDays + 0.5), NOW)).toBeNull();
    expect(jumpOutlook(target(30), NOW)).toBeNull();
  });
});
