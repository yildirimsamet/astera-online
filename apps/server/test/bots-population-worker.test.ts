import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../src/db/client.js';
import { botProfiles, players } from '../src/db/schema.js';
import { addBot, retireBot } from '../src/services/bots/roster.js';
import { botStatus, ensureBotSeats, runBotSweep } from '../src/services/bots/sweep.js';
import { peopleIn } from '../src/services/people.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
let f: Fixture;

afterAll(async () => { await (await testDb()).close(); });

describe('population driven bot worker', () => {
  beforeEach(async () => { f = await seedWorld(20); });

  it('adds only four bots per half hour toward real-player demand', async () => {
    for (let i = 0; i < 6; i++) await addBot(f.db, `PopBot${String(i)}`, f.clock);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100)).toBe(4);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100)).toBe(0);
    f.clock.advance(30);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100)).toBe(1);
    const [count] = await f.db.select({ n: sql<number>`count(*)::int` })
      .from(players).innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
      .where(eq(players.seasonId, f.seasonId));
    expect(count?.n).toBe(5);
  });

  it('does not seat bots in an empty galaxy', async () => {
    f = await seedWorld(0);
    await addBot(f.db, 'EmptySky', f.clock);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100)).toBe(0);
  });

  it('seats a bot without waking it when no real player is active', async () => {
    await addBot(f.db, 'QuietPilot', f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    await f.db.update(players).set({ lastActiveAt: new Date(evening.getTime() - 60 * 60_000) });
    const result = await runBotSweep(f.db, f.clock, silent, 100);
    expect(result).toEqual({ seated: 1, awake: 0, turns: 0 });
    expect((await botStatus(f.db, f.clock, 100)).galaxies[0]?.activePeople).toBe(0);
  });

  it('warns when demand exists but the name pool is empty', async () => {
    const warnings: string[] = [];
    const log = Object.assign(pino({ level: 'silent' }), {
      warn: (_fields: unknown, message?: string) => { if (message) warnings.push(message); },
    });
    expect(await ensureBotSeats(f.db, f.clock, log, 100)).toBe(0);
    expect(warnings.join(' ')).toMatch(/roster/i);
  });

  it('reports a larger roster shortfall when the demand target increases', async () => {
    const wants: number[] = [];
    const log = Object.assign(pino({ level: 'silent' }), {
      warn: (fields: { want?: number }) => { if (fields.want !== undefined) wants.push(fields.want); },
    });
    await ensureBotSeats(f.db, f.clock, log, 3);
    await ensureBotSeats(f.db, f.clock, log, 100);
    expect(wants).toEqual([3, 5]);
  });

  it('reports a roster shortfall again after the pool has recovered and emptied', async () => {
    const wants: number[] = [];
    const log = Object.assign(pino({ level: 'silent' }), {
      warn: (fields: { want?: number }) => { if (fields.want !== undefined) wants.push(fields.want); },
    });
    await ensureBotSeats(f.db, f.clock, log, 100);
    for (let i = 0; i < 5; i++) await addBot(f.db, `Recovered${String(i)}`, f.clock);
    await ensureBotSeats(f.db, f.clock, log, 100);
    for (let i = 0; i < 5; i++) await retireBot(f.db, `Recovered${String(i)}`);
    f.clock.advance(30);
    await ensureBotSeats(f.db, f.clock, log, 100);
    expect(wants).toEqual([5, 5]);
  });

  it('does not turn a retired bot into a real player', async () => {
    await addBot(f.db, 'RetiredPilot', f.clock);
    await ensureBotSeats(f.db, f.clock, silent, 100);
    expect(await peopleIn(f.db, f.seasonId)).toBe(20);
    expect(await retireBot(f.db, 'RetiredPilot')).toBe(true);
    expect(await peopleIn(f.db, f.seasonId)).toBe(20);
  });

  it('keeps an awake bot working after humans disappear for five minutes', async () => {
    await addBot(f.db, 'SessionOne', f.clock);
    await addBot(f.db, 'SessionTwo', f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z'); // 20:00 Türkiye
    f.clock.set(evening);
    await f.db.update(players).set({ lastActiveAt: evening })
      .where(eq(players.id, f.playerIds[0]!));

    const first = await runBotSweep(f.db, f.clock, silent, 100);
    expect(first.seated).toBe(2);
    expect(first.awake).toBe(1);
    expect(first.turns).toBe(1);

    f.clock.advance(6);
    const stillWorking = await runBotSweep(f.db, f.clock, silent, 100);
    expect(stillWorking.awake).toBe(1);
    const [active] = await f.db.select({ n: sql<number>`count(*)::int` })
      .from(players).innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
      .where(and(eq(players.seasonId, f.seasonId), gte(players.lastActiveAt, f.clock.now())));
    expect(active?.n).toBe(1);

    f.clock.advance(55);
    expect((await runBotSweep(f.db, f.clock, silent, 100)).awake).toBe(0);
  });

  it('reports demand and actual activity for each galaxy', async () => {
    for (let i = 0; i < 6; i++) await addBot(f.db, `StatusBot${String(i)}`, f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    for (const id of f.playerIds.slice(0, 5)) {
      await f.db.update(players).set({ lastActiveAt: evening }).where(eq(players.id, id));
    }
    await runBotSweep(f.db, f.clock, silent, 100);
    const status = await botStatus(f.db, f.clock, 100);
    expect(status.seated).toBe(4);
    expect(status.awake).toBe(1);
    expect(status.galaxies).toEqual([{
      seasonId: f.seasonId,
      people: 20,
      activePeople: 5,
      targetSeats: 5,
      seated: 4,
      targetAwake: 1,
      awake: 1,
    }]);
  });

  it('does not report a bot as awake after its worker has stopped refreshing presence', async () => {
    const bot = await addBot(f.db, 'StoppedWorkerPilot', f.clock);
    await ensureBotSeats(f.db, f.clock, silent, 100);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    const [seated] = await f.db.select({ id: players.id })
      .from(players).where(eq(players.accountId, bot.accountId));
    await f.db.update(botProfiles).set({
      sessionPlayerId: seated!.id,
      sessionStartedAt: new Date(evening.getTime() - 30 * 60_000),
      sessionUntilAt: new Date(evening.getTime() + 30 * 60_000),
    }).where(eq(botProfiles.accountId, bot.accountId));
    await f.db.update(players).set({ lastActiveAt: new Date(evening.getTime() - 10 * 60_000) })
      .where(eq(players.id, seated!.id));

    expect((await botStatus(f.db, f.clock, 100)).awake).toBe(0);
  });

  it('does not claim a turn if another worker ends the session after the awake read', async () => {
    const bot = await addBot(f.db, 'BoundaryPilot', f.clock);
    await ensureBotSeats(f.db, f.clock, silent, 100);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    await f.db.update(players).set({ lastActiveAt: new Date(evening.getTime() - 60 * 60_000) });
    await f.db.update(players).set({ lastActiveAt: evening })
      .where(eq(players.id, f.playerIds[0]!));
    const [seated] = await f.db.select({ id: players.id })
      .from(players).where(eq(players.accountId, bot.accountId));
    await f.db.update(botProfiles).set({
      sessionPlayerId: seated!.id,
      sessionStartedAt: new Date(evening.getTime() - 30 * 60_000),
      sessionUntilAt: new Date(evening.getTime() + 30 * 60_000),
      nextActionAt: evening,
    }).where(eq(botProfiles.accountId, bot.accountId));

    let transactions = 0;
    const db = new Proxy(f.db, {
      get(target, property, receiver) {
        if (property !== 'transaction') {
          const value: unknown = Reflect.get(target, property, receiver);
          return value;
        }
        return async (callback: Parameters<Db['transaction']>[0]) => {
          transactions++;
          if (transactions === 2) {
            await target.update(botProfiles).set({ sessionUntilAt: evening })
              .where(eq(botProfiles.accountId, bot.accountId));
          }
          return target.transaction(callback);
        };
      },
    });
    expect((await runBotSweep(db, f.clock, silent, 100)).turns).toBe(0);
    expect(transactions).toBe(2);
  });

  it('gives a newly started session its first turn within five minutes', async () => {
    await addBot(f.db, 'FirstTurnA', f.clock);
    await addBot(f.db, 'FirstTurnB', f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    await f.db.update(players).set({ lastActiveAt: evening })
      .where(eq(players.id, f.playerIds[0]!));
    await f.db.update(botProfiles).set({ nextActionAt: new Date(evening.getTime() + 2 * 60 * 60_000) });

    const first = await runBotSweep(f.db, f.clock, silent, 100);
    expect(first.awake).toBe(1);
    expect(first.turns).toBe(0);
    const [started] = await f.db.select({ nextActionAt: botProfiles.nextActionAt })
      .from(botProfiles).where(gte(botProfiles.sessionUntilAt, evening));
    expect(started?.nextActionAt.getTime()).toBeLessThanOrEqual(evening.getTime() + 5 * 60_000);

    f.clock.advance(5);
    expect((await runBotSweep(f.db, f.clock, silent, 100)).turns).toBe(1);
  });

  it('spaces later decisions by seven to twenty-three minutes inside the protected hour', async () => {
    const bot = await addBot(f.db, 'PacedPilot', f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    await f.db.update(players).set({ lastActiveAt: evening })
      .where(eq(players.id, f.playerIds[0]!));
    expect((await runBotSweep(f.db, f.clock, silent, 100)).turns).toBe(1);
    const [profile] = await f.db.select({ nextActionAt: botProfiles.nextActionAt })
      .from(botProfiles).where(eq(botProfiles.accountId, bot.accountId));
    const next = profile?.nextActionAt.getTime() ?? 0;
    expect(next).toBeGreaterThanOrEqual(evening.getTime() + 7 * 60_000);
    expect(next).toBeLessThanOrEqual(evening.getTime() + 23 * 60_000);
    f.clock.advance(5);
    expect((await runBotSweep(f.db, f.clock, silent, 100)).turns).toBe(0);
    f.clock.advance(18);
    expect((await runBotSweep(f.db, f.clock, silent, 100)).turns).toBe(1);
  });

  it('lets concurrent workers seat and activate each account only once', async () => {
    for (let i = 0; i < 6; i++) await addBot(f.db, `Concurrent${String(i)}`, f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    for (const id of f.playerIds.slice(0, 5)) {
      await f.db.update(players).set({ lastActiveAt: evening }).where(eq(players.id, id));
    }
    const results = await Promise.all([
      runBotSweep(f.db, f.clock, silent, 100),
      runBotSweep(f.db, f.clock, silent, 100),
    ]);
    const rows = await f.db.select({
      sessionPlayerId: botProfiles.sessionPlayerId,
      playerId: players.id,
    }).from(botProfiles).innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.sessionPlayerId === row.playerId)).toHaveLength(1);
    expect(results.reduce((sum, row) => sum + row.turns, 0)).toBeLessThanOrEqual(1);
  });

  it('applies one gradual reduction when two sweeps overlap in a five-minute bucket', async () => {
    for (let i = 0; i < 5; i++) await addBot(f.db, `ScaleDown${String(i)}`, f.clock);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100)).toBe(4);
    f.clock.advance(30);
    expect(await ensureBotSeats(f.db, f.clock, silent, 100)).toBe(1);
    f.clock.advance(60);
    const now = f.clock.now();
    const rows = await f.db.select({ accountId: botProfiles.accountId, playerId: players.id })
      .from(botProfiles).innerJoin(players, eq(players.accountId, botProfiles.accountId));
    for (const row of rows) {
      await f.db.update(botProfiles).set({
        sessionPlayerId: row.playerId,
        sessionStartedAt: new Date(now.getTime() - 90 * 60_000),
        sessionUntilAt: new Date(now.getTime() + 30 * 60_000),
        nextActionAt: new Date(now.getTime() + 30 * 60_000),
      }).where(eq(botProfiles.accountId, row.accountId));
    }
    await Promise.all([
      runBotSweep(f.db, f.clock, silent, 100),
      runBotSweep(f.db, f.clock, silent, 100),
    ]);
    const [stopped] = await f.db.select({ n: sql<number>`count(*)::int` })
      .from(botProfiles).where(eq(botProfiles.sessionUntilAt, now));
    expect(stopped?.n).toBe(2);
  });

  it('replaces a stale prior-season session with the current player identity', async () => {
    await addBot(f.db, 'OldSeasonA', f.clock);
    await addBot(f.db, 'OldSeasonB', f.clock);
    await ensureBotSeats(f.db, f.clock, silent, 100);
    const evening = new Date('2026-01-01T17:00:00.000Z');
    f.clock.set(evening);
    await f.db.update(players).set({ lastActiveAt: evening })
      .where(eq(players.id, f.playerIds[0]!));
    await f.db.update(botProfiles).set({
      sessionPlayerId: f.playerIds[0]!,
      sessionStartedAt: new Date(evening.getTime() - 30 * 60_000),
      sessionUntilAt: new Date(evening.getTime() + 30 * 60_000),
    });
    expect((await runBotSweep(f.db, f.clock, silent, 100)).awake).toBe(1);
    const rows = await f.db.select({
      sessionPlayerId: botProfiles.sessionPlayerId,
      playerId: players.id,
    }).from(botProfiles).innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(rows.filter((row) => row.sessionPlayerId === row.playerId)).toHaveLength(1);
  });
});
