import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { SERVERS, hashSeed, mulberry32 } from '@astera/rules';
import type { Db } from '../../db/client.js';
import type { Clock } from '../../clock.js';
import { botProfiles, planets, players, seasons } from '../../db/schema.js';
import { joinSeason } from '../player.js';
import { GameError } from '../planet.js';
import { BOTS } from './personas.js';
import { botsAwakeAt } from './schedule.js';
import { runBotTurn, type BotSeat } from './brain.js';

/**
 * THE ONE THING THAT DRIVES THEM. D159.
 *
 * A fixed-cadence sweep on the worker's own clock, beside the stranded-flight
 * repair and the idle-seat reclaim, rather than a new `scheduled_events` kind. The
 * queue exists for MOMENTS the world is waiting on — a raid settling, a fleet
 * landing — and it earns its enum value, its handler, its abandon branch and its
 * health entry by being unable to be missed. A bot's turn is the opposite: missing
 * one costs a commander one upgrade, and the next sweep is a minute away. Paying
 * the queue's whole tax for that would be paying for a guarantee nobody needs.
 *
 * `reclaimIdleSeats` is the shape being copied, and its rule applies here word for
 * word: housekeeping may never stop the event queue. The caller wraps this in its
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
}

/**
 * Seat every commander in the pool that is not yet on a galaxy.
 *
 * The target is per galaxy and the pool is global, so a short pool is a WARNING and
 * never a prompt to invent a name — a generated commander beside the owner's own is
 * the one mistake this system cannot take back.
 */
export async function ensureBotSeats(
  db: Db,
  clock: Clock,
  log: FastifyBaseLogger,
): Promise<number> {
  const live = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, 'live'))
    .orderBy(asc(seasons.startsAt), asc(seasons.id));
  if (live.length === 0) return 0;

  const profiles = await db
    .select({ accountId: botProfiles.accountId, ordinal: botProfiles.ordinal })
    .from(botProfiles)
    .orderBy(asc(botProfiles.ordinal));
  if (profiles.length === 0) return 0;

  const placed = await db
    .select({ accountId: players.accountId, seasonId: players.seasonId })
    .from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId));
  const seasonOf = new Map(placed.map((row) => [row.accountId, row.seasonId]));

  let seated = 0;
  let free = profiles.filter((profile) => !seasonOf.has(profile.accountId));

  for (const season of live) {
    const here = placed.filter((row) => row.seasonId === season.id).length;
    const need = BOTS.perGalaxy - here;
    if (need <= 0) continue;
    if (free.length < need) reportShortRoster(log, season.id, here + free.length);
    const taking = free.slice(0, need);
    free = free.slice(taking.length);
    for (const profile of taking) {
      try {
        await joinSeason(db, profile.accountId, season.id, clock);
        /*
          SEATING IS NOT PLAYING, AND THE POPULATION FIGURE MUST NOT SAY IT IS.

          `joinSeason` stamps `last_active_at` with the instant of the join, which
          is right for a person — they are, by definition, at the controls. A bot
          seated at 04:00 is not, and twelve of them appearing in the live count in
          the middle of the quiet hours is precisely the thing the blackout exists
          to prevent. Backdated past the online window, so the only thing that ever
          puts one of these commanders into the population is the presence stamp
          below, which fires only when the roster says they are awake.
        */
        await db
          .update(players)
          .set({
            lastActiveAt: new Date(
              clock.now().getTime() - (SERVERS.onlineWindowMinutes + 1) * 60_000,
            ),
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
 * The sweep runs every sixty seconds for the life of the process, so a shortfall
 * that logs on every pass is 1,440 identical lines a day burying everything else in
 * the worker's log — for a condition that has not moved since the first one. What
 * an operator needs to see is the TRANSITION: the roster fell short, or somebody
 * added names and it is now less short.
 *
 * In memory rather than in a row, because it is a log-throttle and not state: a
 * process that restarts and says it once more has cost nothing, and a second worker
 * saying it once is not a problem worth a table.
 */
const lastShortfall = new Map<string, number>();

function reportShortRoster(log: FastifyBaseLogger, seasonId: string, have: number): void {
  if (lastShortfall.get(seasonId) === have) return;
  lastShortfall.set(seasonId, have);
  log.warn(
    { seasonId, want: BOTS.perGalaxy, have },
    'the bot roster is short of names; add more with the bots CLI rather than expecting the sweep to invent them',
  );
}

/**
 * Read every seated commander back with the galaxy it is standing in.
 *
 * The season seed is what keys the shift roster, so two galaxies never run the same
 * rota — and the same galaxy runs the same rota on every process that asks.
 */
async function seatedBots(db: Db): Promise<SeatedBot[]> {
  return db
    .select({
      accountId: botProfiles.accountId,
      ordinal: botProfiles.ordinal,
      persona: botProfiles.persona,
      nextActionAt: botProfiles.nextActionAt,
      playerId: players.id,
      planetId: planets.id,
      seasonId: seasons.id,
      seasonSeed: seasons.seed,
    })
    .from(botProfiles)
    .innerJoin(players, eq(players.accountId, botProfiles.accountId))
    .innerJoin(seasons, and(eq(seasons.id, players.seasonId), eq(seasons.status, 'live')))
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .orderBy(asc(botProfiles.ordinal));
}

/**
 * WHICH OF THIS GALAXY'S COMMANDERS ARE AWAKE, INDEXED WITHIN THE GALAXY.
 *
 * `ordinal` is global — the roster spans every shard — while the shift curve is
 * about ONE sky. So a galaxy's own bots are ranked by ordinal and the rota is run
 * over that ranking. A galaxy holding six of the twelve gets the same shape scaled
 * to six, rather than whichever six happen to sit low in the global numbering.
 */
function awakeIn(bots: readonly SeatedBot[], seasonSeed: number, at: Date): Set<string> {
  const ranked = [...bots].sort((a, b) => a.ordinal - b.ordinal);
  const awake = botsAwakeAt(ranked.length, seasonSeed, at);
  const out = new Set<string>();
  ranked.forEach((bot, index) => {
    if (awake.has(index)) out.add(bot.accountId);
  });
  return out;
}

/** Every commander at the controls right now, across every live galaxy. */
function awakeAcross(bots: readonly SeatedBot[], at: Date): SeatedBot[] {
  const bySeason = new Map<string, SeatedBot[]>();
  for (const bot of bots) {
    const galaxy = bySeason.get(bot.seasonId) ?? [];
    galaxy.push(bot);
    bySeason.set(bot.seasonId, galaxy);
  }
  const awake: SeatedBot[] = [];
  for (const [, galaxy] of bySeason) {
    const on = awakeIn(galaxy, galaxy[0]?.seasonSeed ?? 0, at);
    for (const bot of galaxy) if (on.has(bot.accountId)) awake.push(bot);
  }
  return awake;
}

/** When this commander next does something. Jittered, so twelve of them never move together. */
const nextTurnAt = (at: Date, playerId: string): Date => {
  const rng = mulberry32(hashSeed('astera:bots:gap', playerId, at.getTime()));
  const { min, max } = BOTS.turnGapMinutes;
  return new Date(at.getTime() + (min + rng() * (max - min)) * 60_000);
};

export async function runBotSweep(
  db: Db,
  clock: Clock,
  log: FastifyBaseLogger,
): Promise<BotSweepResult> {
  const seated = await ensureBotSeats(db, clock, log);
  const now = clock.now();
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
      .set({ lastActiveAt: now })
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
export async function botStatus(db: Db, clock: Clock): Promise<{ seated: number; awake: number }> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(botProfiles);
  const bots = await seatedBots(db);
  return { seated: row?.n ?? 0, awake: awakeAcross(bots, clock.now()).length };
}
