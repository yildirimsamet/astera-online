import { describe, expect, it } from 'vitest';
import { AWAY_THRESHOLD_MINUTES, awayRows, shouldShowAway } from '../src/lib/awayStory.js';
import type { ReturnEntry } from '../src/api/schemas.js';

/**
 * WHILE YOU WERE AWAY — WHICH THREE LINES, AND WHETHER TO SPEAK AT ALL. E10 · K5.
 *
 * The old overlay opened on nearly every return (a phone reloads a backgrounded tab)
 * and said whatever came first. It speaks now only after a real absence with something
 * to tell, and it says at most three things: the threat first, then the gain, then the
 * opportunity — one of each where there is one, the rest filled in that order.
 */
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);
const raided = (grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED', minutesAgo = 10): ReturnEntry =>
  ({ kind: 'raided', params: { grade, loot: 1_200, lost: 3 }, at: at(minutesAgo) });
const raidResult = (minutesAgo = 20): ReturnEntry =>
  ({ kind: 'raid_result', params: { grade: 'PARTIAL', loot: 3_100, lost: 2 }, at: at(minutesAgo) });
const scan: ReturnEntry = { kind: 'scan_detected', params: { count: 2 }, at: at(5) };
const accrued: ReturnEntry = { kind: 'accrued', params: { alloy: 900, crystal: 300 }, at: at(0) };
const unlock: ReturnEntry = { kind: 'unlock', params: { unlock: 'RADAR' }, at: at(0) };

describe('whether the story is told', () => {
  it('stays quiet under the threshold, however much happened', () => {
    expect(shouldShowAway({ awayMinutes: AWAY_THRESHOLD_MINUTES - 1, entries: [raided('DECISIVE')] })).toBe(false);
  });

  it('stays quiet after an absence with nothing to tell', () => {
    expect(shouldShowAway({ awayMinutes: 600, entries: [] })).toBe(false);
  });

  it('speaks after a real absence with something to tell', () => {
    expect(shouldShowAway({ awayMinutes: AWAY_THRESHOLD_MINUTES, entries: [accrued] })).toBe(true);
  });
});

describe('the three lines', () => {
  it('never says more than three things', () => {
    expect(awayRows([raided('DECISIVE'), scan, raidResult(), accrued, unlock])).toHaveLength(3);
  });

  it('leads with the threat, then the gain, then the opportunity', () => {
    const rows = awayRows([accrued, unlock, raided('DECISIVE')]);
    expect(rows.map((row) => row.tone)).toEqual(['alarm', 'gain', 'opportunity']);
    expect(rows[0]?.entry.kind).toBe('raided');
  });

  it('takes one of each before a second of any', () => {
    const rows = awayRows([raided('DECISIVE', 5), raided('PARTIAL', 15), scan, raidResult(), unlock]);
    expect(rows.map((row) => row.tone)).toEqual(['alarm', 'gain', 'opportunity']);
  });

  it('fills the rest in the same order when a kind has nothing to say', () => {
    const rows = awayRows([raided('DECISIVE', 5), scan, accrued]);
    expect(rows.map((row) => row.tone)).toEqual(['alarm', 'alarm', 'gain']);
  });

  /** A raid you held is good news, not a threat. */
  it('counts a repelled raid as a gain', () => {
    expect(awayRows([raided('REPELLED')])[0]?.tone).toBe('gain');
  });

  it('puts the newest first within a kind', () => {
    const rows = awayRows([raided('PARTIAL', 40), raided('DECISIVE', 5)]);
    expect(rows[0]?.entry.at.getTime()).toBeGreaterThan(rows[1]!.entry.at.getTime());
  });

  it('gives every line the one door that answers it', () => {
    const doors = awayRows([raided('DECISIVE', 1), scan, accrued]).map((row) => row.door);
    expect(doors).toEqual(['report', 'intel', 'base']);
    expect(awayRows([unlock])[0]?.door).toBe('orbit');
  });
});
