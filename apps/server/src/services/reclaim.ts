import { and, eq, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { SERVERS } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  accounts,
  battleReports,
  buildings,
  debrisFields,
  miningRuns,
  missions,
  notifications,
  planets,
  players,
  probeReports,
  requestLog,
  rewardGrants,
  satellites,
  scanEvents,
  scheduledEvents,
  seasons,
  units,
  watches,
} from '../db/schema.js';

/**
 * RECLAIMING THE SEAT OF A COMMANDER WHO STOPPED COMING BACK. Owner instruction.
 *
 * *"Bir oyuncu 3 gün boyunca oyuna girmezse gezegeni silinsin ve böylece
 * serverlarda yer açılır. Pasif hesaplar birikmez."*
 *
 * WHY THIS IS WORTH THE RISK IT CARRIES. A galaxy holds fifty worlds and galaxies
 * fill strictly in order — that ordering is the ONLY mitigation the empty-shard
 * risk has, and it inverts completely once seats are held by people who signed up
 * and never returned. Fifty commanders of whom forty are inert is not a full
 * galaxy; it is an empty one that nobody can join. The live shard already looks
 * like this: a hundred accounts created in two days, and worlds that read as bots
 * to the owner because nothing has happened on them since.
 *
 * ── WHAT IS DESTROYED, AND WHAT IS NOT ──────────────────────────────────────
 *
 * The SEASON PRESENCE goes: the planet, its buildings, its units, its orbit, and
 * every row in the world that could only exist because that planet did. The
 * ACCOUNT survives — owner decision — and its record folds into
 * `accounts.lifetime` exactly as a wipe folds it, so the commander signs back in,
 * finds no planet, and is taken to the server list to join whichever galaxy is
 * open. That path is why the front door had to learn who is a returning player
 * first: without it, a reclaimed commander would have been offered onboarding.
 *
 * IT TAKES OTHER PEOPLE'S HISTORY WITH IT, and that is stated rather than hidden.
 * `battle_reports` carries foreign keys to both players and to the mission, so a
 * raid an ACTIVE commander flew against a reclaimed world cannot be kept. They
 * lose that line of their report list. It is the same trade a wipe makes, it is
 * the only one the schema allows, and it is worth less than the seat.
 *
 * ── THE THREE THINGS THAT MAKE IT SAFE ──────────────────────────────────────
 *
 *   1. IT NEVER TOUCHES A WORLD THAT SOMETHING IS HAPPENING TO. If any flight is
 *      in the air that names this planet — including a raid an active player
 *      launched at it thirty seconds ago — the planet is DEFERRED to a later
 *      sweep. Deleting a mission out from under a live fleet is not theoretical:
 *      it has happened on this database once already, and it left a real player's
 *      Wasps pointing at a mission id that no longer existed, where no safety net
 *      could reach them.
 *   2. IT RE-CHECKS UNDER A LOCK. The candidate list is read outside the
 *      transaction, so a commander who opens the game in the second between the
 *      read and the delete must not lose their world. The player row is locked and
 *      `lastActiveAt` is read again inside.
 *   3. ONE TRANSACTION PER PLANET. A failure on one world rolls that world back
 *      and leaves every other one alone, and the caller keeps going.
 */

/** Milliseconds of absence before a seat is reclaimed. */
const IDLE_MS = SERVERS.idleDays * 24 * 60 * 60_000;

export interface ReclaimResult {
  /** Planet names whose seats were freed. */
  reclaimed: string[];
  /** Idle worlds left alone this time because something was still in the air. */
  deferred: number;
  /** Worlds that threw. The sweep carries on; the count is for `/health`. */
  failed: number;
}

/**
 * Everything that must be quiet before a world can be taken apart.
 *
 * DELIBERATELY BROAD. A false positive costs one sweep's delay — ten minutes on a
 * player who has been gone three days. A false negative costs somebody their fleet.
 */
async function busy(tx: Tx, planetId: string, fieldIds: string[]): Promise<boolean> {
  const [flight] = await tx
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        eq(missions.status, 'in_flight'),
        or(eq(missions.originPlanetId, planetId), eq(missions.targetPlanetId, planetId)),
      ),
    )
    .limit(1);
  if (flight) return true;

  const [run] = await tx
    .select({ id: miningRuns.id })
    .from(miningRuns)
    .where(
      and(
        ne(miningRuns.status, 'done'),
        fieldIds.length > 0
          ? or(eq(miningRuns.planetId, planetId), inArray(miningRuns.debrisFieldId, fieldIds))
          : eq(miningRuns.planetId, planetId),
      ),
    )
    .limit(1);
  return run !== undefined;
}

/** Fold this season into the account's permanent record, exactly as a wipe does. */
async function foldRecord(
  tx: Tx,
  accountId: string,
  row: { taken: number; lost: number; wealth: number },
): Promise<void> {
  const [account] = await tx
    .select({ lifetime: accounts.lifetime })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  const prior = account?.lifetime ?? {};
  await tx
    .update(accounts)
    .set({
      lifetime: {
        ...prior,
        seasons: (prior.seasons ?? 0) + 1,
        dominionTaken: (prior.dominionTaken ?? 0) + row.taken,
        dominionLost: (prior.dominionLost ?? 0) + row.lost,
        bestWealth: Math.max(prior.bestWealth ?? 0, row.wealth),
      },
    })
    .where(eq(accounts.id, accountId));
}

/**
 * Take one world apart, child rows first.
 *
 * THE ORDER IS THE WHOLE FUNCTION. Every foreign key here is `ON DELETE no
 * action`, so a row deleted out of order raises and rolls the transaction back —
 * which is the good outcome, and it is still an outage for that sweep. The chain
 * that is easy to miss is `mining_runs → debris_fields → missions`: a harvest run
 * points at the field it was sent to, and a field points at the battle that made
 * it. `wipeAllServers` learned this the hard way and could not reset any galaxy
 * where a battle had ever happened.
 */
async function demolish(tx: Tx, planetId: string, playerId: string): Promise<void> {
  const missionIds = (
    await tx
      .select({ id: missions.id })
      .from(missions)
      .where(or(eq(missions.originPlanetId, planetId), eq(missions.targetPlanetId, planetId)))
  ).map((r) => r.id);

  /**
   * Wreckage AT this world, and wreckage this world's battles made ELSEWHERE.
   *
   * Debris sits at the DEFENDER's planet, so a raid this planet flew left a field
   * at somebody else's world that still points back at the mission about to be
   * deleted. Missing that second set is a constraint violation, not a leak.
   */
  const fieldIds = (
    await tx
      .select({ id: debrisFields.id })
      .from(debrisFields)
      .where(
        missionIds.length > 0
          ? or(eq(debrisFields.planetId, planetId), inArray(debrisFields.missionId, missionIds))
          : eq(debrisFields.planetId, planetId),
      )
  ).map((r) => r.id);

  await tx.delete(rewardGrants).where(eq(rewardGrants.playerId, playerId));
  await tx.delete(requestLog).where(eq(requestLog.playerId, playerId));
  await tx.delete(notifications).where(eq(notifications.playerId, playerId));
  /**
   * Somebody else's telescope may be pointed at this world. The row goes and their
   * slot comes free, which is the honest outcome — a watch on a world that no
   * longer exists would report nothing for the rest of the season.
   */
  await tx
    .delete(watches)
    .where(or(eq(watches.observerPlayerId, playerId), eq(watches.targetPlanetId, planetId)));
  await tx
    .delete(probeReports)
    .where(
      or(eq(probeReports.observerPlayerId, playerId), eq(probeReports.targetPlanetId, planetId)),
    );
  await tx
    .delete(scanEvents)
    .where(or(eq(scanEvents.targetPlanetId, planetId), eq(scanEvents.originPlanetId, planetId)));
  await tx
    .delete(battleReports)
    .where(
      or(
        eq(battleReports.attackerPlayerId, playerId),
        eq(battleReports.defenderPlayerId, playerId),
      ),
    );

  /**
   * Scheduled events point at a mission or a run by `refId` and carry NO foreign
   * key, so nothing would stop these being orphaned. An orphan is not harmless: it
   * wakes the worker, finds nothing, and — depending on the handler — either logs
   * or retries until its budget runs out.
   */
  const runIds = (
    await tx
      .select({ id: miningRuns.id })
      .from(miningRuns)
      .where(
        fieldIds.length > 0
          ? or(eq(miningRuns.planetId, planetId), inArray(miningRuns.debrisFieldId, fieldIds))
          : eq(miningRuns.planetId, planetId),
      )
  ).map((r) => r.id);

  const refs = [...missionIds, ...runIds];
  if (refs.length > 0) {
    await tx.delete(scheduledEvents).where(inArray(scheduledEvents.refId, refs));
  }

  if (runIds.length > 0) await tx.delete(miningRuns).where(inArray(miningRuns.id, runIds));
  if (fieldIds.length > 0) await tx.delete(debrisFields).where(inArray(debrisFields.id, fieldIds));
  if (missionIds.length > 0) await tx.delete(missions).where(inArray(missions.id, missionIds));

  await tx.delete(units).where(eq(units.planetId, planetId));
  await tx.delete(satellites).where(eq(satellites.planetId, planetId));
  await tx.delete(buildings).where(eq(buildings.planetId, planetId));
  await tx.delete(planets).where(eq(planets.id, planetId));
  await tx.delete(players).where(eq(players.id, playerId));
}

/**
 * Reclaim every seat whose commander has been away too long.
 *
 * Returns rather than throws on a per-world failure: this runs inside the worker,
 * and *housekeeping may never stop the event queue*. One world that cannot be
 * taken apart must not stop the other forty-nine from being.
 */
export async function reclaimIdleSeats(
  db: Db,
  clock: Clock,
  idleMs: number = IDLE_MS,
): Promise<ReclaimResult> {
  const now = clock.now();
  const cutoff = new Date(now.getTime() - idleMs);

  /**
   * LIVE SEASONS ONLY. A frozen or wiped season is not handing out seats, and
   * taking worlds apart inside one would destroy the record of a finished game.
   *
   * `joinedAt` is checked as well as `lastActiveAt`, and it is not redundant: it
   * is the guard against a clock skew or a bad backfill making a commander who
   * joined an hour ago look three days idle.
   */
  const candidates = await db
    .select({
      playerId: players.id,
      accountId: players.accountId,
      planetId: planets.id,
      planetName: planets.name,
      taken: players.dominionTaken,
      lost: players.dominionLost,
      wealth: players.wealth,
    })
    .from(players)
    .innerJoin(planets, eq(planets.playerId, players.id))
    .innerJoin(seasons, eq(seasons.id, players.seasonId))
    .where(
      and(
        eq(seasons.status, 'live'),
        lt(players.lastActiveAt, cutoff),
        lt(players.joinedAt, cutoff),
      ),
    );

  const out: ReclaimResult = { reclaimed: [], deferred: 0, failed: 0 };

  for (const row of candidates) {
    try {
      const done = await db.transaction(async (tx) => {
        /**
         * RE-READ UNDER A LOCK. The list above was taken outside any transaction,
         * and a commander who opens the game in the seconds between that read and
         * this delete must keep their world. `Presence` writes `lastActiveAt` on
         * their first authenticated request, so this is the check that sees it.
         */
        const [fresh] = await tx
          .select({ lastActiveAt: players.lastActiveAt })
          .from(players)
          .where(eq(players.id, row.playerId))
          .for('update');
        if (!fresh || fresh.lastActiveAt >= cutoff) return 'came-back' as const;

        const fieldIds = (
          await tx
            .select({ id: debrisFields.id })
            .from(debrisFields)
            .where(eq(debrisFields.planetId, row.planetId))
        ).map((r) => r.id);

        if (await busy(tx, row.planetId, fieldIds)) return 'busy' as const;

        await foldRecord(tx, row.accountId, row);
        await demolish(tx, row.planetId, row.playerId);
        return 'reclaimed' as const;
      });

      if (done === 'reclaimed') out.reclaimed.push(row.planetName);
      else if (done === 'busy') out.deferred += 1;
    } catch {
      out.failed += 1;
    }
  }

  return out;
}

/** How many seats are eligible right now, without touching any of them. For `/health`. */
export async function idleSeatCount(db: Db, clock: Clock, idleMs: number = IDLE_MS): Promise<number> {
  const cutoff = new Date(clock.now().getTime() - idleMs);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    .innerJoin(seasons, eq(seasons.id, players.seasonId))
    .where(
      and(
        eq(seasons.status, 'live'),
        lt(players.lastActiveAt, cutoff),
        lt(players.joinedAt, cutoff),
      ),
    );
  return row?.n ?? 0;
}
