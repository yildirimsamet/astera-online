import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { deuteriumOf, type CombatRound, type Fleet, type Grade } from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import { accounts, battleReports, planets, players } from '../db/schema.js';

/**
 * BATTLE REPORTS — the closing link of the loop.
 *
 * `game-design.md` calls this "the most accurate intel in the game", and step 9 of
 * the core loop feeds step 3: every fight teaches you something about a person you
 * will fight again. Until now the reports were written and never shown. Combat
 * happened, a one-line summary appeared in the return overlay, and nothing a
 * player learned from it survived into their next decision.
 *
 * WHAT EACH SIDE MAY SEE. Both participants get the same facts, because both were
 * there: the grade, how many rounds it ran, what each side lost, and what moved.
 * That includes the opponent's name — being raided reveals the raider, and that is
 * the counterplay, not a leak. What it deliberately does NOT include is anything
 * about what the loser still HAS: losses are ground truth, survivors are not
 * disclosed. A report tells you what someone brought, not what they kept.
 */

export interface BattleReportView {
  id: string;
  at: Date;
  grade: Grade;
  /** The blow-by-blow. Damage each way, shield absorbed, and who died when. */
  rounds: CombatRound[];
  /** True when the caller was the one who launched. */
  attacking: boolean;
  opponentName: string;
  opponentPlanet: string;
  /** Stable identity for dossier matching; null only when the seasonal world vanished. */
  opponentPlanetId: string | null;
  /** What the caller lost, and what the caller destroyed. */
  yourLosses: Fleet;
  theirLosses: Fleet;
  /** Positive when the caller gained; negative when it was taken from them. */
  lootAlloy: number;
  lootCrystal: number;
  lootDeuterium: number;
  /**
   * The ledger movement this battle produced for the caller.
   *
   * Null on reports written before it was recorded — the client omits the line
   * rather than showing a figure it would have had to guess.
   */
  dominion: number | null;
}

export interface RivalSummaryView {
  planetId: string;
  battles: number;
  attacks: number;
  defences: number;
  dominionGained: number;
  dominionLost: number;
  lastInteractionAt: Date;
  /** What was last confirmed destroyed, a floor on what they fielded. */
  lastKnownFleet: Fleet | null;
  lastKnownAt: Date | null;
}

export async function readBattleReports(
  db: Db,
  playerId: string,
  limit = 20,
): Promise<{ reports: BattleReportView[]; rivals: RivalSummaryView[] }> {
  return db.transaction(
    (tx) => readBattleReportsIn(tx, playerId, limit),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

async function readBattleReportsIn(
  tx: Tx,
  playerId: string,
  limit: number,
): Promise<{ reports: BattleReportView[]; rivals: RivalSummaryView[] }> {
  const mine = or(
    eq(battleReports.attackerPlayerId, playerId),
    eq(battleReports.defenderPlayerId, playerId),
  );
  const [rows, history] = await Promise.all([
    tx
      .select()
      .from(battleReports)
      .where(mine)
      .orderBy(desc(battleReports.createdAt))
      .limit(Math.min(limit, 50)),
    // The full-season aggregate does not drag every combat round and loot JSON
    // through memory. Only the identity, ledger and observed-loss fields matter.
    tx
      .select({
        attackerPlayerId: battleReports.attackerPlayerId,
        defenderPlayerId: battleReports.defenderPlayerId,
        attackerLosses: battleReports.attackerLosses,
        defenderLosses: battleReports.defenderLosses,
        dominionSwing: battleReports.dominionSwing,
        createdAt: battleReports.createdAt,
      })
      .from(battleReports)
      .where(mine)
      .orderBy(desc(battleReports.createdAt)),
  ]);

  if (history.length === 0) return { reports: [], rivals: [] };

  // One query for every opponent rather than one per report.
  const opponentIds = history
    .map((r) => r.attackerPlayerId === playerId ? r.defenderPlayerId : r.attackerPlayerId)
    .filter((id): id is string => id !== null);
  const opponents = await tx
    .select({ id: players.id, name: accounts.displayName, planet: planets.name, planetId: planets.id })
    .from(players)
    .innerJoin(
      planets,
      and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
    )
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(inArray(players.id, opponentIds));
  const byId = new Map(opponents.map((o) => [o.id, o]));

  const viewOf = (row: (typeof rows)[number]): BattleReportView => {
    const attacking = row.attackerPlayerId === playerId;
    const opponentId = attacking ? row.defenderPlayerId : row.attackerPlayerId;
    const opponent = opponentId === null ? undefined : byId.get(opponentId);

    const yourLosses = attacking ? row.attackerLosses : row.defenderLosses;
    const theirLosses = attacking ? row.defenderLosses : row.attackerLosses;
    /**
     * Dominion, read from the report rather than derived.
     *
     * The stored figure is the attacker's movement as the ledger actually took it.
     * Deriving it here from the loss lists would overstate it whenever ground
     * defence died, because a battle's `defenderLossValue` is net of the 60% that
     * salvages back — and a report that disagrees with the ladder is worse than a
     * report with one fewer line on it.
     */
    const dominion =
      row.dominionSwing === null ? null : attacking ? row.dominionSwing : -row.dominionSwing;

    return {
      id: row.id,
      at: row.createdAt,
      grade: row.grade,
      rounds: row.rounds.map((round) => ({
        ...round,
        // JSON reports written before D95 have no specialist field.
        breacherShieldDamage:
          (
            round as Omit<CombatRound, 'breacherShieldDamage'> &
              Partial<Pick<CombatRound, 'breacherShieldDamage'>>
          ).breacherShieldDamage ?? 0,
      })),
      attacking,
      opponentName: opponent?.name ?? 'someone',
      opponentPlanet: opponent?.planet ?? 'an unknown world',
      opponentPlanetId: opponent?.planetId ?? null,
      yourLosses,
      theirLosses,
      // Signed from the caller's side: what you took, or what was taken.
      lootAlloy: attacking ? row.loot.alloy : -row.loot.alloy,
      lootCrystal: attacking ? row.loot.crystal : -row.loot.crystal,
      lootDeuterium: attacking ? deuteriumOf(row.loot) : -deuteriumOf(row.loot),
      dominion,
    };
  };

  const rivals = new Map<string, RivalSummaryView>();
  for (const row of history) {
    const attacking = row.attackerPlayerId === playerId;
    const opponentId = attacking ? row.defenderPlayerId : row.attackerPlayerId;
    const opponent = opponentId === null ? undefined : byId.get(opponentId);
    if (!opponent) continue;
    const signed = row.dominionSwing === null ? 0 : attacking ? row.dominionSwing : -row.dominionSwing;
    const theirs = attacking ? row.defenderLosses : row.attackerLosses;
    const hasKnownFleet = Object.values(theirs).some((count) => count > 0);
    const current = rivals.get(opponent.planetId);
    if (!current) {
      rivals.set(opponent.planetId, {
        planetId: opponent.planetId,
        battles: 1,
        attacks: attacking ? 1 : 0,
        defences: attacking ? 0 : 1,
        dominionGained: Math.max(0, signed),
        dominionLost: Math.max(0, -signed),
        lastInteractionAt: row.createdAt,
        lastKnownFleet: hasKnownFleet ? theirs : null,
        lastKnownAt: hasKnownFleet ? row.createdAt : null,
      });
      continue;
    }
    current.battles += 1;
    current.attacks += attacking ? 1 : 0;
    current.defences += attacking ? 0 : 1;
    current.dominionGained += Math.max(0, signed);
    current.dominionLost += Math.max(0, -signed);
    // Rows are newest-first: fill this once with the latest useful composition.
    if (current.lastKnownFleet === null && hasKnownFleet) {
      current.lastKnownFleet = theirs;
      current.lastKnownAt = row.createdAt;
    }
  }

  return { reports: rows.map(viewOf), rivals: [...rivals.values()] };
}
