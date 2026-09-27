import { describe, expect, it } from 'vitest';
import {
  botAwakeTarget,
  botSeatTarget,
  planBotSessions,
  type BotSessionCandidate,
} from '../src/services/bots/population.js';

const at = (hour: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 8, 26, hour - 3, minute));

const candidate = (
  ordinal: number,
  startedAt: Date | null = null,
  untilAt: Date | null = null,
  sessionPlayerId: string | null = null,
): BotSessionCandidate => ({
  accountId: `account-${String(ordinal)}`,
  playerId: `player-${String(ordinal)}`,
  ordinal,
  startedAt,
  untilAt,
  sessionPlayerId,
});

describe('bot population targets', () => {
  it.each([
    [0, 0], [1, 2], [20, 5], [100, 25], [300, 75], [1000, 100],
  ])('seats %i people as %i bots', (people, expected) => {
    expect(botSeatTarget(people, 100)).toBe(expected);
  });

  it('respects the operator ceiling and malformed counts', () => {
    expect(botSeatTarget(100, 8)).toBe(8);
    expect(botSeatTarget(-1, 100)).toBe(0);
    expect(botSeatTarget(Number.NaN, 100)).toBe(0);
    expect(botSeatTarget(100, -1)).toBe(0);
    expect(botSeatTarget(100, 1)).toBe(1);
  });

  it('uses active people and at most half the seated bots', () => {
    expect(botAwakeTarget(50, 25)).toBe(13);
    expect(botAwakeTarget(500, 100)).toBe(50);
    expect(botAwakeTarget(0, 25)).toBe(0);
    expect(botAwakeTarget(1, 2)).toBe(1);
    expect(botAwakeTarget(50, 0)).toBe(0);
  });

  it('never decreases seat demand as people join or exceeds either capacity bound', () => {
    let previous = 0;
    for (let people = 0; people <= 1200; people++) {
      const target = botSeatTarget(people, 80);
      expect(target).toBeGreaterThanOrEqual(previous);
      expect(target).toBeLessThanOrEqual(80);
      previous = target;
    }
  });

  it('clamps fractional and invalid activity inputs', () => {
    expect(botAwakeTarget(-4, 25)).toBe(0);
    expect(botAwakeTarget(Number.NaN, 25)).toBe(0);
    expect(botAwakeTarget(50, -1)).toBe(0);
    expect(botAwakeTarget(50.9, 25.9)).toBe(13);
  });
});

describe('bot session decisions', () => {
  it('starts only up to demand and gives a new session an hour to act', () => {
    const result = planBotSessions([candidate(0), candidate(1), candidate(2)], 2, at(12));
    expect(result.start).toHaveLength(2);
    expect(result.start.map((row) => row.accountId)).toEqual(['account-0', 'account-1']);
    expect(result.stop).toEqual([]);
    expect(result.extend).toEqual([]);
  });

  it('does not cut a 5-minute population dip into an existing session', () => {
    const started = at(12);
    const until = at(13);
    const result = planBotSessions([candidate(0, started, until, 'player-0')], 0, at(12, 5));
    expect(result.stop).toEqual([]);
    expect(result.active).toEqual(['account-0']);
  });

  it('can stop an over-target session after the minimum hour', () => {
    const result = planBotSessions([
      candidate(0, at(12), at(13, 10), 'player-0'),
    ], 0, at(13));
    expect(result.stop).toEqual(['account-0']);
    expect(result.active).toEqual([]);
  });

  it('scales down gradually, retiring the oldest eligible session first', () => {
    const result = planBotSessions([
      candidate(0, at(10, 5), at(13, 10), 'player-0'),
      candidate(1, at(11), at(13, 10), 'player-1'),
      candidate(2, at(12, 45), at(13, 45), 'player-2'),
    ], 1, at(13));
    expect(result.stop).toEqual(['account-0']);
    expect(result.active).toEqual(['account-1', 'account-2']);
  });

  it('limits a large activity collapse to one quarter of eligible sessions per check', () => {
    const active = Array.from({ length: 8 }, (_, i) =>
      candidate(i, at(11), at(13, 10), `player-${String(i)}`));
    const result = planBotSessions(active, 0, at(13));
    expect(result.stop).toEqual(['account-0', 'account-1']);
    expect(result.active).toHaveLength(6);
  });

  it('does not repeat the same reduction when another worker checks the same five-minute bucket', () => {
    const bots = Array.from({ length: 8 }, (_, i) =>
      candidate(i, at(11), at(13, 10), `player-${String(i)}`));
    const first = planBotSessions(bots, 0, at(13));
    const afterFirst = bots.map((bot) => first.stop.includes(bot.accountId)
      ? { ...bot, untilAt: at(13) }
      : bot);
    expect(first.stop).toHaveLength(2);
    expect(planBotSessions(afterFirst, 0, at(13, 1)).stop).toEqual([]);
    expect(planBotSessions(afterFirst, 0, at(13, 5)).stop).toHaveLength(2);
  });

  it('does not count a maximum-duration exit against the gradual reduction budget', () => {
    const result = planBotSessions([
      candidate(0, at(10), at(13, 10), 'player-0'),
      candidate(1, at(11), at(13, 10), 'player-1'),
      candidate(2, at(11), at(13, 10), 'player-2'),
    ], 0, at(13));
    expect(result.stop).toEqual(['account-0', 'account-1']);
    expect(result.active).toEqual(['account-2']);
  });

  it('rotates a session at three hours and enforces 30 minutes of rest', () => {
    const result = planBotSessions([
      candidate(0, at(10), at(13, 5), 'player-0'),
      candidate(1),
    ], 1, at(13));
    expect(result.stop).toEqual(['account-0']);
    expect(result.start.map((row) => row.accountId)).toEqual(['account-1']);
    const tooSoon = planBotSessions([
      candidate(0, at(10), at(13), 'player-0'),
    ], 1, at(13, 20));
    expect(tooSoon.start).toEqual([]);
    expect(planBotSessions([
      candidate(0, at(10), at(13), 'player-0'),
    ], 1, at(13, 30)).start).toHaveLength(1);
  });

  it('keeps a session within the three-hour hard limit when extending it', () => {
    const result = planBotSessions([
      candidate(0, at(10), at(12, 58), 'player-0'),
    ], 1, at(12, 55));
    expect(result.extend).toEqual([{ accountId: 'account-0', untilAt: at(13) }]);
    expect(planBotSessions([
      candidate(0, at(10), at(13), 'player-0'),
    ], 1, at(13)).active).toEqual([]);
  });

  it('never resumes a session belonging to an old season player', () => {
    const result = planBotSessions([
      candidate(0, at(12), at(13), 'player-from-old-season'),
    ], 1, at(12, 10));
    expect(result.stop).toEqual([]);
    expect(result.start.map((row) => row.accountId)).toEqual(['account-0']);
  });

  it('honours the 01:00–08:00 blackout and avoids short midnight sessions', () => {
    const nextDay = (hour: number, minute = 0): Date =>
      new Date(at(hour, minute).getTime() + 24 * 60 * 60_000);
    const session = candidate(0, at(23), nextDay(1, 30), 'player-0');
    expect(planBotSessions([session], 1, nextDay(0, 30)).active).toEqual(['account-0']);
    expect(planBotSessions([candidate(1)], 1, nextDay(0, 30)).start).toEqual([]);
    expect(planBotSessions([session], 1, nextDay(1)).stop).toEqual(['account-0']);
    expect(planBotSessions([candidate(1)], 1, at(7, 59)).start).toEqual([]);
    expect(planBotSessions([candidate(1)], 1, at(8)).start).toHaveLength(1);
  });
});
