import { STARTER_PVP_BALANCE, type Fleet } from '@astera/rules';
import { desc, eq, or } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { vesselBattleReports, vessels } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { refuseLeft } from './vessel.js';

const SHOWN = 50;

async function shipOf(db: Db, accountId: string) {
  const [row] = await db.select().from(vessels).where(eq(vessels.accountId, accountId));
  if (!row) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(row);
  return row;
}

const countOf = (fleet: Fleet): number => Object.values(fleet).reduce((sum, count) => sum + count, 0);

/** The report list, in the main game's shape. What is not in this galaxy is plainly absent. */
export async function starterReportsView(db: Db, accountId: string, clock: Clock) {
  void clock;
  const row = await shipOf(db, accountId);
  const rows = await db.select().from(vesselBattleReports)
    .where(or(eq(vesselBattleReports.attackerVesselId, row.id), eq(vesselBattleReports.defenderVesselId, row.id)))
    .orderBy(desc(vesselBattleReports.at)).limit(SHOWN);
  return {
    rivals: [],
    reports: rows.map((report) => {
      const { result } = report;
      const attacking = report.attackerVesselId === row.id;
      return {
        id: report.id,
        missionId: report.missionId,
        at: report.at,
        grade: result.grade,
        rounds: result.rounds,
        attacking,
        opponentName: attacking ? report.defenderName : report.attackerName,
        // Pirates fly from no ship, and the screen draws no target row for an empty name.
        opponentPlanet: !attacking && report.attackerVesselId === null ? '' : attacking ? report.defenderName : report.attackerName,
        opponentPlanetId: attacking ? report.defenderVesselId ?? report.siteId : report.attackerVesselId,
        neutral: report.siteId !== null,
        opponentKind: report.siteId !== null ? 'OUTPOST' : !attacking && report.attackerVesselId === null ? 'PIRATES' : 'SHIP',
        yourPlanet: row.name,
        yourPlanetId: row.id,
        yourLosses: attacking ? result.attackerLosses : result.defenderLosses,
        theirLosses: attacking ? result.defenderLosses : result.attackerLosses,
        yourRetreated: attacking ? result.attackerRetreated : result.defenderRetreated,
        theirRetreatedCount: countOf(attacking ? result.defenderRetreated : result.attackerRetreated),
        yourFleet: attacking ? result.attackerSent : result.defenderSent,
        theirFleet: attacking ? result.defenderSent : result.attackerSent,
        lootAlloy: result.loot.alloy,
        lootCrystal: result.loot.crystal,
        lootDeuterium: result.loot.deuterium,
        dominion: null,
        shieldAbsorbed: result.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0),
        shieldBefore: result.shieldBefore,
        shieldAfter: result.shieldAfter,
        cargoLimited: result.cargoLimited,
        guardDownUntil: attacking ? result.guardDownUntil ?? null : null,
        firstVictory: attacking && result.firstVictory === true,
        beatenBy: attacking ? result.beatenBy ?? null : null,
        defenceSalvage: {},
        yourDamage: attacking ? result.attackerDamage : result.defenderDamage,
        pvpBalance: STARTER_PVP_BALANCE,
        recovery: !attacking && result.recoveryUntil ? { lossHours: 0, shielded: true, until: result.recoveryUntil } : null,
        disruptedMinutes: 0,
        wreckValue: result.wreckValue,
        replayStatus: report.replay ? 'AVAILABLE' as const : 'NOT_RECORDED' as const,
        replayKind: 'BATTLE' as const,
        starterGalaxy: true as const,
      };
    }),
  };
}

export async function starterReplayView(db: Db, accountId: string, reportId: string) {
  const row = await shipOf(db, accountId);
  const [report] = await db.select().from(vesselBattleReports).where(eq(vesselBattleReports.id, reportId));
  const attacking = report?.attackerVesselId === row.id;
  if (!report || (!attacking && report.defenderVesselId !== row.id)) throw new GameError('NOT_FOUND', 'Battle replay not found', 404);
  if (!report.replay) throw new GameError('REPLAY_UNAVAILABLE', 'Battle replay unavailable', 404);
  return { viewer: attacking ? 'ATTACK' as const : 'DEFENCE' as const, ownPlayerIds: [attacking ? 'ATTACK:P1' : 'DEFENCE:P1'], replay: report.replay };
}
