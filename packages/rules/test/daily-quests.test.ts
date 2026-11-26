import { describe, expect, it } from 'vitest';
import { DAILY_QUESTS, DAILY_QUEST_HONOR, HONOR_MICROS, dailyQuestReward, utcDay } from '../src/index.js';

/**
 * GÜNLÜK GÖREVLER (owner, 2026-11-24). Four acts the loop already has — three probes, a Yarık
 * sortie, a pirate hunt, an asteroid run — each paying a small purse once a UTC day. Progress is
 * counted from the day's rows, so a day is nothing but two instants.
 */
describe('the day', () => {
  it('is the UTC calendar day, so everyone resets at the same instant', () => {
    expect(utcDay(Date.UTC(2026, 10, 24, 0, 0, 0, 0))).toEqual({
      key: '2026-11-24', startMs: Date.UTC(2026, 10, 24), endMs: Date.UTC(2026, 10, 25),
    });
  });

  it('holds the last millisecond of a day and gives the next one to the next day', () => {
    expect(utcDay(Date.UTC(2026, 10, 24, 23, 59, 59, 999)).key).toBe('2026-11-24');
    expect(utcDay(Date.UTC(2026, 10, 25, 0, 0, 0, 0)).key).toBe('2026-11-25');
  });

  it('rolls over a month and a year', () => {
    expect(utcDay(Date.UTC(2026, 11, 31, 23, 0)).endMs).toBe(Date.UTC(2027, 0, 1));
    expect(utcDay(Date.UTC(2026, 1, 28, 12)).endMs).toBe(Date.UTC(2026, 2, 1));
  });

  it('refuses a time that is not a time', () => {
    expect(() => utcDay(Number.NaN)).toThrow();
    expect(() => utcDay(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('names the calendar day through leap years, century years and the epoch', () => {
    const keys: [number, string][] = [
      [Date.UTC(1970, 0, 1), '1970-01-01'],
      [Date.UTC(1969, 11, 31, 23, 59, 59, 999), '1969-12-31'],
      [Date.UTC(2000, 1, 29, 12), '2000-02-29'],
      [Date.UTC(2000, 2, 1), '2000-03-01'],
      [Date.UTC(2024, 11, 31, 23), '2024-12-31'],
      [Date.UTC(2026, 10, 24, 8), '2026-11-24'],
      [Date.UTC(2100, 1, 28, 23), '2100-02-28'],
      [Date.UTC(2100, 2, 1), '2100-03-01'],
    ];
    for (const [ms, key] of keys) expect(utcDay(ms).key).toBe(key);
  });
});

describe('the four quests', () => {
  it('are the owner’s list, in the order a player meets them', () => {
    expect(DAILY_QUESTS.map(quest => [quest.id, quest.goal])).toEqual([
      ['PROBES', 3], ['RIFT', 1], ['PIRATE', 1], ['ASTEROID', 1],
    ]);
  });

  it('each pay a small share of a day, never a replacement for the economy', () => {
    const hours = DAILY_QUESTS.reduce((sum, quest) => sum + quest.hours, 0);
    expect(hours).toBeGreaterThan(0.5);
    expect(hours).toBeLessThanOrEqual(2);
  });
});

describe('what a quest pays', () => {
  const rate = { alloy: 1000, crystal: 500 };

  it('is its hours of what the capital makes, split alloy and crystal', () => {
    const probes = DAILY_QUESTS.find(quest => quest.id === 'PROBES')!;
    const reward = dailyQuestReward('PROBES', rate);
    expect(reward.alloy + reward.crystal).toBe(Math.round(probes.hours * 1500));
    expect(reward.crystal).toBeGreaterThan(0);
    expect(reward.alloy).toBeGreaterThan(reward.crystal);
  });

  it('is never empty, even while production is down', () => {
    const reward = dailyQuestReward('PROBES', { alloy: 0, crystal: 0 });
    expect(reward.alloy).toBeGreaterThan(0);
    expect(reward.crystal).toBeGreaterThan(0);
  });

  it('ignores a negative rate rather than paying less than the floor', () => {
    expect(dailyQuestReward('RIFT', { alloy: -50, crystal: -50 })).toEqual(dailyQuestReward('RIFT', { alloy: 0, crystal: 0 }));
  });

  it('pays the harder acts more', () => {
    const total = (id: 'PROBES' | 'RIFT' | 'PIRATE' | 'ASTEROID') => {
      const reward = dailyQuestReward(id, rate);
      return reward.alloy + reward.crystal;
    };
    expect(total('PIRATE')).toBeGreaterThan(total('PROBES'));
    expect(total('RIFT')).toBeGreaterThan(total('ASTEROID'));
  });

  it('refuses a quest that does not exist', () => {
    expect(() => dailyQuestReward('NOPE' as never, rate)).toThrow();
  });
});

describe('the Honor each quest pays (owner 2026-11-24)', () => {
  it('is a quarter of one Honor per finished quest, in accounting micros', () => {
    expect(DAILY_QUEST_HONOR).toBe(HONOR_MICROS / 4);
    expect(Number.isSafeInteger(DAILY_QUEST_HONOR)).toBe(true);
  });

  it('adds up to one Honor on a day all four are taken', () => {
    expect(DAILY_QUEST_HONOR * DAILY_QUESTS.length).toBe(HONOR_MICROS);
  });
});
