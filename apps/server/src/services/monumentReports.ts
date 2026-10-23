import { and, desc, eq, inArray } from 'drizzle-orm';
import { fleetCount, fleetDiff, type Fleet, type Grade, type HpDamageLot, type Vec3 } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { monumentBattles, monumentBattleParticipants } from '../db/schema.js';
import { readHonorReceipts, type HonorReportReceipt } from './honorReports.js';
import { honorEventKey } from './honorAccounting.js';

export interface MonumentReportView {
  kind: 'MONUMENT';
  id: string;
  at: Date;
  monument: { id: string; ordinal: number; position: Vec3 };
  attacking: boolean;
  grade: Grade;
  control: 'ATTACKER' | 'DEFENDER' | 'EMPTY';
  defenderCargoRetreated: boolean;
  roundCount: number;
  yourFleet: Fleet;
  yourSurvivors: Fleet;
  yourLosses: Fleet;
  yourDamage: HpDamageLot[];
  /** Confirmed destruction, never the opponent's starting board or remaining force. */
  theirLosses: Fleet;
  lootDeuterium: number;
  dominion: number;
  honor?: HonorReportReceipt | null;
  opponents: { kind: 'PLAYER' | 'NEUTRAL'; playerId: string | null; name: string;
    clanName: string | null; clanTag: string | null }[];
}

/** The immutable participant is the authority; a live wave/world is unnecessary. */
export async function readMonumentBattleReports(tx: Tx, playerId: string, limit: number): Promise<MonumentReportView[]> {
  const rows = await tx.select({ battle: monumentBattles, own: monumentBattleParticipants })
    .from(monumentBattleParticipants).innerJoin(monumentBattles, eq(monumentBattles.id, monumentBattleParticipants.battleId))
    .where(and(eq(monumentBattleParticipants.playerId, playerId)))
    .orderBy(desc(monumentBattles.createdAt), desc(monumentBattles.id)).limit(Math.min(Math.max(0, limit), 50));
  const battleIds = [...new Set(rows.map(({ battle }) => battle.id))];
  const participants = battleIds.length === 0 ? [] : await tx.select().from(monumentBattleParticipants)
    .where(inArray(monumentBattleParticipants.battleId, battleIds));
  const honor = await readHonorReceipts(tx, playerId, battleIds.map(id => ({ source: 'MONUMENT', id })));
  return rows.map(({ battle, own }) => ({
    kind: 'MONUMENT', id: battle.id, at: battle.createdAt,
    monument: { id: battle.monumentId, ordinal: battle.monumentOrdinal, position: battle.monumentPosition },
    attacking: own.side === 'ATTACK', grade: battle.grade, control: battle.control, roundCount: battle.rounds.length,
    defenderCargoRetreated: battle.control === 'ATTACKER' && fleetCount(battle.defenderSurvivors) > 0,
    yourFleet: own.fleet, yourSurvivors: own.survivors, yourLosses: own.losses, yourDamage: own.damage,
    theirLosses: own.side === 'ATTACK' ? fleetDiff(battle.defenderFleet, battle.defenderSurvivors)
      : fleetDiff(battle.attackerFleet, battle.attackerSurvivors),
    lootDeuterium: own.lootDeuterium, dominion: own.dominionDelta,
    honor: honor.get(honorEventKey({ source: 'MONUMENT', id: battle.id })) ?? null,
    opponents: (() => {
      const opposing = participants.filter((row) => row.battleId === battle.id && row.side !== own.side);
      if (opposing.length > 0) return [...new Map(opposing.map((row) => [row.playerId, {
        kind: 'PLAYER' as const, playerId: row.playerId, name: row.commanderName,
        clanName: row.clanName, clanTag: row.clanTag,
      }])).values()];
      // An empty monument has no garrison to name.
      return own.side === 'ATTACK' && fleetCount(battle.defenderFleet) > 0
        ? [{ kind: 'NEUTRAL' as const, playerId: null, name: 'Neutral garrison', clanName: null, clanTag: null }] : [];
    })(),
  }));
}
