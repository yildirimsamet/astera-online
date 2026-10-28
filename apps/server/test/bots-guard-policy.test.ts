import { describe, expect, it } from 'vitest';
import { guardIds, guardWindow, planRosterSessions } from '../src/services/bots/guardPolicy.js';
import { type BotSessionCandidate } from '../src/services/bots/population.js';

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 28, hour - 3, minute));
const candidate = (n: number): BotSessionCandidate => ({ accountId: `account-${String(n)}`,
  playerId: `player-${String(n)}`, ordinal: n, sessionPlayerId: null, startedAt: null, untilAt: null });

describe('guard identity and activity', () => {
  it('uses only the first two Raider identities, irrespective of input order or retirement', () => {
    const rows = [13, 9, 17, 8].map(ordinal => ({ ordinal, playerId: `p${String(ordinal)}`,
      persona: ordinal === 8 ? 'BUILDER' : 'RAIDER' }));
    expect([...guardIds(rows)]).toEqual(['p9', 'p13']);
    expect([...guardIds(rows.toReversed())]).toEqual(['p9', 'p13']);
    expect(guardIds(rows.filter(r => r.persona !== 'RAIDER')).size).toBe(0);
  });

  it('gives each guard three staggered daytime windows and none during quiet hours', () => {
    for (const id of ['player-1', 'player-2']) {
      const windows = new Set<number>();
      for (let minute = 0; minute < 1440; minute++) {
        const now = at(0, minute), window = guardWindow(id, now);
        if (window) {
          expect(window.startsAt.getTime()).toBeLessThanOrEqual(now.getTime());
          expect(window.untilAt.getTime()).toBeGreaterThan(now.getTime());
          expect(window.untilAt.getTime() - window.startsAt.getTime()).toBe(60 * 60_000);
          windows.add(window.startsAt.getTime());
        }
        if (minute >= 60 && minute < 480) expect(window).toBeNull();
      }
      expect(windows.size).toBe(3);
    }
  });

  it('starts a guard without human demand, remains idempotent after restart and stops at quiet time', () => {
    const bot = candidate(1), guards = new Set([bot.playerId]);
    const now = Array.from({ length: 120 }, (_, i) => at(8, i)).find(t => guardWindow(bot.playerId, t))!;
    const plan = planRosterSessions([bot], 0, now, guards);
    expect(plan.start.map(r => r.playerId)).toEqual([bot.playerId]);
    const active = { ...bot, sessionPlayerId: bot.playerId, startedAt: now,
      untilAt: new Date(now.getTime() + 60 * 60_000) };
    expect(planRosterSessions([active], 0, now, guards).start).toEqual([]);
    const midnight = { ...active, startedAt: at(0, 45), untilAt: at(1, 45) };
    expect(planRosterSessions([midnight], 10, at(1), guards).active).toEqual([]);
    expect(planRosterSessions([midnight], 10, at(1), guards).stop).toContain(bot.accountId);
  });

  it('leaves ordinary bots asleep without demand and subtracts guard activity from ordinary demand', () => {
    const bot = candidate(1), other = candidate(2);
    const now = Array.from({ length: 120 }, (_, i) => at(8, i)).find(t => guardWindow(bot.playerId, t))!;
    const result = planRosterSessions([bot, other], 1, now, new Set([bot.playerId]));
    expect(result.start.map(r => r.playerId)).toEqual([bot.playerId]);
    expect(planRosterSessions([other], 0, now, new Set()).start).toEqual([]);
  });
});
