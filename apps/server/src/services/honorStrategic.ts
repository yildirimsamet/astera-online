import { and, eq } from 'drizzle-orm';
import { HONOR_LAUNCH_VERSION, honorFleetValue, honorTacticalSide } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { honorCommitments, honorSeasons } from '../db/schema.js';
import { commitHonor, honorCommitmentSchema, type HonorCommitment } from './honorCommitment.js';
import { deferHonor } from './honorDeferred.js';
import type { HonorEvidence } from './honorAccounting.js';

export async function commitStrategicHonor(tx: Tx, input: {
  seasonId: string; id: string; owner: string; defenders: readonly string[]; at: Date; adminUsernames?: ReadonlySet<string>;
}) {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId));
  if (config?.version !== HONOR_LAUNCH_VERSION) return null;
  return commitHonor(tx, { seasonId: input.seasonId, source: 'STRATEGIC_IMPACT', id: input.id,
    attack: [input.owner], defence: input.defenders, at: input.at, adminUsernames: input.adminUsernames ?? new Set() });
}

export async function strategicHonorIntent(tx: Tx, seasonId: string, id: string) {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
  if (config?.version !== HONOR_LAUNCH_VERSION || config.legacySources.includes(`STRATEGIC_IMPACT:${id}`)) return null;
  const [row] = await tx.select().from(honorCommitments).where(and(eq(honorCommitments.seasonId, seasonId),
    eq(honorCommitments.source, 'STRATEGIC_IMPACT'), eq(honorCommitments.sourceId, id)));
  if (!row) throw new Error('Missing strategic Honor commitment');
  const intent = honorCommitmentSchema.parse(row.snapshot);
  if (intent.version !== config.version) throw new Error('Conflicting strategic Honor version');
  return { config, intent };
}

export function strategicHonorEvidence(intent: HonorCommitment, id: string, at: Date): HonorEvidence {
  const member = (row: HonorCommitment['attack'][number]) => ({ ...row,
    weight: Math.max(1, row.navy), civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 });
  return { source: 'STRATEGIC_IMPACT', id, at: at.getTime(), eligible: intent.eligible,
    attack: intent.attack.map(member), defence: intent.defence.map(member),
    relations: intent.relations, selectedDefenders: intent.selectedDefenders };
}

/** Only usable shield, genuine new blackout and loyalty loss count. */
export async function settleEmpHonor(tx: Tx, input: {
  seasonId: string; id: string; at: Date; defender: string | null;
  ground: Parameters<typeof honorFleetValue>[1]; coreOnline: boolean; groundWasOnline: boolean;
  shieldDestroyed: number; addedBlackoutPpm: number; loyaltyLost: number; effective: boolean;
}) {
  const ready = await strategicHonorIntent(tx, input.seasonId, input.id);
  if (!ready) return;
  const { intent, config } = ready;
  const evidence = strategicHonorEvidence(intent, input.id, input.at);
  const target = intent.defence[0];
  if (target?.id !== input.defender) {
    evidence.eligible = false; evidence.exclusion = 'TARGET_CHANGED';
  }
  if (target) {
    const effect = honorTacticalSide({ ownTier: 1, enemyTier: 1, ownNavy: 1, enemyNavy: 1,
      eligible: true, related: false, weakRepeat: 0, retaliationFifths: 0,
      shieldDestroyed: input.effective && input.groundWasOnline ? input.shieldDestroyed : 0,
      groundValue: input.effective && input.coreOnline ? honorFleetValue(config.catalogue, input.ground, true) : 0,
      groundWasOnline: input.groundWasOnline, addedBlackoutPpm: input.effective ? input.addedBlackoutPpm : 0,
      loyaltyLost: input.effective ? input.loyaltyLost : 0 });
    evidence.tactical = [{ actor: intent.attack[0]!.id, enemy: target.id, base: effect.gain, pressureFifths: effect.pressureFifths }];
  }
  deferHonor(tx, input.seasonId, evidence);
}

/** A fired charge is an efficiency cost, not a fabricated destroyed defender hull. */
export async function settleStrategicInterceptionHonor(tx: Tx, input: {
  seasonId: string; commitmentId: string; sourceId: string; defender: string; at: Date;
  weaponValue: number; chargeValue: number; defenderNavy: number;
}) {
  const ready = await strategicHonorIntent(tx, input.seasonId, input.commitmentId);
  if (!ready) return;
  const evidence = strategicHonorEvidence(ready.intent, input.sourceId, input.at);
  evidence.source = 'STRATEGIC_INTERCEPTION';
  const target = evidence.defence.find(row => row.id === input.defender);
  if (!target) { evidence.eligible = false; evidence.exclusion = 'TARGET_CHANGED'; }
  evidence.attack[0]!.loss = input.weaponValue;
  evidence.attack[0]!.combatLoss = input.weaponValue;
  if (target) {
    target.weight = input.chargeValue;
    target.defenceNavy = input.defenderNavy;
    target.efficiencyCost = input.chargeValue;
  }
  deferHonor(tx, input.seasonId, evidence);
}
