import { and, asc, eq, gt, gte, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { ACADEMY_STEPS, ASTEROID_DYNAMIC, MULTI_WORLD, SERVERS, hashSeed, mulberry32 } from '@astera/rules';
import type { Db } from '../../db/client.js';
import type { Clock } from '../../clock.js';
import { botProfiles, planets, players, seasons, shards } from '../../db/schema.js';
import { joinSeason } from '../player.js';
import { GameError } from '../planet.js';
import { BOTS } from './personas.js';
import {
  BOT_ACTIVITY_BUCKET_MS, BOT_SEAT_BATCH, BOT_SEAT_INTERVAL_MS, botAwakeTarget, botQuietAt, botSeatTarget,
  planBotSessions, type BotSessionCandidate,
} from './population.js';
import { isPerson, peopleIn } from '../people.js';
import { runBotTurn, type BotSeat } from './brain.js';

/**
 * THE ONE THING THAT DRIVES THEM. D159.
 *
 * A fixed-cadence sweep on the worker's own clock, beside the stranded-flight
 * repair, rather than a new `scheduled_events` kind. The
 * queue exists for MOMENTS the world is waiting on — a raid settling, a fleet
 * landing — and it earns its enum value, its handler, its abandon branch and its
 * health entry by being unable to be missed. A bot's turn is the opposite: missing
 * one costs a commander one upgrade, and the next sweep is twenty seconds away. Paying
 * the queue's whole tax for that would be paying for a guarantee nobody needs.
 *
 * Housekeeping may never stop the event queue. The caller wraps this in its
 * own `try/catch` and carries on regardless.
 *
 * IT IS STILL SAFE UNDER MORE THAN ONE WORKER. Seating is idempotent because
 * `joinSeason` settles a duplicate rather than failing, and a turn is claimed by
 * moving `next_action_at` forward under `FOR UPDATE SKIP LOCKED` — so two processes
 * can never drive one commander at the same instant, and a process that dies
 * mid-turn simply leaves that commander until its next slot.
 */

export interface BotSweepResult {
  /** Commanders seated on a galaxy for the first time this sweep. */
  seated: number;
  /** How many are at the controls right now, across every live galaxy. */
  awake: number;
  turns: number;
}

interface SeatedBot {
  accountId: string;
  ordinal: number;
  persona: string;
  playerId: string;
  planetId: string;
  seasonId: string;
  seasonSeed: number;
  nextActionAt: Date;
  lastActiveAt: Date;
  sessionPlayerId: string | null;
  sessionStartedAt: Date | null;
  sessionUntilAt: Date | null;
}

/**
 * Seat up to the real-player target, admitting at most four per half hour.
 *
 * The target is per galaxy and the pool is global, so a short pool is a WARNING and
 * never a prompt to invent a name — a generated commander beside the owner's own is
 * the one mistake this system cannot take back.
 */
export async function ensureBotSeats(
  db: Db,
  clock: Clock,
  log: FastifyBaseLogger,
  /** `BOTS_PER_GALAXY` is an upper bound, not an immediate seating quota. */
  perGalaxy: number = BOTS.maxPerGalaxy,
): Promise<number> {
  const live = await db
    .select({ id: seasons.id, code: shards.code })
    .from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasons.status, 'live'), eq(shards.role, 'MAIN')))
    .orderBy(asc(seasons.startsAt), asc(seasons.id));
  const eligible = live.filter((season) => !BOTS.excludedShardCodes.includes(season.code));
  if (eligible.length === 0) return 0;

  const profiles = await db
    .select({ accountId: botProfiles.accountId, ordinal: botProfiles.ordinal })
    .from(botProfiles)
    .where(isNull(botProfiles.retiredAt))
    .orderBy(asc(botProfiles.ordinal));
  const placed = await db
    .select({ accountId: players.accountId, seasonId: players.seasonId, joinedAt: players.joinedAt, retiredAt: botProfiles.retiredAt })
    .from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId));
  const seasonOf = new Map(placed.map((row) => [row.accountId, row.seasonId]));

  let seated = 0;
  let free = profiles.filter((profile) => !seasonOf.has(profile.accountId));

  for (const season of eligible) {
    const hereRows = placed.filter((row) => row.seasonId === season.id);
    const here = hereRows.filter((row) => row.retiredAt === null).length;
    const target = botSeatTarget(await peopleIn(db, season.id), perGalaxy);
    const recent = hereRows.filter((row) => row.joinedAt > new Date(clock.now().getTime() - BOT_SEAT_INTERVAL_MS)).length;
    const need = Math.min(
      Math.max(0, target - here),
      Math.max(0, BOT_SEAT_BATCH - recent),
      Math.max(0, MULTI_WORLD.botSlots - hereRows.length),
    );
    if (free.length < target - here) reportShortRoster(log, season.id, here + free.length, target);
    else lastShortfall.delete(season.id);
    if (need <= 0) continue;
    const taking = free.slice(0, need);
    free = free.slice(taking.length);
    for (const profile of taking) {
      try {
        await joinSeason(db, profile.accountId, season.id, clock, ACADEMY_STEPS.length, 'SERVER');
        /*
          SEATING IS NOT PLAYING, AND THE POPULATION FIGURE MUST NOT SAY IT IS.

          `joinSeason` stamps `last_active_at` with the instant of the join, which
          is right for a person — they are, by definition, at the controls. A bot
          seated at 04:00 is not, and inactive bots appearing in the live count in
          the middle of the quiet hours is precisely the thing the blackout exists
          to prevent. Backdated past the online window, so the only thing that ever
          puts one of these commanders into the population is the presence stamp
          below, which fires only when the roster says they are awake.
        */
        await db
          .update(players)
          .set({
            // Past the asteroid/pirate activity window too: seated is not playing.
            // Bots never count toward that hour anyway (`countEligibleCommanders`).
            lastActiveAt: new Date(
              clock.now().getTime()
                - (Math.max(SERVERS.onlineWindowMinutes, ASTEROID_DYNAMIC.activeWindowMinutes) + 1) * 60_000,
            ),
            /*
              THE FIRST-DAY SHIELD STAYS. Owner instruction, 2026-09-19: a bot opens
              with the same day a person does and waits it out rather than breaking
              it (`brain.ts` keeps the attack lane shut while it stands). It used to
              be cleared here, on the reasoning that a shielded bot is a target the
              disc loses for a day — the owner's answer is that they are people now.
            */
            // A profile seated onto an account that still holds a recovery window
            // from an earlier season starts this one without it.
            recoveryShieldUntil: null,
          })
          .where(eq(players.accountId, profile.accountId));
        seated++;
      } catch (err) {
        // ALREADY_PLACED is another sweep winning the same race, and is not news.
        if (err instanceof GameError && err.code === 'ALREADY_PLACED') continue;
        log.error({ err, accountId: profile.accountId }, 'could not seat a bot commander');
      }
    }
  }
  return seated;
}

/**
 * SAY IT ONCE, AND AGAIN ONLY WHEN IT CHANGES.
 *
 * The sweep runs every twenty seconds for the life of the process, so a shortfall
 * that logs on every pass is 4,320 identical lines a day burying everything else in
 * the worker's log — for a condition that has not moved since the first one. What
 * an operator needs to see is the TRANSITION: the roster fell short, or somebody
 * added names and it is now less short.
 *
 * In memory rather than in a row, because it is a log-throttle and not state: a
 * process that restarts and says it once more has cost nothing, and a second worker
 * saying it once is not a problem worth a table.
 */
const lastShortfall = new Map<string, string>();

function reportShortRoster(log: FastifyBaseLogger, seasonId: string, have: number, want: number): void {
  const state = `${String(have)}/${String(want)}`;
  if (lastShortfall.get(seasonId) === state) return;
  lastShortfall.set(seasonId, state);
  log.warn(
    { seasonId, want, have },
    'the bot roster is short of names; add more with the bots CLI rather than expecting the sweep to invent them',
  );
}

/**
 * Read every seated commander back with the galaxy it is standing in.
 *
 * The season seed supplies each bot's decision context; session state is persisted
 * on the profile so every worker reads the same activity decision.
 */
async function seatedBots(db: Db): Promise<SeatedBot[]> {
  return db
    .select({
      accountId: botProfiles.accountId,
      ordinal: botProfiles.ordinal,
      persona: botProfiles.persona,
      nextActionAt: botProfiles.nextActionAt,
      lastActiveAt: players.lastActiveAt,
      sessionPlayerId: botProfiles.sessionPlayerId,
      sessionStartedAt: botProfiles.sessionStartedAt,
      sessionUntilAt: botProfiles.sessionUntilAt,
      playerId: players.id,
      planetId: planets.id,
      seasonId: seasons.id,
      seasonSeed: seasons.seed,
    })
    .from(botProfiles)
    .innerJoin(players, eq(players.accountId, botProfiles.accountId))
    .innerJoin(seasons, and(eq(seasons.id, players.seasonId), eq(seasons.status, 'live')))
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .where(and(
      eq(shards.role, 'MAIN'),
      isNull(botProfiles.retiredAt),
      notInArray(shards.code, [...BOTS.excludedShardCodes]),
    ))
    .orderBy(asc(botProfiles.ordinal));
}

/** Every commander at the controls right now, across every live galaxy. */
function awakeAcross(bots: readonly SeatedBot[], at: Date): SeatedBot[] {
  if (botQuietAt(at)) return [];
  return bots.filter((bot) =>
    bot.sessionPlayerId === bot.playerId
    && bot.sessionStartedAt !== null
    && bot.sessionStartedAt <= at
    && bot.sessionUntilAt !== null
    && bot.sessionUntilAt > at);
}

/** Each worker recomputes demand once per five-minute bucket, including at boot. */
const lastActivityBucket = new Map<string, number>();

async function reconcileSessions(db: Db, now: Date): Promise<void> {
  const live = await db
    .select({ seasonId: seasons.id, code: shards.code })
    .from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasons.status, 'live'), eq(shards.role, 'MAIN')));
  const bucket = Math.floor(now.getTime() / BOT_ACTIVITY_BUCKET_MS);
  for (const season of live) {
    if (BOTS.excludedShardCodes.includes(season.code)) continue;
    if (lastActivityBucket.get(season.seasonId) === bucket) continue;
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bot-session:${season.seasonId}`}))`);
      const rows = await tx
        .select({
          accountId: botProfiles.accountId,
          ordinal: botProfiles.ordinal,
          playerId: players.id,
          nextActionAt: botProfiles.nextActionAt,
          sessionPlayerId: botProfiles.sessionPlayerId,
          startedAt: botProfiles.sessionStartedAt,
          untilAt: botProfiles.sessionUntilAt,
        })
        .from(botProfiles)
        .innerJoin(players, eq(players.accountId, botProfiles.accountId))
        .where(and(eq(players.seasonId, season.seasonId), isNull(botProfiles.retiredAt)))
        .orderBy(asc(botProfiles.ordinal));
      if (rows.length === 0) return;
      const [active] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(and(
          eq(players.seasonId, season.seasonId),
          gte(players.lastActiveAt, new Date(now.getTime() - SERVERS.onlineWindowMinutes * 60_000)),
          isPerson,
        ));
      const candidates: BotSessionCandidate[] = rows.map((row) => ({
        accountId: row.accountId,
        ordinal: row.ordinal,
        playerId: row.playerId,
        sessionPlayerId: row.sessionPlayerId,
        startedAt: row.startedAt,
        untilAt: row.untilAt,
      }));
      const plan = planBotSessions(candidates, botAwakeTarget(active?.n ?? 0, rows.length), now);
      if (plan.stop.length > 0) {
        await tx.update(botProfiles).set({ sessionUntilAt: now })
          .where(and(inArray(botProfiles.accountId, plan.stop), isNull(botProfiles.retiredAt)));
      }
      for (const extension of plan.extend) {
        await tx.update(botProfiles).set({ sessionUntilAt: extension.untilAt })
          .where(and(eq(botProfiles.accountId, extension.accountId), isNull(botProfiles.retiredAt)));
      }
      const due = new Map(rows.map((row) => [row.accountId, row.nextActionAt]));
      for (const bot of plan.start) {
        const rng = mulberry32(hashSeed('astera:bots:first-turn', bot.playerId, now.getTime()));
        const firstTurn = new Date(now.getTime() + Math.floor(rng() * BOT_ACTIVITY_BUCKET_MS));
        const existing = due.get(bot.accountId);
        await tx.update(botProfiles).set({
          sessionPlayerId: bot.playerId,
          sessionStartedAt: now,
          sessionUntilAt: new Date(now.getTime() + 60 * 60_000),
          nextActionAt: existing && existing < firstTurn ? existing : firstTurn,
        }).where(and(eq(botProfiles.accountId, bot.accountId), isNull(botProfiles.retiredAt)));
      }
    });
    lastActivityBucket.set(season.seasonId, bucket);
  }
}

/** When this commander next does something. Jittered so bots do not move together. */
const nextTurnAt = (at: Date, playerId: string): Date => {
  const rng = mulberry32(hashSeed('astera:bots:gap', playerId, at.getTime()));
  const { min, max } = BOTS.turnGapMinutes;
  return new Date(at.getTime() + (min + rng() * (max - min)) * 60_000);
};

export async function runBotSweep(
  db: Db,
  clock: Clock,
  log: FastifyBaseLogger,
  perGalaxy: number = BOTS.maxPerGalaxy,
): Promise<BotSweepResult> {
  const seated = await ensureBotSeats(db, clock, log, perGalaxy);
  const now = clock.now();
  await reconcileSessions(db, now);
  const bots = await seatedBots(db);
  if (bots.length === 0) return { seated, awake: 0, turns: 0 };

  const awake = awakeAcross(bots, now);

  /*
    PRESENCE, AND IT IS THE HALF OF THIS FEATURE THE OWNER ASKED FOR BY NAME.

    `players.last_active_at` is the single source of both population figures — the
    live five-minute count on the disc and the twenty-four-hour one beside it — so a
    commander who is at the controls is counted by writing the same column
    `Presence.touch` writes for a person. Nothing on the web side changes, and the
    two figures cannot disagree, because there is only one figure.

    One statement for the whole roster. A sleeping commander is not touched at all,
    which is what makes the quiet hours visible in the number rather than merely
    true in the schedule.
  */
  if (awake.length > 0) {
    await db
      .update(players)
      // D212: the server's own commanders are the population, never Silent Space's guests.
      .set({ lastActiveAt: now, lastProgressAt: now })
      .where(inArray(players.id, awake.map((bot) => bot.playerId)));
  }

  /*
    OLDEST DUE FIRST, so a commander passed over for the latency budget is the next
    one taken rather than the one starved. Without the sort the read order (by
    ordinal) would let the same low ordinals eat the budget every sweep.
  */
  const due = awake
    .filter((bot) => bot.nextActionAt <= now)
    .sort((a, b) => a.nextActionAt.getTime() - b.nextActionAt.getTime()
      || a.ordinal - b.ordinal);

  let turns = 0;
  for (const bot of due) {
    if (turns >= BOTS.turnsPerSweep) break;
    const claimed = await claimTurn(db, bot, now);
    if (!claimed) continue;
    const seat: BotSeat = {
      accountId: bot.accountId,
      playerId: bot.playerId,
      planetId: bot.planetId,
      seasonId: bot.seasonId,
      seasonSeed: bot.seasonSeed,
      ordinal: bot.ordinal,
      persona: bot.persona,
    };
    try {
      const result = await runBotTurn(db, clock, seat, log);
      turns++;
      if (result.did.length > 0) log.debug({ ordinal: bot.ordinal, did: result.did }, 'bot turn');
    } catch (err) {
      // One commander's turn failing is one commander's turn. The rest of the
      // roster, and the event queue behind this sweep, carry on.
      log.error({ err, ordinal: bot.ordinal }, 'bot turn threw');
    }
  }

  return { seated, awake: awake.length, turns };
}

/**
 * Take this commander's turn, or find that somebody else already has.
 *
 * The clock moves BEFORE the turn runs, deliberately. A turn that throws halfway is
 * not retried a second later: it is a session, not a fleet, and the honest response
 * to one going wrong is to wait for the next one like a player would.
 */
async function claimTurn(db: Db, bot: SeatedBot, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    /*
      THE PROFILE ROW ALONE, AND THE JOIN THAT USED TO BE HERE WAS A LOCK NOBODY
      ASKED FOR.

      `FOR UPDATE` over a join locks a row in BOTH tables, so claiming a turn also
      took a row lock on `players` — a row the research lane locks, `bookBattle`
      writes and the reclaim sweep re-reads. Under `SKIP LOCKED` that does not
      deadlock, it does something quieter and worse: a commander whose world is
      being raided at that instant is silently passed over for a turn. Nothing here
      needs the player row; the caller already read it.
    */
    const [row] = await tx
      .select({ accountId: botProfiles.accountId })
      .from(botProfiles)
      .where(and(
        eq(botProfiles.accountId, bot.accountId),
        lte(botProfiles.nextActionAt, now),
        isNull(botProfiles.retiredAt),
        eq(botProfiles.sessionPlayerId, bot.playerId),
        lte(botProfiles.sessionStartedAt, now),
        gt(botProfiles.sessionUntilAt, now),
      ))
      .for('update', { skipLocked: true })
      .limit(1);
    if (!row) return false;
    await tx
      .update(botProfiles)
      .set({ nextActionAt: nextTurnAt(now, bot.playerId) })
      .where(eq(botProfiles.accountId, bot.accountId));
    return true;
  });
}

/** For `/health`: how many commanders the server is playing, and how many are on. */
export async function botStatus(
  db: Db,
  clock: Clock,
  operatorCap: number = BOTS.maxPerGalaxy,
): Promise<{
  seated: number;
  awake: number;
  galaxies: {
    seasonId: string;
    people: number;
    activePeople: number;
    targetSeats: number;
    seated: number;
    targetAwake: number;
    awake: number;
  }[];
}> {
  const now = clock.now();
  const bots = await seatedBots(db);
  // A persisted session can outlive a stopped worker. Presence is the evidence
  // that it is actually being driven, with the same window as the online count.
  const awake = awakeAcross(bots, now).filter((bot) =>
    bot.lastActiveAt >= new Date(now.getTime() - SERVERS.onlineWindowMinutes * 60_000));
  const live = await db
    .select({ seasonId: seasons.id, code: shards.code })
    .from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasons.status, 'live'), eq(shards.role, 'MAIN')));
  const galaxies = await Promise.all(live.map(async (season) => {
    const [people, [active]] = await Promise.all([
      peopleIn(db, season.seasonId),
      db.select({ n: sql<number>`count(*)::int` }).from(players).where(and(
        eq(players.seasonId, season.seasonId),
        gte(players.lastActiveAt, new Date(now.getTime() - SERVERS.onlineWindowMinutes * 60_000)),
        isPerson,
      )),
    ]);
    const seated = bots.filter((bot) => bot.seasonId === season.seasonId).length;
    const activePeople = active?.n ?? 0;
    return {
      seasonId: season.seasonId,
      people,
      activePeople,
      targetSeats: BOTS.excludedShardCodes.includes(season.code) ? 0 : botSeatTarget(people, operatorCap),
      seated,
      targetAwake: botQuietAt(now) ? 0 : botAwakeTarget(activePeople, seated),
      awake: awake.filter((bot) => bot.seasonId === season.seasonId).length,
    };
  }));
  return { seated: bots.length, awake: awake.length, galaxies };
}
