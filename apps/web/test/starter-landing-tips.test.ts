import { describe, expect, it } from 'vitest';
import { tipFor, tipTriggers, type TipReport } from '../src/starter/landingTips.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const landed = Date.UTC(2026, 10, 17);
const battle = (over: Partial<TipReport>): TipReport => ({ at: new Date(landed + HOUR), attacking: true, neutral: false, yourLosses: {}, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, ...over });

/**
 * THE FIRST WEEK'S NOTES COME WITH THE NEED (plan 2026-11-13 §4.8). A note opens when the player meets
 * what it explains: tiers at the first fight with a commander, Honor at the first attack on one, the clan
 * at the first loss, colonies when a slot opens. The calendar is only the fallback.
 */
describe('which first-week note opens', () => {
  it('falls back to the calendar while nothing has happened', () => {
    expect(tipFor({ landedAtMs: landed, nowMs: landed + HOUR, met: new Set(), dismissed: () => false })).toBe('core');
    expect(tipFor({ landedAtMs: landed, nowMs: landed + 4 * DAY, met: new Set(), dismissed: () => false })).toBe('dominion');
  });

  it('opens the note the player has just met before the calendar one', () => {
    expect(tipFor({ landedAtMs: landed, nowMs: landed + 4 * DAY, met: new Set(['clan']), dismissed: () => false })).toBe('clan');
  });

  it('goes back to the calendar once the met note is closed', () => {
    expect(tipFor({ landedAtMs: landed, nowMs: landed + 4 * DAY, met: new Set(['clan']), dismissed: id => id === 'clan' })).toBe('dominion');
  });

  it('says nothing after the first week', () => {
    expect(tipFor({ landedAtMs: landed, nowMs: landed + 8 * DAY, met: new Set(['clan']), dismissed: () => false })).toBeNull();
  });
});

describe('what the player has met since landing', () => {
  it('meets tiers at a fight with a commander and Honor only at an attack on one', () => {
    expect(tipTriggers([battle({ attacking: false })], 3, landed)).toEqual(new Set(['core']));
    expect(tipTriggers([battle({})], 3, landed)).toEqual(new Set(['core', 'honor']));
  });

  it('meets nothing new in a pirate fight that cost nothing', () => {
    expect(tipTriggers([battle({ neutral: true })], 3, landed)).toEqual(new Set());
  });

  it('meets the clan at the first loss: raided or ships lost while defending', () => {
    expect(tipTriggers([battle({ attacking: false, neutral: true, lootAlloy: -200 })], 3, landed).has('clan')).toBe(true);
    expect(tipTriggers([battle({ attacking: false, yourLosses: { DART: 2 } })], 3, landed).has('clan')).toBe(true);
    expect(tipTriggers([battle({ attacking: false, yourLosses: { DART: 0 } })], 3, landed).has('clan')).toBe(false);
  });

  it('meets colonies when the capital opens its first slot', () => {
    expect(tipTriggers([], 8, landed).has('colony')).toBe(false);
    expect(tipTriggers([], 9, landed).has('colony')).toBe(true);
  });

  it('ignores what happened before the landing', () => {
    expect(tipTriggers([battle({ at: new Date(landed - HOUR) })], 3, landed)).toEqual(new Set());
  });
});
