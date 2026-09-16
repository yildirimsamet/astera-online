import { and, asc, desc, eq, exists, gte, inArray, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RIVAL, SERVERS, seasonRankRewardProgram } from '@astera/rules';
import {
  botProfiles,
  planets,
  playerRivals,
  players,
  seasonCycles,
  seasonResults,
  seasons,
  shards,
} from '../db/schema.js';
import type { Queryable } from '../db/client.js';
import { addMinutes } from '../clock.js';
import { protectionFrom } from '../services/attackProtection.js';
import { averageSeasonStats, sumSeasonStats } from '../services/seasonArchive.js';
import { GameError } from '../services/planet.js';
import { requireAuth } from './auth.js';

/**
 * The clock of the galaxy the caller is standing in.
 *
 * DERIVED FROM THE PLAYER, NOT FROM CONFIGURATION. Until D21 this read a
 * `SHARD_CODE` environment variable, which is correct for exactly as long as there
 * is one galaxy — the moment there is more than one, an env var means every player is told
 * the season, the seed and the deadline of `EU-1` whichever galaxy they are
 * actually in. The seed is the worst of those: the client rebuilds the entire disc
 * and every asteroid orbit from it, so a wrong one draws a world the server does
 * not have, and mining resolves against rocks the player never saw.
 */
export function registerSeasonRoutes(app: FastifyInstance): void {
  app.get('/api/season-archive', { preHandler: requireAuth }, async (req) => {
    const query = z.object({
      cursor: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(24).default(12),
    }).parse(req.query);
    /*
      PAGE WHAT CAN BE SHOWN, NOT WHAT HAPPENS TO EXIST IN THE CYCLE TABLE.

      Production carries bootstrap cycles, finished empty galaxies and parked
      WAITING shards between real records. Taking twelve raw cycles and filtering
      afterwards once produced a one-button rail with older results behind a next
      page that could only be requested by scrolling — but one button cannot
      scroll. The correlated predicate keeps the query bounded while making every
      row that consumes `limit` eligible to survive the projection below.
    */
    const visibleCycle = exists(app.db
      .select({ id: seasons.id })
      .from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(
        eq(seasons.cycleId, seasonCycles.id),
        ne(shards.role, 'WAITING'),
        or(
          inArray(seasons.status, ['live', 'pending']),
          exists(app.db
            .select({ accountId: seasonResults.accountId })
            .from(seasonResults)
            .where(eq(seasonResults.seasonId, seasons.id))),
        ),
      )));
    const cycleRows = await app.db
      .select()
      .from(seasonCycles)
      .where(and(
        query.cursor === undefined ? undefined : lt(seasonCycles.ordinal, query.cursor),
        visibleCycle,
      ))
      .orderBy(desc(seasonCycles.ordinal))
      .limit(query.limit + 1);
    const page = cycleRows.slice(0, query.limit);
    if (page.length === 0) return { cycles: [], nextCursor: null };

    /*
      SILENT SPACE IS NOT A SEASON ANYBODY COMPETED IN. Owner instruction.

      A WAITING shard is where commanders are parked when they stop playing — it
      has a leaderboard because every galaxy does, not because anybody raced in
      it. Listing it beside the real galaxies puts a season in the archive that
      nobody chose to enter and, on the live field, it is the LARGEST one there.
      The results stay sealed in the database; they are simply not offered as a
      competition to browse.
    */
    const galaxyRows = await app.db
      .select({ season: seasons, shard: shards })
      .from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(
        inArray(seasons.cycleId, page.map((cycle) => cycle.id)),
        ne(shards.role, 'WAITING'),
      ))
      .orderBy(asc(shards.ordinal));
    /*
      A FINISHED GALAXY EARNS ITS ROW BY HAVING SOMEBODY IN IT.

      Measured on the live database the day before this shipped: eighteen cycles,
      twenty completed galaxies, and FOURTEEN with no sealed result at all —
      bootstraps, abandoned test worlds and shards opened and rolled before anyone
      played them. Listing those makes most of the season selector open onto "no
      results", which a player reads as a broken feature rather than as an honest
      gap in the record.

      A LIVE or PENDING galaxy is always kept: it is the world being played, and it
      has no sealed results yet by definition. Only a FINISHED one has to show
      something for itself.
    */
    const sealed = new Set((await app.db
      .selectDistinct({ seasonId: seasonResults.seasonId })
      .from(seasonResults)
      .where(inArray(seasonResults.seasonId, galaxyRows.map((row) => row.season.id)))
    ).map((row) => row.seasonId));
    const galaxiesByCycle = new Map<string, typeof galaxyRows>();
    for (const row of galaxyRows) {
      const finished = row.season.status === 'frozen' || row.season.status === 'wiped';
      if (finished && !sealed.has(row.season.id)) continue;
      const grouped = galaxiesByCycle.get(row.season.cycleId) ?? [];
      grouped.push(row);
      galaxiesByCycle.set(row.season.cycleId, grouped);
    }
    const cycles = page.map((cycle) => {
      const galaxies = galaxiesByCycle.get(cycle.id) ?? [];
      const statuses = galaxies.map((row) => row.season.status);
      const status = statuses.includes('live')
        ? 'live'
        : statuses.includes('frozen') ? 'frozen' : 'wiped';
      return {
        ordinal: cycle.ordinal,
        startsAt: cycle.startsAt,
        endsAt: cycle.endsAt,
        status,
        galaxies: galaxies.map(({ season, shard }) => ({
          seasonId: season.id,
          shard: shard.code,
          shardName: shard.name === '' ? shard.code : shard.name,
          status: season.status,
        })),
      };
    });
    /*
      THE CURSOR COMES FROM THE PAGE THAT WAS READ, NOT FROM THE ONE THAT SURVIVED
      THE FILTER. Paging on the last SHOWN ordinal would re-read every cycle the
      filter just dropped, for ever, and a page that dropped all of them would have
      no cursor to continue from at all.
    */
    const lastRead = page.at(-1);
    return {
      cycles: cycles.filter((cycle) => cycle.galaxies.length > 0),
      nextCursor: cycleRows.length > query.limit && lastRead ? lastRead.ordinal : null,
    };
  });

  app.get('/api/season-archive/:seasonId/leaderboard', { preHandler: requireAuth }, async (req) => {
    const { seasonId } = z.object({ seasonId: z.string().uuid() }).parse(req.params);
    const [context] = await app.db
      .select({ season: seasons, cycle: seasonCycles, shard: shards })
      .from(seasons)
      .innerJoin(seasonCycles, eq(seasonCycles.id, seasons.cycleId))
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(eq(seasons.id, seasonId))
      .limit(1);
    if (!context) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
    if (context.season.status === 'live' || context.season.status === 'pending') {
      throw new GameError('SEASON_NOT_COMPLETE', 'That season is still live', 409);
    }

    const rows = await app.db
      .select()
      .from(seasonResults)
      .where(eq(seasonResults.seasonId, seasonId))
      .orderBy(asc(seasonResults.finalRank));
    return {
      season: {
        seasonId: context.season.id,
        ordinal: context.cycle.ordinal,
        shard: context.shard.code,
        shardName: context.shard.name === '' ? context.shard.code : context.shard.name,
        status: context.season.status,
        startsAt: context.season.startsAt,
        endsAt: context.season.endsAt,
        closedAt: context.season.closedAt,
        endReason: context.season.endReason,
      },
      ladder: rows.map((row) => ({
        resultId: row.publicId,
        rank: row.finalRank,
        commanderName: row.recap.commanderName,
        dominion: row.dominion,
        title: row.title,
        self: row.accountId === req.accountId,
        reward: null,
      })),
    };
  });

  app.get('/api/season-archive/results/:resultId', { preHandler: requireAuth }, async (req) => {
    const { resultId } = z.object({ resultId: z.string().uuid() }).parse(req.params);
    const [selected] = await app.db
      .select({ result: seasonResults, season: seasons, cycle: seasonCycles, shard: shards })
      .from(seasonResults)
      .innerJoin(seasons, eq(seasons.id, seasonResults.seasonId))
      .innerJoin(seasonCycles, eq(seasonCycles.id, seasonResults.cycleId))
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(eq(seasonResults.publicId, resultId))
      .limit(1);
    if (!selected) throw new GameError('SEASON_RESULT_NOT_FOUND', 'No such season result', 404);
    if (selected.season.status === 'live' || selected.season.status === 'pending') {
      throw new GameError('SEASON_NOT_COMPLETE', 'That season is still live', 409);
    }

    const completed = await app.db
      .select({ result: seasonResults, season: seasons, cycle: seasonCycles, shard: shards })
      .from(seasonResults)
      .innerJoin(seasons, eq(seasons.id, seasonResults.seasonId))
      .innerJoin(seasonCycles, eq(seasonCycles.id, seasonResults.cycleId))
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(
        eq(seasonResults.accountId, selected.result.accountId),
        inArray(seasons.status, ['frozen', 'wiped']),
        // Same rule as the index: a parked galaxy is not a season played.
        ne(shards.role, 'WAITING'),
      ))
      .orderBy(desc(seasonCycles.ordinal));
    const ranks = completed.map((row) => row.result.finalRank);
    const completedStats = completed.flatMap((row) => row.result.stats === null
      ? []
      : [row.result.stats]);
    /*
      HOW MANY COMMANDERS THIS RANK WAS EARNED AGAINST.

      "12th" is a number. "12th of 257 — top 5%" is a position, and a position is
      the thing a player repeats to somebody else. Without the denominator the
      rank on a permanent record means nothing: first of four and first of three
      hundred are the same line of text.
    */
    const [field] = await app.db
      .select({ n: sql<number>`count(*)::int` })
      .from(seasonResults)
      .where(eq(seasonResults.seasonId, selected.result.seasonId));
    const [legacyRows, botRows] = await Promise.all([
      app.db
        .select({
          accountId: seasonResults.accountId,
          recap: seasonResults.recap,
          damageDealt: seasonResults.damageDealt,
          damageTaken: seasonResults.damageTaken,
        })
        .from(seasonResults)
        .where(eq(seasonResults.seasonId, selected.result.seasonId)),
      app.db.select({ accountId: botProfiles.accountId }).from(botProfiles),
    ]);
    const botAccountIds = new Set(botRows.map((row) => row.accountId));
    const legacyCohort = legacyRows.filter((row) => !botAccountIds.has(row.accountId));
    const legacyTotals = legacyCohort.reduce((total, row) => ({
      battles: total.battles + row.recap.battles,
      attacks: total.attacks + row.recap.attacks,
      defences: total.defences + row.recap.defences,
      damageDealt: total.damageDealt + row.damageDealt,
      damageTaken: total.damageTaken + row.damageTaken,
    }), { battles: 0, attacks: 0, defences: 0, damageDealt: 0, damageTaken: 0 });
    const legacyAverages = legacyCohort.length === 0 ? null : {
      cohortSize: legacyCohort.length,
      competition: {
        battles: legacyTotals.battles / legacyCohort.length,
        attacks: legacyTotals.attacks / legacyCohort.length,
        defences: legacyTotals.defences / legacyCohort.length,
        damageDealt: legacyTotals.damageDealt / legacyCohort.length,
        damageTaken: legacyTotals.damageTaken / legacyCohort.length,
      },
    };
    const cohortRows = selected.result.stats === null ? [] : await app.db
      .select({ stats: seasonResults.stats })
      .from(seasonResults)
      .where(and(
        eq(seasonResults.seasonId, selected.result.seasonId),
        eq(seasonResults.averageEligible, true),
        isNotNull(seasonResults.stats),
      ));
    const cohortStats = cohortRows.flatMap((row) => row.stats === null ? [] : [row.stats]);

    return {
      selected: {
        resultId: selected.result.publicId,
        seasonId: selected.season.id,
        ordinal: selected.cycle.ordinal,
        shard: selected.shard.code,
        shardName: selected.shard.name === '' ? selected.shard.code : selected.shard.name,
        status: selected.season.status,
        startsAt: selected.season.startsAt,
        endsAt: selected.season.endsAt,
        closedAt: selected.season.closedAt,
        endReason: selected.season.endReason,
        commanderName: selected.result.recap.commanderName,
        planetName: selected.result.recap.planetName,
        rank: selected.result.finalRank,
        /** The size of the field that rank was taken from. */
        commanders: field?.n ?? 0,
        dominion: selected.result.dominion,
        title: selected.result.title,
        recap: selected.result.recap,
        legacyStats: {
          competition: {
            battles: selected.result.recap.battles,
            attacks: selected.result.recap.attacks,
            defences: selected.result.recap.defences,
            damageDealt: selected.result.damageDealt,
            damageTaken: selected.result.damageTaken,
          },
        },
        legacyAverages,
        stats: selected.result.stats,
        averages: averageSeasonStats(cohortStats),
        reward: null,
      },
      career: {
        completedSeasons: completed.length,
        bestRank: ranks.length === 0 ? null : Math.min(...ranks),
        championships: ranks.filter((rank) => rank === 1).length,
        podiums: ranks.filter((rank) => rank <= 3).length,
        topTen: ranks.filter((rank) => rank <= 10).length,
        competitionTotals: completed.reduce((total, row) => ({
          seasonsCovered: total.seasonsCovered + 1,
          battles: total.battles + row.result.recap.battles,
          attacks: total.attacks + row.result.recap.attacks,
          defences: total.defences + row.result.recap.defences,
          damageDealt: total.damageDealt + row.result.damageDealt,
          damageTaken: total.damageTaken + row.result.damageTaken,
        }), {
          seasonsCovered: 0,
          battles: 0,
          attacks: 0,
          defences: 0,
          damageDealt: 0,
          damageTaken: 0,
        }),
        totals: completedStats.length === 0 ? null : {
          seasonsCovered: completedStats.length,
          partialSeasons: completedStats.filter((stats) => stats.coverage?.kind === 'partial').length,
          stats: sumSeasonStats(completedStats),
        },
        seasons: completed.map((row) => ({
          resultId: row.result.publicId,
          seasonId: row.season.id,
          ordinal: row.cycle.ordinal,
          shard: row.shard.code,
          shardName: row.shard.name === '' ? row.shard.code : row.shard.name,
          status: row.season.status,
          startsAt: row.season.startsAt,
          endsAt: row.season.endsAt,
          closedAt: row.season.closedAt,
          endReason: row.season.endReason,
          commanderName: row.result.recap.commanderName,
          rank: row.result.finalRank,
          dominion: row.result.dominion,
          title: row.result.title,
          statsAvailable: row.result.stats !== null,
        })),
      },
    };
  });

  app.get('/api/season', { preHandler: requireAuth }, async (req) => {
    const [row] = await app.db
      .select({
        season: seasons,
        shard: shards,
        accountId: players.accountId,
        playerId: players.id,
        shieldUntil: players.newcomerShieldUntil,
        recoveryShieldUntil: players.recoveryShieldUntil,
        rewardProgramVersion: seasonCycles.rewardProgramVersion,
      })
      .from(players)
      .innerJoin(seasons, eq(players.seasonId, seasons.id))
      .innerJoin(shards, eq(seasons.shardId, shards.id))
      .innerJoin(seasonCycles, eq(seasonCycles.id, seasons.cycleId))
      .where(eq(players.accountId, req.accountId!))
      .limit(1);

    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

    /**
     * HOW MANY WORLDS, AND HOW MANY OF THEM HAVE SOMEBODY AT THE CONTROLS.
     *
     * `online` is here rather than on a second request because the caller already
     * reads this payload for the season clock, and a galaxy screen asking twice to
     * put one number in a corner is two round trips for one tap.
     *
     * The window is `SERVERS.onlineWindowMinutes`, the same one the server list
     * uses — deliberately, because two surfaces disagreeing about how many people
     * are in a galaxy is worse than either figure being wrong. It is generous on
     * purpose: this game is played in gaps, and a commander reading a battle
     * report for four minutes has not left.
     *
     * It leaks nothing. The population of a galaxy is already public on
     * `/api/servers` to somebody who has not even signed in.
     */
    const since = addMinutes(app.clock.now(), -SERVERS.onlineWindowMinutes);
    /**
     * AND HOW MANY HAVE BEEN HERE TODAY. Owner instruction.
     *
     * The live figure alone reads as an empty galaxy at every hour that is not
     * peak, because it is a five-minute slice of a game played in gaps. This is
     * the same column, the same index and the same grouped shape over a day, so
     * the second reading costs one more `count(*)` on a request that was already
     * being made — no presence table, no cache to invalidate, and nothing that can
     * fall out of step with the first figure.
     *
     * IT REFRESHES BECAUSE THE PAYLOAD DOES. `useSeason` re-reads once a minute
     * (see `queries.ts`), so the day figure moves as commanders arrive without a
     * broadcast per login — which at three hundred seats would be a shard event a
     * minute to move a number in a corner.
     */
    const today = addMinutes(app.clock.now(), -SERVERS.dayWindowMinutes);
    const [[count], [active], [seenToday], [result]] = await Promise.all([
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(eq(players.seasonId, row.season.id)),
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(and(eq(players.seasonId, row.season.id), gte(players.lastActiveAt, since))),
      app.db
        .select({ n: sql<number>`count(*)::int` })
        .from(players)
        .where(and(eq(players.seasonId, row.season.id), gte(players.lastActiveAt, today))),
      app.db
        .select()
        .from(seasonResults)
        .where(and(
          eq(seasonResults.seasonId, row.season.id),
          eq(seasonResults.accountId, row.accountId),
        )),
    ]);

    const protection = protectionFrom(
      row.shieldUntil,
      row.recoveryShieldUntil,
      app.clock.now(),
    );
    // Silent Space is a parking lane, not a competition. Do not advertise a
    // prize there that its season-end handler deliberately cannot award.
    const rewardProgram = row.shard.role === 'WAITING'
      ? null
      : seasonRankRewardProgram(row.rewardProgramVersion);

    return {
      seasonId: row.season.id,
      shard: row.shard.code,
      shardName: row.shard.name === '' ? row.shard.code : row.shard.name,
      /**
       * The galaxy is never stored slot by slot — it is regenerated from this seed
       * wherever it is needed. Handing it to the client lets the 3D surface build
       * the disc and the asteroid orbits locally instead of downloading them, which
       * is what A5 meant by "nothing is stored that a formula and a clock can
       * derive". It reveals nothing: the layout is public, and every planet in it
       * is already returned by /api/galaxy.
       */
      seed: row.season.seed,
      status: row.season.status,
      startsAt: row.season.startsAt,
      endsAt: row.season.endsAt,
      playerCap: row.shard.playerCap,
      rulesetVersion: row.season.rulesetVersion,
      players: count?.n ?? 0,
      online: active?.n ?? 0,
      onlineToday: seenToday?.n ?? 0,
      result: result ?? null,
      /** Up to `RIVAL.max` marks, each carrying the slot the disc colours it by. D183. */
      rivals: await rivalsOf(app.db, row.playerId),
      /**
       * THE COMMANDER'S OWN RAID IMMUNITY — WHICHEVER OF THE TWO IS STANDING.
       * D183 · 2026-09-14.
       *
       * Null once both are spent or expired, which is also the ordinary state. On
       * this payload because the launch surface has to say what a raid COSTS before
       * it is pressed — a shield spent without being offered is a shield the player
       * did not choose to spend, and `SHIELD_WOULD_DROP` is the refusal that would
       * otherwise be the first they heard of it.
       *
       * `shieldKind` NAMES IT, because the two cost different things to give up and
       * the HUD and the launch confirmation both have to say which. It is read
       * through `protectionFrom`, the same composition the launch gate enforces, so
       * the countdown can never promise a window the gate would not honour.
       */
      shieldUntil: protection === null ? null : new Date(protection.until),
      shieldKind: protection?.kind ?? null,
      /**
       * WHAT THE TOP OF THE TABLE IS WORTH, WHILE THERE IS STILL TIME TO CLIMB IT.
       *
       * A season that resets everything needs a reason to keep playing in week
       * two, and the reward waiting for the first ten commanders is that reason —
       * but it was reachable NOWHERE in the product. The entitlement was sealed at
       * freeze and paid silently on the next join, so the only way to learn the
       * program existed was to have already won it.
       *
       * READ FROM THE CYCLE'S OWN FROZEN VERSION, never from today's table. A
       * commander is shown the bargain their season was opened under, so a
       * mid-season deploy cannot move a prize somebody is already playing for.
       * Null for a cycle opened before the program, which is the honest answer
       * rather than an offer nothing will honour.
       *
       * IT IS THE TABLE AND NOTHING ELSE. Who currently holds a place is the
       * leaderboard's own public ordering; restating it here would be a second
       * copy of a ranking that must have exactly one source.
       */
      seasonRewards: rewardProgram === null ? null : {
        version: rewardProgram.version,
        minimumDominion: rewardProgram.minimumDominion,
        tiers: rewardProgram.tiers.map((tier) => ({
          place: tier.place,
          alloy: tier.reward.alloy,
          crystal: tier.reward.crystal,
          deuterium: tier.reward.deuterium,
        })),
      },
    };
  });

  /**
   * THE COMMANDERS THIS ONE IS WATCHING, AND THE MARKS ARE FREE TO MOVE. D103 · D183.
   *
   * The mark used to COMMIT: the first probe, battle or Death Star between the two
   * commanders froze it for the rest of the season, and every later press of the
   * control was answered with `RIVAL_COMMITTED`. Owner instruction reverses that —
   * players disliked it, and it was the wrong shape for what the mark is. A Rival
   * is a bookmark on a disc of three hundred worlds, not a declaration; a second
   * press of the same commander clears it, and any world may be marked at any time.
   *
   * AND THERE ARE UP TO `RIVAL.max` OF THEM NOW. D183, owner instruction. One mark
   * is the right shape for a duel and the wrong one for the game being played: a
   * commander with three colonies has three neighbours worth watching before they
   * have an enemy, and the single mark meant choosing which of them to forget.
   *
   * THE PRESS IS A TOGGLE ON THE COMMANDER, NOT ON THE WORLD. D97's reasoning: the
   * mark is about a person, and a commander who holds four colonies would otherwise
   * eat four of the five slots. Pressing any world of an already-marked commander
   * clears that mark.
   *
   * A FULL SET REFUSES RATHER THAN EVICTING. Silently dropping the oldest would
   * make a control that is supposed to remember things forget one without saying
   * so — the exact failure a bookmark cannot have.
   *
   * The encounter history the old lock read is untouched. Battles, strikes and probe
   * readings are still recorded, because the reports, the dossier and the recap are
   * built on them — nothing reads them to refuse anything any more.
   */
  app.post('/api/rival', { preHandler: requireAuth }, async (req) => {
    const body = z.object({ planetId: z.string().uuid().nullable() }).strict().parse(req.body);
    return app.db.transaction(async (tx) => {
      const [me] = await tx
        .select({ playerId: players.id, seasonId: players.seasonId, planetId: planets.id })
        .from(players)
        .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
        .where(eq(players.accountId, req.accountId!))
        .for('update')
        .limit(1);
      if (!me) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

      // `null` empties the disc — the one gesture that clears every mark at once.
      if (body.planetId === null) {
        await tx.delete(playerRivals).where(eq(playerRivals.playerId, me.playerId));
        return { rivals: [] };
      }

      /*
        CLEARING A MARK NEVER ASKS WHETHER THE WORLD IS STILL THERE.

        A marked world can be reclaimed or wiped from the galaxy, and the mark then
        pointed at nothing the commander could press twice — the only way out was
        the menu's "clear the lost marker", which sent `null` and took the other
        four with it. Removing a mark by the planet it was placed on is checked
        FIRST, so a dead anchor is exactly as easy to clear as a live one.
      */
      const byAnchor = await tx
        .delete(playerRivals)
        .where(and(
          eq(playerRivals.playerId, me.playerId),
          eq(playerRivals.planetId, body.planetId),
        ))
        .returning({ slot: playerRivals.slot });
      if (byAnchor.length > 0) return { rivals: await rivalsOf(tx, me.playerId) };

      const [target] = await tx
        .select({ id: planets.id, playerId: planets.controllerPlayerId })
        .from(planets)
        .where(and(
          eq(planets.id, body.planetId),
          eq(planets.seasonId, me.seasonId),
          sql`${planets.controllerPlayerId} IS NOT NULL`,
        ))
        .limit(1);
      if (!target) {
        throw new GameError('RIVAL_NOT_VISIBLE', 'That world is not in your galaxy', 404);
      }
      if (target.playerId === me.playerId) {
        throw new GameError('RIVAL_SELF', 'You cannot mark your own world as a rival', 400);
      }
      if (!target.playerId) {
        throw new GameError('RIVAL_NOT_VISIBLE', 'That world has no commander', 404);
      }

      /*
        THE WHOLE SET, UNDER THE COMMANDER'S OWN ROW LOCK.

        `FOR UPDATE` above is on `players`, so two presses from one account
        serialise here rather than racing for a slot — which is what the unique
        index on `(player_id, slot)` would otherwise have to catch as an error.
      */
      const held = await tx
        .select({ targetPlayerId: playerRivals.targetPlayerId, slot: playerRivals.slot })
        .from(playerRivals)
        .where(eq(playerRivals.playerId, me.playerId));

      const already = held.find((mark) => mark.targetPlayerId === target.playerId);
      if (already) {
        await tx.delete(playerRivals).where(and(
          eq(playerRivals.playerId, me.playerId),
          eq(playerRivals.targetPlayerId, target.playerId),
        ));
        return { rivals: await rivalsOf(tx, me.playerId) };
      }

      if (held.length >= RIVAL.max) {
        throw new GameError(
          'RIVAL_LIMIT',
          `You are already watching ${String(RIVAL.max)} commanders. Clear one first.`,
          409,
          { max: RIVAL.max },
        );
      }

      /*
        THE LOWEST FREE SLOT, BECAUSE A SLOT IS A COLOUR.

        Not `held.length`: clearing the second of three marks would then hand the
        next one a colour already on the disc. The lowest free index also means a
        commander with two marks is shown the first two colours rather than the
        first and the fourth, which is what makes the set read as a set.
      */
      const taken = new Set(held.map((mark) => mark.slot));
      let slot = 0;
      while (taken.has(slot)) slot += 1;

      await tx.insert(playerRivals).values({
        playerId: me.playerId,
        planetId: body.planetId,
        targetPlayerId: target.playerId,
        slot,
      });
      return { rivals: await rivalsOf(tx, me.playerId) };
    });
  });
}

/**
 * EVERY MARK THIS COMMANDER IS KEEPING, IN SLOT ORDER. D183.
 *
 * Slot order rather than insertion order so a legend, a rail and the disc all list
 * them the same way — the slot is the mark's identity, so it is also its place.
 */
async function rivalsOf(
  db: Queryable,
  playerId: string,
): Promise<{ planetId: string; playerId: string; slot: number }[]> {
  const rows = await db
    .select({
      planetId: playerRivals.planetId,
      targetPlayerId: playerRivals.targetPlayerId,
      slot: playerRivals.slot,
    })
    .from(playerRivals)
    .where(eq(playerRivals.playerId, playerId))
    .orderBy(playerRivals.slot);
  return rows.map((row) => ({
    planetId: row.planetId,
    playerId: row.targetPlayerId,
    slot: row.slot,
  }));
}
