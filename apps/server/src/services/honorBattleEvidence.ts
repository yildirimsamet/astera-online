import { HONOR_LAUNCH_VERSION, fleetEntries, honorFleetValue, honorInteger, honorLootValue, honorLossEvidence, honorNumber, honorShieldWeight,
  type Fleet, type HonorCatalogue, type Resources } from '@astera/rules';
import { honorEvidenceSchema, type HonorEvidence } from './honorAccounting.js';
import { honorCommitmentSchema, type HonorCommitment } from './honorCommitment.js';

export interface HonorBattleStack {
  id: string;
  defenceNavy?: number;
  /** Actual roster after travel losses and escape, before the first combat round. */
  sent: Fleet;
  /** Ships eligible to fire at entry; disabled physical targets cannot buy a share. */
  active: Fleet;
  losses: Fleet;
  rebuilt: Fleet;
  /** What this owner's stores actually lost; never wreck, capacity or promised cargo. */
  lootLost: Resources;
}

/** Server adapter contract: no grade, personal damage credit or last-hit ownership. */
export function honorBattleEvidence(input: {
  catalogue: HonorCatalogue; commitment: HonorCommitment;
  source: HonorEvidence['source']; id: string; at: number;
  attack: readonly HonorBattleStack[]; defence: readonly HonorBattleStack[];
  shield?: { host: string; investment: number; capacity: number; normalAbsorbed: number };
}): HonorEvidence {
  const frozen = honorCommitmentSchema.parse(input.commitment);
  honorInteger(input.at);
  if (input.at < frozen.at) throw new Error('Battle precedes Honor commitment');
  const side = (stacks: readonly HonorBattleStack[], references: HonorCommitment['attack'], attacking: boolean) => {
    const actualIds = [...new Set(stacks.map(stack => stack.id))].sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(references.map(row => row.id).sort())) {
      throw new Error('Honor participants changed after commitment');
    }
    return stacks.map(stack => {
      const reference = references.find(row => row.id === stack.id)!;
      const physical = honorFleetValue(input.catalogue, stack.sent);
      const weight = honorFleetValue(input.catalogue, stack.active, true);
      for (const [hull, count] of fleetEntries(stack.active)) {
        if (count > (stack.sent[hull] ?? 0)) throw new Error('Invalid Honor active roster');
      }
      const loss = honorLossEvidence(input.catalogue, stack);
      if (!attacking && frozen.version === HONOR_LAUNCH_VERSION && stack.defenceNavy === undefined) {
        throw new Error('Missing pre-battle Honor defence inventory');
      }
      const lootLost = honorLootValue(stack.lootLost);
      if (attacking && (stack.lootLost.alloy > 0 || stack.lootLost.crystal > 0 || stack.lootLost.deuterium > 0)) {
        throw new Error('Ordinary defence cannot take attacker loot');
      }
      return { ...reference, ...(!attacking && frozen.version === HONOR_LAUNCH_VERSION ? { defenceNavy: stack.defenceNavy } : {}), weight, civilianWeight: physical - weight,
        loss: loss.all, combatLoss: loss.armed, lootLost };
    });
  };
  const attack = side(input.attack, frozen.attack, true), defence = side(input.defence, frozen.defence, false);
  if (input.shield) {
    const shield = input.shield;
    if (!Number.isFinite(shield.normalAbsorbed) || shield.normalAbsorbed < 0 || shield.normalAbsorbed > shield.capacity) {
      throw new Error('Invalid Honor shield absorption');
    }
    const host = defence.find(row => row.id === shield.host);
    if (!host) throw new Error('Honor shield host is absent');
    const armedValue = honorNumber(defence.reduce((sum, row) => sum + BigInt(row.weight), 0n));
    host.weight = honorNumber(BigInt(host.weight) + BigInt(honorShieldWeight({ ...shield, armedValue,
      normalAbsorbed: Math.floor(shield.normalAbsorbed) })));
  }
  return honorEvidenceSchema.parse({ source: input.source, id: input.id, at: input.at,
    ...(frozen.galaxyTopTier === undefined ? {} : { galaxyTopTier: frozen.galaxyTopTier }),
    ...(frozen.weakNavyBand === undefined ? {} : { weakNavyBand: frozen.weakNavyBand }),
    ...(frozen.retaliationLootPercent === undefined ? {} : { retaliationLootPercent: frozen.retaliationLootPercent }),
    ...(frozen.selectedDefenders === undefined ? {} : { selectedDefenders: frozen.selectedDefenders }),
    eligible: frozen.eligible, exclusion: frozen.exclusion, relations: frozen.relations, attack, defence });
}
