import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { DAILY_QUESTS, DAILY_QUEST_HONOR, alloyRate, crystalRate, dailyQuestReward, fleetCount, productionMult, utcDay, type DailyQuestId } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { arenaShips, battleReports, dailyQuestClaims, honorQuestTotals, honorSeasons, miningRuns, missions, pirateRaids, planets } from '../db/schema.js';
import { GameError, assertWorldOperational, readPlanetSnapshot, refreshWealth, saveResources, withPlanetLock, type LockedPlanet } from './planet.js';
import { buildPlanetResult, loadPlanetViewData, type planetView } from './planetView.js';

/**
 * GÜNLÜK GÖREVLER (owner, 2026-11-24). `rewards.ts`'s rule, with a day on it: progress is COUNTED
 * from rows the game keeps anyway, between the two instants of a UTC day, and never accumulated. The
 * one thing written is the claim, under the capital's row lock and a primary key that makes a second
 * payment for the same quest and day impossible.
 *
 *   PROBES    `missions` of kind probe that left today, the game's own cancellations excluded
 *   RIFT      `arena_ships.last_sortie_at`, stamped when the ship flies into the Yarık
 *   PIRATE    a DECISIVE pirate fight won today with ships left, once per pirate
 *   ASTEROID  a `mining_runs` row that reached its rock today (not outbound, not recalled, not a wreck)
 */
export interface DailyQuestRow {
  id: DailyQuestId;
  goal: number;
  /** Never above the goal: a full bar is a full bar. */
  progress: number;
  state: 'locked' | 'claimable' | 'claimed';
  alloy: number;
  crystal: number;
  /** Micro-Honor this quest pays with its purse (owner 2026-11-24). */
  honor: number;
}

export interface DailyQuestsView {
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  /** The instant every quest starts again. */
  resetsAt: string;
  quests: DailyQuestRow[];
  /** How many purses are waiting. The panel's badge is this, and nothing else. */
  claimable: number;
}

interface Window { start: Date; end: Date }

async function countProbes(tx: Tx, playerId: string, day: Window): Promise<number> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(missions).where(and(
    eq(missions.ownerPlayerId, playerId), eq(missions.kind, 'probe'), isNull(missions.parentMissionId),
    // A cancelled mission is a server fault, not an act the player performed.
    sql`${missions.status} <> 'cancelled'`,
    gte(missions.departAt, day.start), lt(missions.departAt, day.end),
  ));
  return row?.n ?? 0;
}

async function countSorties(tx: Tx, playerId: string, day: Window): Promise<number> {
  const [row] = await tx.select({ at: arenaShips.lastSortieAt }).from(arenaShips).where(eq(arenaShips.playerId, playerId));
  return row?.at && row.at >= day.start && row.at < day.end ? 1 : 0;
}

/** Victory with survivors, once per pirate: the same rule `rewards.ts` pays its pirate chain on. */
async function countPirates(tx: Tx, playerId: string, day: Window): Promise<number> {
  const reports = await tx.select({
    index: pirateRaids.pirateIndex, seasonId: pirateRaids.seasonId,
    fleet: battleReports.attackerFleet, losses: battleReports.attackerLosses,
  }).from(battleReports)
    .innerJoin(pirateRaids, eq(pirateRaids.id, battleReports.pirateRaidId))
    .where(and(
      eq(pirateRaids.ownerPlayerId, playerId), eq(battleReports.attackerPlayerId, playerId),
      eq(battleReports.targetKind, 'PIRATE'), eq(battleReports.grade, 'DECISIVE'),
      gte(battleReports.createdAt, day.start), lt(battleReports.createdAt, day.end),
    ));
  return new Set(reports.filter(row => fleetCount(row.fleet) > fleetCount(row.losses))
    .map(row => `${row.seasonId}:${String(row.index)}`)).size;
}

async function countAsteroids(tx: Tx, playerId: string, day: Window): Promise<number> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(miningRuns)
    .innerJoin(planets, eq(planets.id, miningRuns.planetId))
    .where(and(
      eq(planets.controllerPlayerId, playerId), eq(miningRuns.targetKind, 'asteroid'),
      // `outbound` has decided nothing: the rock may be stripped before the craft gets there.
      sql`${miningRuns.status} <> 'outbound'`, isNull(miningRuns.recalledAt),
      gte(miningRuns.arriveAt, day.start), lt(miningRuns.arriveAt, day.end),
    ));
  return row?.n ?? 0;
}

/** What the capital makes an hour, read off the snapshot already in hand: its refinery and extractor at its orbit's pace. */
const hourlyRate = (planet: LockedPlanet) => {
  const mult = productionMult(planet.orbit);
  return { alloy: alloyRate(planet.buildings.REFINERY) * mult, crystal: crystalRate(planet.buildings.EXTRACTOR) * mult };
};

async function assemble(tx: Tx, planet: LockedPlanet): Promise<DailyQuestsView> {
  const { playerId, now } = planet;
  const today = utcDay(now.getTime());
  const day: Window = { start: new Date(today.startMs), end: new Date(today.endMs) };
  const [probes, rift, pirate, asteroid, claims, honorConfig] = await Promise.all([
    countProbes(tx, playerId, day), countSorties(tx, playerId, day),
    countPirates(tx, playerId, day), countAsteroids(tx, playerId, day),
    tx.select({ id: dailyQuestClaims.questId }).from(dailyQuestClaims)
      .where(and(eq(dailyQuestClaims.playerId, playerId), eq(dailyQuestClaims.day, today.key))),
    tx.select({ mode: honorSeasons.mode }).from(honorSeasons).where(eq(honorSeasons.seasonId, planet.seasonId)),
  ]);
  // Ordinary Honor (owner 2026-11-24): paid only where the season ranks it. Nowhere else has any to pay.
  const honor = honorConfig[0]?.mode === 'ACTIVE' ? DAILY_QUEST_HONOR : 0;
  const rate = hourlyRate(planet);
  const counted: Record<DailyQuestId, number> = { PROBES: probes, RIFT: rift, PIRATE: pirate, ASTEROID: asteroid };
  const taken = new Set(claims.map(row => row.id));
  const quests = DAILY_QUESTS.map((quest): DailyQuestRow => {
    const progress = Math.min(counted[quest.id], quest.goal);
    const state = taken.has(quest.id) ? 'claimed' : progress >= quest.goal ? 'claimable' : 'locked';
    return { id: quest.id, goal: quest.goal, progress, state, ...dailyQuestReward(quest.id, rate), honor };
  });
  return {
    day: today.key, resetsAt: new Date(today.endMs).toISOString(), quests,
    claimable: quests.filter(row => row.state === 'claimable').length,
  };
}

/** A read: one read-only snapshot, no world lock and no persisted tick. */
export async function dailyQuestsView(db: Db, planetId: string, clock: Clock): Promise<DailyQuestsView> {
  return db.transaction(async (tx) => {
    const planet = await readPlanetSnapshot(tx, planetId, clock);
    return assemble(tx, planet);
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

/**
 * TAKE ONE PURSE, INTO THE CAPITAL'S STORE. Above the storage cap on purpose, like every reward: a grant
 * that evaporated at the moment it was earned would be worse than any pressure clamping it avoids, and
 * what lands in storage can still be raided, which keeps it inside the PvP economy.
 */
export async function claimDailyQuest(db: Db, planetId: string, questId: string, clock: Clock): Promise<{
  granted: { alloy: number; crystal: number; honor: number };
  quests: DailyQuestsView;
  planet: Awaited<ReturnType<typeof planetView>>;
}> {
  const quest = DAILY_QUESTS.find(row => row.id === questId);
  if (!quest) throw new GameError('NO_SUCH_DAILY_QUEST', 'No such daily quest', 404);
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const view = await assemble(tx, planet);
    const row = view.quests.find(entry => entry.id === quest.id)!;
    if (row.state === 'claimed') throw new GameError('DAILY_QUEST_TAKEN', 'You have already taken that purse today');
    if (row.state === 'locked') {
      throw new GameError('DAILY_QUEST_LOCKED', 'You have not done that yet today', 400, { goal: row.goal, progress: row.progress });
    }
    // The key is the idempotency; the lock above is what makes the read honest.
    const written = await tx.insert(dailyQuestClaims).values({
      playerId: planet.playerId, day: view.day, questId: quest.id, alloy: row.alloy, crystal: row.crystal, honorMicros: row.honor,
      claimedAt: planet.now,
    }).onConflictDoNothing().returning({ id: dailyQuestClaims.questId });
    if (written.length === 0) throw new GameError('DAILY_QUEST_TAKEN', 'You have already taken that purse today');
    // Beside the Honor ledger, never in it: the ledger rewrites its own totals on every settlement.
    if (row.honor > 0) {
      await tx.insert(honorQuestTotals).values({ seasonId: planet.seasonId, playerId: planet.playerId, micros: row.honor })
        .onConflictDoUpdate({ target: [honorQuestTotals.seasonId, honorQuestTotals.playerId], set: { micros: sql`${honorQuestTotals.micros} + ${row.honor}` } });
    }
    planet.alloy += row.alloy;
    planet.crystal += row.crystal;
    await saveResources(tx, planetId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
    await refreshWealth(tx, planet);
    return {
      granted: { alloy: row.alloy, crystal: row.crystal, honor: row.honor },
      quests: await assemble(tx, planet),
      planet: await loadPlanetViewData(tx, planetId, clock),
    };
  }).then(buildPlanetResult);
}
