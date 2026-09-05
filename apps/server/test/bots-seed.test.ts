import { beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, gte, sql } from 'drizzle-orm';
import { SERVERS } from '@astera/rules';
import { accounts, botProfiles, buildings, planets, players, seasons } from '../src/db/schema.js';
import { addBot, listBots, retireBot } from '../src/services/bots/roster.js';
import { ensureBotSeats, runBotSweep } from '../src/services/bots/sweep.js';
import { BOTS } from '../src/services/bots/personas.js';
import { botsAwakeAt } from '../src/services/bots/schedule.js';
import { GameError } from '../src/services/planet.js';
import { addMinutes } from '../src/clock.js';
import { seedWorld, type Fixture } from './helpers.js';

/**
 * SEATING THE SERVER'S OWN COMMANDERS.
 *
 * The two things that must never happen: a name the owner did not choose, and a
 * commander who is visibly not a commander. So the roster is a pool the owner
 * fills by hand, and everything the seat produces — capital, buildings, opening
 * grant — comes out of `joinSeason`, the same door a phone comes through.
 */

const silent = pino({ level: 'silent' });

/** 20:00 Türkiye time on a day the roster is busy. */
const busyEvening = new Date(Date.UTC(2026, 0, 1, 17, 0));

let f: Fixture;

beforeEach(async () => {
  f = await seedWorld(2);
});

/** A logger that keeps what it was told, so a test can count lines rather than read them. */
const countingLog = (): { log: typeof silent; warnings: string[] } => {
  const warnings: string[] = [];
  const log = Object.assign(pino({ level: 'silent' }), {
    warn: (_o: unknown, msg?: string) => void warnings.push(msg ?? ''),
  });
  return { log, warnings };
};

const names = (count: number, prefix = 'Bot'): string[] =>
  [...Array(count).keys()].map((i) => `${prefix}${String(i)}`);

async function fillPool(count: number): Promise<void> {
  for (const name of names(count)) await addBot(f.db, name, f.clock);
}

describe('bot roster', () => {
  it('takes the name the owner typed and keeps its casing', async () => {
    const added = await addBot(f.db, 'Kara Şahin', f.clock);
    expect(added.displayName).toBe('Kara Şahin');
    expect(added.ordinal).toBe(0);
    expect(added.password).toMatch(/\S{12,}/);

    const roster = await listBots(f.db);
    expect(roster).toHaveLength(1);
    expect(roster[0]?.displayName).toBe('Kara Şahin');
  });

  it('refuses a name that is already flying', async () => {
    await addBot(f.db, 'Vantage', f.clock);
    await expect(addBot(f.db, 'vantage', f.clock)).rejects.toThrow(GameError);
  });

  it('hands out ordinals in order and never reuses a live one', async () => {
    await fillPool(3);
    const roster = await listBots(f.db);
    expect(roster.map((row) => row.ordinal)).toEqual([0, 1, 2]);
    expect(new Set(roster.map((row) => row.persona)).size).toBeGreaterThan(1);
  });

  it('retires a commander without touching anybody else', async () => {
    await fillPool(3);
    await retireBot(f.db, 'Bot1');
    const roster = await listBots(f.db);
    expect(roster.map((row) => row.displayName)).toEqual(['Bot0', 'Bot2']);
  });
});

describe('seating bots on a live galaxy', () => {
  it('gives a bot the same opening a person gets', async () => {
    await fillPool(1);
    await ensureBotSeats(f.db, f.clock, silent);

    const [seat] = await f.db
      .select({ playerId: players.id, planetId: planets.id, name: planets.name })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId))
      .innerJoin(planets, and(
        eq(planets.controllerPlayerId, players.id),
        eq(planets.kind, 'CAPITAL'),
      ));
    expect(seat).toBeDefined();

    const levels = await f.db
      .select({ type: buildings.type, level: buildings.level })
      .from(buildings)
      .where(eq(buildings.planetId, seat!.planetId));
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.find((row) => row.type === 'CORE')?.level).toBeGreaterThanOrEqual(1);
  });

  it('seats the whole pool it has and asks for no more', async () => {
    await fillPool(BOTS.perGalaxy);
    await ensureBotSeats(f.db, f.clock, silent);
    const [seated] = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(seated?.n).toBe(BOTS.perGalaxy);
  });

  it('never invents a name to reach the target', async () => {
    await fillPool(3);
    const { log, warnings } = countingLog();
    await ensureBotSeats(f.db, f.clock, log);

    const roster = await listBots(f.db);
    expect(roster).toHaveLength(3);
    expect(warnings.join(' ')).toMatch(/roster/i);
  });

  it('says the roster is short once, not once a minute', async () => {
    await fillPool(3);
    const { log, warnings } = countingLog();
    // The sweep runs every sixty seconds for the life of the process. A shortfall
    // that logs on every pass is 1,440 identical lines a day burying everything
    // else in the worker's log — and the thing being reported has not changed.
    for (let sweep = 0; sweep < 5; sweep++) await ensureBotSeats(f.db, f.clock, log);
    expect(warnings).toHaveLength(1);
  });

  it('says it again when the shortfall actually moves', async () => {
    await fillPool(3);
    const { log, warnings } = countingLog();
    await ensureBotSeats(f.db, f.clock, log);
    await addBot(f.db, 'Latecomer', f.clock);
    await ensureBotSeats(f.db, f.clock, log);
    expect(warnings).toHaveLength(2);
  });

  it('refuses a name a real commander is already flying under', async () => {
    // `registerAccount` writes the typed name to both `display_name` and the folded
    // username, so a person's name is unique among people. A bot decouples the two,
    // which quietly reintroduces the collision — and two identical names on one
    // leaderboard is the oddity this whole design exists to avoid.
    await f.db.insert(accounts).values({
      username: 'someoneelse', passwordHash: 'not-a-real-hash', displayName: 'Kara Şahin',
    });
    await expect(addBot(f.db, 'kara şahin', f.clock)).rejects.toThrow(GameError);
    const roster = await listBots(f.db);
    expect(roster).toHaveLength(0);
  });

  it('leaves no orphan account behind when the profile cannot be written', async () => {
    await addBot(f.db, 'Tekil', f.clock);
    // Adding the same commander twice is refused, and the refusal must not have
    // created a second account on its way to deciding that.
    await expect(addBot(f.db, 'tekil', f.clock)).rejects.toThrow(GameError);
    const [row] = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(accounts)
      .where(sql`${accounts.displayName} ILIKE 'tekil'`);
    expect(row?.n).toBe(1);
  });

  it('is idempotent, and two sweeps at once seat each bot once', async () => {
    await fillPool(4);
    await Promise.all([
      ensureBotSeats(f.db, f.clock, silent),
      ensureBotSeats(f.db, f.clock, silent),
    ]);
    await ensureBotSeats(f.db, f.clock, silent);

    const [seated] = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(seated?.n).toBe(4);
  });

  it('leaves a galaxy that is not live alone', async () => {
    await fillPool(2);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await ensureBotSeats(f.db, f.clock, silent);
    const [seated] = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(botProfiles)
      .innerJoin(players, eq(players.accountId, botProfiles.accountId));
    expect(seated?.n).toBe(0);
  });
});

describe('presence', () => {
  const onlineNow = async (at: Date): Promise<number> => {
    const [row] = await f.db
      .select({ n: sql<number>`count(*)::int` })
      .from(players)
      .where(and(
        eq(players.seasonId, f.seasonId),
        gte(players.lastActiveAt, addMinutes(at, -SERVERS.onlineWindowMinutes)),
      ));
    return row?.n ?? 0;
  };

  it('counts an awake bot in the galaxy population', async () => {
    await fillPool(BOTS.perGalaxy);
    f.clock.set(busyEvening);
    await ensureBotSeats(f.db, f.clock, silent);

    // The two humans this fixture seats joined at the epoch and are long gone.
    expect(await onlineNow(busyEvening)).toBe(0);

    await runBotSweep(f.db, f.clock, silent);
    const awake = botsAwakeAt(BOTS.perGalaxy, 4242, busyEvening).size;
    expect(awake).toBeGreaterThanOrEqual(4);
    expect(await onlineNow(busyEvening)).toBe(awake);
  });

  it('leaves the galaxy empty during Türkiye quiet hours', async () => {
    await fillPool(BOTS.perGalaxy);
    const deadOfNight = new Date(Date.UTC(2026, 0, 2, 0, 30)); // 03:30 TRT
    f.clock.set(deadOfNight);
    await ensureBotSeats(f.db, f.clock, silent);
    await runBotSweep(f.db, f.clock, silent);
    expect(await onlineNow(deadOfNight)).toBe(0);
  });

  it('does not take the whole roster\'s turns in one tick', async () => {
    await fillPool(BOTS.perGalaxy);
    f.clock.set(busyEvening);
    // Every commander is seated with the same `nextActionAt`, so the first sweep
    // after a deploy has the entire roster due at once. `WORKER_POLL_MS` is one
    // second because visible timing matters (D52) — a tick that stops to play
    // twelve sessions is a tick during which nobody's raid lands.
    const result = await runBotSweep(f.db, f.clock, silent);
    expect(result.awake).toBeGreaterThanOrEqual(4);
    expect(result.turns).toBeGreaterThan(0);
    expect(result.turns).toBeLessThanOrEqual(BOTS.turnsPerSweep);
  });

  it('clears the backlog rather than starving anybody', async () => {
    await fillPool(BOTS.perGalaxy);
    f.clock.set(busyEvening);
    for (let sweep = 0; sweep < 8; sweep++) {
      await runBotSweep(f.db, f.clock, silent);
      f.clock.advance(1);
    }

    // The budget is a DELAY, not a rationing. After enough sweeps to cover the
    // roster twice over, nobody who is at the controls is still waiting for a turn.
    // Asserted this way rather than by counting turns, because the awake set drifts
    // minute to minute — a commander awake only for the first of those minutes is
    // legitimately passed over, and counting would call that starvation.
    const now = f.clock.now();
    const awake = botsAwakeAt(BOTS.perGalaxy, 4242, now);
    const rows = await f.db
      .select({ ordinal: botProfiles.ordinal, nextActionAt: botProfiles.nextActionAt })
      .from(botProfiles);
    const starved = rows.filter((row) => awake.has(row.ordinal) && row.nextActionAt <= now);
    expect(starved).toHaveLength(0);
  });

  it('does not act for a bot that is asleep', async () => {
    await fillPool(BOTS.perGalaxy);
    const deadOfNight = new Date(Date.UTC(2026, 0, 2, 0, 30));
    f.clock.set(deadOfNight);
    await ensureBotSeats(f.db, f.clock, silent);
    const before = await f.db.select({ next: botProfiles.nextActionAt }).from(botProfiles);
    const result = await runBotSweep(f.db, f.clock, silent);
    const after = await f.db.select({ next: botProfiles.nextActionAt }).from(botProfiles);
    expect(result.turns).toBe(0);
    expect(after.map((r) => r.next.getTime()).sort()).toEqual(
      before.map((r) => r.next.getTime()).sort(),
    );
  });
});
