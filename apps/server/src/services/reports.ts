import { desc, eq, inArray, or } from 'drizzle-orm';
import type { CombatRound, Fleet, Grade } from '@blindspace/rules';
import type { Db } from '../db/client.js';
import { battleReports, planets, players } from '../db/schema.js';

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
  /** What the caller lost, and what the caller destroyed. */
  yourLosses: Fleet;
  theirLosses: Fleet;
  /** Positive when the caller gained; negative when it was taken from them. */
  lootAlloy: number;
  lootCrystal: number;
  /**
   * The ledger movement this battle produced for the caller.
   *
   * Null on reports written before it was recorded — the client omits the line
   * rather than showing a figure it would have had to guess.
   */
  dominion: number | null;
}

export async function readBattleReports(
  db: Db,
  playerId: string,
  limit = 20,
): Promise<BattleReportView[]> {
  const rows = await db
    .select()
    .from(battleReports)
    .where(
      or(
        eq(battleReports.attackerPlayerId, playerId),
        eq(battleReports.defenderPlayerId, playerId),
      ),
    )
    .orderBy(desc(battleReports.createdAt))
    .limit(Math.min(limit, 50));

  if (rows.length === 0) return [];

  // One query for every opponent rather than one per report.
  const opponentIds = rows.map((r) =>
    r.attackerPlayerId === playerId ? r.defenderPlayerId : r.attackerPlayerId,
  );
  const opponents = await db
    .select({ id: players.id, name: players.name, planet: planets.name })
    .from(players)
    .innerJoin(planets, eq(planets.playerId, players.id))
    .where(inArray(players.id, opponentIds));
  const byId = new Map(opponents.map((o) => [o.id, o]));

  return rows.map((row) => {
    const attacking = row.attackerPlayerId === playerId;
    const opponentId = attacking ? row.defenderPlayerId : row.attackerPlayerId;
    const opponent = byId.get(opponentId);

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
      rounds: row.rounds,
      attacking,
      opponentName: opponent?.name ?? 'someone',
      opponentPlanet: opponent?.planet ?? 'an unknown world',
      yourLosses,
      theirLosses,
      // Signed from the caller's side: what you took, or what was taken.
      lootAlloy: attacking ? row.loot.alloy : -row.loot.alloy,
      lootCrystal: attacking ? row.loot.crystal : -row.loot.crystal,
      dominion,
    };
  });
}
