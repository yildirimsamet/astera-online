import { describe, expect, it } from 'vitest';
import { AWAY_THRESHOLD_MINUTES, awayRows, shouldShowAway, sightingsOf, worldCare, type AwayRow } from '../src/lib/awayStory.js';
import type { IntelView, ReturnEntry } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/** The entry a row tells, or null for a live sighting. */
const entryOf = (row: AwayRow | undefined) => (row?.kind === 'entry' ? row.entry : null);

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
    expect(entryOf(rows[0])?.kind).toBe('raided');
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
    expect(entryOf(rows[0])!.at.getTime()).toBeGreaterThan(entryOf(rows[1])!.at.getTime());
  });

  it('gives every line the one door that answers it', () => {
    const doors = awayRows([raided('DECISIVE', 1), scan, accrued]).map((row) => row.door);
    expect(doors).toEqual(['report', 'intel', 'base']);
    expect(awayRows([unlock])[0]?.door).toBe('orbit');
  });
});

/**
 * THE MOCK'S OPPORTUNITY (M4): "Orin'in filosu ayrıldı · Dönüş ~01:10 · Teleskop gördü".
 * A world under the Telescope whose fleet is out is the opening the game is about; it is
 * read live off the Telescope's slots, so no server kind is needed.
 */
describe('what the Telescope sees now', () => {
  const watch = (targetPlanetId: string, status: 'HOME' | 'AWAY', etaMinutes: number | null = null): IntelView['watching'][number] => ({
    slot: 0, targetPlanetId, targetName: `W-${targetPlanetId}`, ownerName: 'NOVA',
    reading: { status, staleMinutes: 0, etaMinutes, state: 'CLEAR', clarity: 1 },
    cooldownUntil: null,
  });

  it('names the watched worlds whose fleet is out, once each', () => {
    expect(sightingsOf([watch('a', 'AWAY', 70), watch('b', 'HOME'), watch('a', 'AWAY', 70)])).toEqual([
      { planetId: 'a', planetName: 'W-a', owner: 'NOVA', etaMinutes: 70 },
    ]);
  });

  it('puts a live sighting in the opportunity’s place, before an unlock', () => {
    const rows = awayRows([raided('DECISIVE'), accrued, unlock], sightingsOf([watch('a', 'AWAY', 70)]));
    expect(rows.map((row) => row.kind)).toEqual(['entry', 'entry', 'sighting']);
    expect(rows[2]).toMatchObject({ tone: 'opportunity', door: 'dossier' });
  });
});

/** The mock's warn line: "Thistle-88 sadakati %50 · 2 arıza duruyor · onar". */
describe('the world that needs you', () => {
  const world = (id: string, faults: number, loyalty: number | null) => planetView({
    faults: Array.from({ length: faults }, (_, index) => ({
      id: `${id}-f${String(index)}`, kind: 'REFINERY_OUTAGE' as const, startedAt: new Date(), cost: { alloy: 1, crystal: 1, deuterium: 0 }, repair: null,
    })),
    loyalty: loyalty === null ? null : { value: loyalty, minutesLeft: 600 },
  }, { id, name: `World-${id}` });

  it('names the world with the most faults standing, and its loyalty', () => {
    expect(worldCare([world('a', 1, 90), world('b', 2, 50), world('c', 0, 100)])).toEqual({
      planetId: 'b', name: 'World-b', faults: 2, loyalty: 50,
    });
  });

  it('says nothing where nothing is broken', () => {
    expect(worldCare([world('a', 0, 70), world('c', 0, null)])).toBeNull();
  });

  it('leaves the loyalty out where it is whole or cannot move', () => {
    expect(worldCare([world('a', 1, null)])?.loyalty).toBeNull();
    expect(worldCare([world('a', 1, 100)])?.loyalty).toBeNull();
  });
});
