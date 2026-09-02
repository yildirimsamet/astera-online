import { and, eq, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { SERVERS } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { publishShard } from '../stream/bus.js';
import {
  accounts,
  attackCommitments,
  battleReports,
  buildOrders,
  buildings,
  chatMessages,
  clanAidCommitments,
  clanCeasefires,
  clanLootShares,
  clanMemberships,
  clanMessages,
  clanRaidRoster,
  clanRequests,
  debrisFields,
  miningRuns,
  pirateRaids,
  pirateState,
  missions,
  notifications,
  neutralPlanetState,
  planets,
  planetResearch,
  playerResearch,
  players,
  probeReports,
  probeWorldMemories,
  requestLog,
  rewardGrants,
  satellites,
  sensorEpochs,
  scanEvents,
  scheduledEvents,
  seasons,
  strategicAssets,
  strategicImpacts,
  strategicInterceptions,
  units,
  watches,
} from '../db/schema.js';
import { reconcileClanPlayerReclaim } from './clan.js';

/**
 * RECLAIMING THE SEAT OF A COMMANDER WHO STOPPED COMING BACK. Owner instruction.
 *
 * *"Bir oyuncu 3 gün boyunca oyuna girmezse gezegeni silinsin ve böylece
 * serverlarda yer açılır. Pasif hesaplar birikmez."*
 *
 * WHY THIS IS WORTH THE RISK IT CARRIES. A galaxy holds three hundred seats and galaxies
 * fill strictly in order — that ordering is the ONLY mitigation the empty-shard
 * risk has, and it inverts completely once seats are held by people who signed up
 * and never returned. Three hundred inert commanders are not a full
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
 * EVERY ROW IN THE WORLD THAT THIS PLANET IS THE REASON FOR.
 *
 * ONE FUNCTION, TWO CALLERS, AND THEY MUST NOT DISAGREE. `busy()` asks whether
 * anything here is still in the air and `demolish()` deletes it; if they compute
 * different sets, the sweep can delete something it never checked was quiet. They
 * did, in the first draft, and the hole was exact: `busy()` looked only at debris
 * AT this planet, while `demolish()` also deleted debris this planet's RAIDS left
 * at other worlds — so a third party's harvest run, in the air toward wreckage
 * that this commander made somewhere else, would have been deleted out from under
 * its craft. That is the same failure that stranded a real player's Wasps on this
 * project's production database once.
 *
 * Debris sits at the DEFENDER's planet. So the fields this world is responsible
 * for are the ones standing over it, plus the ones its own battles created
 * elsewhere — and a harvest run pointed at either is a flight that must be left
 * alone.
 */
async function commanderRows(
  tx: Tx,
  planetIds: string[],
  playerId: string,
): Promise<{ missionIds: string[]; fieldIds: string[]; runIds: string[]; raidIds: string[] }> {
  const missionIds = (
    await tx
      .select({ id: missions.id })
      .from(missions)
      .where(or(
        eq(missions.ownerPlayerId, playerId),
        inArray(missions.originPlanetId, planetIds),
        inArray(missions.targetPlanetId, planetIds),
      ))
  ).map((r) => r.id);

  /**
   * AND THE RAIDS THIS SEAT HAS OUT AT PIRATES. D150 — gap G5.
   *
   * `pirate_raids` has foreign keys to `planets` and `seasons` with `ON DELETE no
   * action`, so a reclaimed seat with a raid row would fail on the `delete(planets)`
   * below and the seat would never come back — the exact shape of the
   * `debris_fields` outage this function has already had once.
   */
  const raidIds = (
    await tx
      .select({ id: pirateRaids.id })
      .from(pirateRaids)
      .where(inArray(pirateRaids.planetId, planetIds))
  ).map((r) => r.id);

  const fieldIds = (
    await tx
      .select({ id: debrisFields.id })
      .from(debrisFields)
      /*
        THREE DOORS NOW, AND THE THIRD IS THE ONE WITH NO ADDRESS. D150.

        A pirate battle's wreckage hangs in open space: `planet_id` is NULL and
        there is no mission, so neither of the original two clauses could ever
        reach it and the row would survive its own season as an orphan. It is
        found through the raid that made it.
      */
      .where(
        or(
          inArray(debrisFields.planetId, planetIds),
          ...(missionIds.length > 0
            ? [inArray(debrisFields.missionId, missionIds)]
            : []),
          ...(raidIds.length > 0
            ? [inArray(debrisFields.pirateRaidId, raidIds)]
            : []),
        ),
      )
  ).map((r) => r.id);

  const runIds = (
    await tx
      .select({ id: miningRuns.id })
      .from(miningRuns)
      .where(
        fieldIds.length > 0
          ? or(inArray(miningRuns.planetId, planetIds), inArray(miningRuns.debrisFieldId, fieldIds))
          : inArray(miningRuns.planetId, planetIds),
      )
  ).map((r) => r.id);

  return { missionIds, fieldIds, runIds, raidIds };
}

/**
 * Is anything still happening here?
 *
 * DELIBERATELY BROAD. A false positive costs one sweep's delay — ten minutes, on a
 * commander who has been gone three days. A false negative costs somebody their
 * fleet.
 */
async function busy(
  tx: Tx,
  planetIds: string[],
  playerId: string,
  rows: { runIds: string[]; raidIds: string[] },
): Promise<boolean> {
  const [flight] = await tx
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        eq(missions.status, 'in_flight'),
        or(
          eq(missions.ownerPlayerId, playerId),
          inArray(missions.originPlanetId, planetIds),
          inArray(missions.targetPlanetId, planetIds),
        ),
      ),
    )
    .limit(1);
  if (flight) return true;

  if (rows.raidIds.length > 0) {
    // A world with a raid in the air is never reclaimed: the fleet is real, and
    // taking the seat would delete it mid-flight.
    const [raid] = await tx
      .select({ id: pirateRaids.id })
      .from(pirateRaids)
      .where(and(inArray(pirateRaids.id, rows.raidIds), ne(pirateRaids.status, 'done')))
      .limit(1);
    if (raid) return true;
  }

  if (rows.runIds.length === 0) return false;
  const [run] = await tx
    .select({ id: miningRuns.id })
    .from(miningRuns)
    .where(and(inArray(miningRuns.id, rows.runIds), ne(miningRuns.status, 'done')))
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
async function demolish(
  tx: Tx,
  planetIds: string[],
  playerId: string,
  rows: { missionIds: string[]; fieldIds: string[]; runIds: string[]; raidIds: string[] },
): Promise<void> {
  const { missionIds, fieldIds, runIds, raidIds } = rows;

  /**
   * Season-scoped only, and `account_rewards` is deliberately absent from this
   * function. Rewards claimed for what happened on THIS world die with it — the
   * progress they were counted from is about to stop existing — but the
   * @JoinAstera bonus is paid once per person for ever, and deleting its row here
   * would hand the same commander a fresh one in whichever galaxy they join next.
   */
  await tx.delete(rewardGrants).where(eq(rewardGrants.playerId, playerId));
  await tx.delete(requestLog).where(eq(requestLog.playerId, playerId));
  await tx.delete(notifications).where(eq(notifications.playerId, playerId));

  // Clan receipts and score audits deliberately survive their source mission,
  // but personal rows cannot survive their player. Everything else below is a
  // live reservation or a player-owned projection and is removed child-first.
  await tx.delete(clanLootShares).where(eq(clanLootShares.playerId, playerId));
  if (missionIds.length > 0) {
    await tx.delete(clanRaidRoster).where(inArray(clanRaidRoster.missionId, missionIds));
  }
  await tx.delete(attackCommitments).where(or(
    eq(attackCommitments.attackerPlayerId, playerId),
    eq(attackCommitments.targetPlayerId, playerId),
    ...(missionIds.length > 0 ? [inArray(attackCommitments.missionId, missionIds)] : []),
  ));
  await tx.delete(clanAidCommitments).where(or(
    eq(clanAidCommitments.senderPlayerId, playerId),
    eq(clanAidCommitments.recipientPlayerId, playerId),
    ...(missionIds.length > 0 ? [inArray(clanAidCommitments.missionId, missionIds)] : []),
  ));
  await tx.delete(clanMessages).where(eq(clanMessages.authorPlayerId, playerId));
  await tx.delete(clanCeasefires).where(or(
    eq(clanCeasefires.playerLowId, playerId),
    eq(clanCeasefires.playerHighId, playerId),
  ));
  await tx.delete(clanRequests).where(or(
    eq(clanRequests.playerId, playerId),
    eq(clanRequests.createdByPlayerId, playerId),
  ));
  await tx.delete(clanMemberships).where(eq(clanMemberships.playerId, playerId));
  /**
   * Somebody else's telescope may be pointed at this world. The row goes and their
   * slot comes free, which is the honest outcome — a watch on a world that no
   * longer exists would report nothing for the rest of the season.
   */
  await tx
    .delete(watches)
    .where(or(eq(watches.observerPlayerId, playerId), inArray(watches.targetPlanetId, planetIds)));
  await tx
    .delete(probeWorldMemories)
    .where(or(
      eq(probeWorldMemories.observerPlayerId, playerId),
      inArray(probeWorldMemories.targetPlanetId, planetIds),
    ));
  await tx
    .delete(probeReports)
    .where(
      or(eq(probeReports.observerPlayerId, playerId), inArray(probeReports.targetPlanetId, planetIds)),
    );
  await tx
    .delete(scanEvents)
    .where(or(inArray(scanEvents.targetPlanetId, planetIds), inArray(scanEvents.originPlanetId, planetIds)));
  await tx
    .delete(strategicInterceptions)
    .where(or(
      eq(strategicInterceptions.attackerPlayerId, playerId),
      eq(strategicInterceptions.defenderPlayerId, playerId),
    ));
  await tx
    .delete(strategicImpacts)
    .where(
      or(
        eq(strategicImpacts.attackerPlayerId, playerId),
        eq(strategicImpacts.defenderPlayerId, playerId),
      ),
    );
  await tx
    .delete(battleReports)
    .where(
      or(
        eq(battleReports.attackerPlayerId, playerId),
        eq(battleReports.defenderPlayerId, playerId),
      ),
    );
  await tx.delete(chatMessages).where(eq(chatMessages.authorPlayerId, playerId));

  /**
   * Scheduled events point at a mission or a run by `refId` and carry NO foreign
   * key, so nothing would stop these being orphaned. An orphan is not harmless: it
   * wakes the worker, finds nothing, and — depending on the handler — either logs
   * or retries until its budget runs out.
   */
  const assetIds = (await tx
    .select({ id: strategicAssets.id })
    .from(strategicAssets)
    .where(or(
      inArray(strategicAssets.planetId, planetIds),
      ...(missionIds.length > 0 ? [inArray(strategicAssets.missionId, missionIds)] : []),
    ))).map((asset) => asset.id);
  const buildOrderIds = (await tx
    .select({ id: buildOrders.id })
    .from(buildOrders)
    .where(inArray(buildOrders.planetId, planetIds))).map((order) => order.id);
  const refs = [...missionIds, ...runIds, ...raidIds, ...planetIds, ...assetIds, ...buildOrderIds];
  if (refs.length > 0) {
    await tx.delete(scheduledEvents).where(inArray(scheduledEvents.refId, refs));
  }

  if (runIds.length > 0) await tx.delete(miningRuns).where(inArray(miningRuns.id, runIds));
  /*
    DEBRIS BEFORE RAIDS, AND THE ORDER IS A FOREIGN KEY RATHER THAN A PREFERENCE.

    Since D150 a wreck field left in open space points at the raid that made it, so
    deleting the raid first leaves the field referencing a row that is gone and the
    whole seat fails to come back. The runs above are already cleared, so nothing is
    pointing at these fields either.
  */
  if (fieldIds.length > 0) await tx.delete(debrisFields).where(inArray(debrisFields.id, fieldIds));
  // After the reports above, which reference the raid, and before the planets below.
  if (raidIds.length > 0) await tx.delete(pirateRaids).where(inArray(pirateRaids.id, raidIds));
  // Damage this commander did to a pirate outlives them as anonymous world state,
  // but the row's `destroyed_by_player_id` points at a commander about to vanish.
  await tx
    .update(pirateState)
    .set({ destroyedByPlayerId: null })
    .where(eq(pirateState.destroyedByPlayerId, playerId));
  if (assetIds.length > 0) await tx.delete(strategicAssets).where(inArray(strategicAssets.id, assetIds));
  if (buildOrderIds.length > 0) {
    await tx.delete(buildOrders).where(inArray(buildOrders.id, buildOrderIds));
  }
  if (missionIds.length > 0) await tx.delete(missions).where(inArray(missions.id, missionIds));

  await tx.delete(units).where(or(
    inArray(units.planetId, planetIds),
    eq(units.ownerPlayerId, playerId),
  ));
  await tx.delete(satellites).where(inArray(satellites.planetId, planetIds));
  await tx.delete(sensorEpochs).where(inArray(sensorEpochs.planetId, planetIds));
  await tx.delete(buildings).where(inArray(buildings.planetId, planetIds));
  await tx.delete(planetResearch).where(inArray(planetResearch.planetId, planetIds));
  await tx.delete(neutralPlanetState).where(inArray(neutralPlanetState.planetId, planetIds));
  await tx.delete(planets).where(inArray(planets.id, planetIds));
  /*
    BEFORE THE PLAYER ROW, AND THAT ORDER IS THE WHOLE POINT. T7.

    `player_research` references `players.id`, so deleting the commander first is a
    foreign-key violation — and this function is what reclaims an idle seat, so the
    failure mode is a galaxy that can never be reopened. The row above it is keyed
    on the planet and the one below is the commander themself; this belongs between.
  */
  await tx.delete(playerResearch).where(eq(playerResearch.playerId, playerId));
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
      seasonId: players.seasonId,
      displayName: accounts.displayName,
      planetId: planets.id,
      planetName: planets.name,
      taken: players.dominionTaken,
      lost: players.dominionLost,
      wealth: players.wealth,
    })
    .from(players)
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .innerJoin(planets, eq(planets.controllerPlayerId, players.id))
    .innerJoin(seasons, eq(seasons.id, players.seasonId))
    .where(
      and(
        eq(seasons.status, 'live'),
        eq(planets.kind, 'CAPITAL'),
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

        /**
         * Read ONCE and used by both, so what is checked for quiet and what is
         * deleted can never be different sets. See `worldRows`.
         */
        const controlled = await tx
          .select({ id: planets.id })
          .from(planets)
          .where(eq(planets.controllerPlayerId, row.playerId));
        const planetIds = controlled.map((world) => world.id);
        if (planetIds.length === 0) return 'came-back' as const;
        const rows = await commanderRows(tx, planetIds, row.playerId);
        if (await busy(tx, planetIds, row.playerId, rows)) return 'busy' as const;

        await reconcileClanPlayerReclaim(tx, {
          playerId: row.playerId,
          seasonId: row.seasonId,
          displayName: row.displayName,
          now,
          activeCutoff: cutoff,
        });
        await foldRecord(tx, row.accountId, row);
        await demolish(tx, planetIds, row.playerId, rows);
        // Reclaim removes a public world, its ladder row, its authored chat and
        // any dormant wreck fields. Those are distinct query families; the
        // client's 250ms coalescer turns the transactional broadcasts into one
        // visible refresh without making one event kind lie about what changed.
        await publishShard(tx, row.seasonId, 'world');
        await publishShard(tx, row.seasonId, 'mining');
        await publishShard(tx, row.seasonId, 'chat');
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
