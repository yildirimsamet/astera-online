import { eq } from 'drizzle-orm';
import { raidLedger, type Fleet, type RaidLedger, type Resources } from '@astera/rules';
import { battleReports, missions } from '../db/schema.js';
import type { Db } from '../db/client.js';

/**
 * WHAT A SETTLED RAID ACTUALLY DID, READ BACK OUT OF WHAT IT SETTLED.
 *
 * IT DERIVES, IT NEVER PREDICTS. Every term here is a fact the battle already wrote down; there is
 * deliberately no second model of the combat, loot or salvage rules beside the server's own. A
 * predictor would drift from the settlement it claims to describe, and its number is the one people
 * would quote.
 *
 * WHY IT HAD TO EXIST. Nothing in the game could answer "did that raid pay?". The pieces were
 * spread across the report — loot here, permanent losses there, the collectors' haul in a third
 * column — and the one term nobody kept at all was the fuel, which is charged at launch and never
 * refunded. Asked three times in one afternoon, the question gave three different answers, each
 * time because a different piece had been left out: once the wreck was counted as free income when
 * lifting it needs two dozen collectors, once the loot was counted past what the survivors could
 * carry, and once the losses were priced on `fleetValue` (A+C+D) while the fuel was priced on
 * `resourceValue` (A+2C+32D).
 *
 * THE PvP LANE ONLY, AND IT IS THE REPORT THAT SAYS SO — not the mission. A NEUTRAL raid is a
 * `kind: 'attack'` mission exactly like a PvP one, so the mission row cannot tell the two apart;
 * the first version of this file checked only the kind and happily priced a caretaker world's
 * garrison as Dominion denied to a commander. `battleReports.targetKind` is the field that knows,
 * and a PvP report always names its defender. Both are checked.
 *
 * A pirate raid is a `pirate_raids` row with its own flight, loot, salvage and `capturedHull` —
 * not a mission — and it records no fuel of its own yet. The neutral lane grades its loot on its
 * own tier table. Each needs its own reader; answering for either from here would mean inventing
 * rules. `raidLedger`'s `captured` field is ready for the pirate lane and is deliberately unused
 * until it exists.
 *
 * PRE-MIGRATION MISSIONS ARE REFUSED. `missions.fuelPaid` backfilled historical rows with zero
 * because their fuel was never recorded and cannot be recovered (see the column's note). A raid
 * that crossed real distance with a real fleet never legitimately paid nothing, so a zero on an
 * attack or a pirate raid is that backfill — and pricing an unmeasured raid as a free one is the
 * single reading this whole ledger exists to prevent.
 */
export interface SettledRaidLedger extends RaidLedger {
  /** Echoed so a caller can show the arithmetic rather than assert it. */
  loot: Resources;
  salvage: Resources;
  fuelPaid: number;
}

export async function ledgerForMission(db: Db, missionId: string): Promise<SettledRaidLedger | null> {
  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1);
  if (!mission) return null;
  if (mission.kind !== 'attack') return null;

  const [report] = await db.select().from(battleReports)
    .where(eq(battleReports.missionId, missionId)).limit(1);
  if (!report) return null;

  /*
    THE LANE IS THE REPORT'S, NOT THE MISSION'S. Owner review, 2026-09-21.

    `mission.kind === 'attack'` is true of a neutral raid as well, so the mission row cannot say
    which fight this was. `targetKind` can, and a PvP report always names the commander on the
    other side. Without both checks a caretaker garrison's losses came back as Dominion denied to
    a PLAYER, which merges the two accounting lanes this file exists to keep apart.

    The neutral and pirate lanes each need their own reader: their loot is graded differently, a
    pirate raid is not a `missions` row at all, and neither has a defender whose loss is anybody's
    Dominion.
  */
  if (report.targetKind !== 'PLAYER' || report.defenderPlayerId === null) return null;

  /*
    A raid that flew a real distance with a real fleet paid something. Zero here is the historical
    backfill, not a free flight — see this file's header.
  */
  if (!(mission.fuelPaid > 0)) return null;

  const loot: Resources = report.loot;
  const salvage: Resources = report.salvage;

  return {
    ...raidLedger({
      attackerLosses: report.attackerLosses,
      /*
        NET OF WHAT THE GROUND REBUILT. `defenceSalvage` is the share of destroyed emplacements
        that comes back free from its own wreckage, so counting the gross would credit the attacker
        with denying something the defender still owns.
      */
      defenderLosses: withoutRebuilt(report.defenderLosses, report.defenceSalvage),
      loot,
      salvage,
      fuelPaid: mission.fuelPaid,
    }),
    loot,
    salvage,
    fuelPaid: mission.fuelPaid,
  };
}

/** Ground units that rebuilt from their own wreckage were never permanently denied. */
function withoutRebuilt(lost: Fleet, rebuilt: Fleet): Fleet {
  const out: Fleet = {};
  for (const [id, n] of Object.entries(lost) as [keyof Fleet, number][]) {
    const left = n - (rebuilt[id] ?? 0);
    if (left > 0) out[id] = left;
  }
  return out;
}
