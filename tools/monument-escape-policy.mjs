/** Owner-approved simulation policy, frozen at battle start. Cargo has no combatValue. */
import { combatValue } from '../packages/rules/src/index.ts';

export function retreatProbabilities(attacker, defender) {
  const attackerPower = combatValue(attacker), defenderPower = combatValue(defender);
  if (attackerPower === defenderPower) return { attacker: 0.25, defender: 0.25, ratio: 1, attackerPower, defenderPower };
  const smaller = Math.min(attackerPower, defenderPower), larger = Math.max(attackerPower, defenderPower);
  const ratio = smaller > 0 ? larger / smaller : null;
  const weak = ratio === null || ratio >= 3 ? 0.75 : ratio >= 1.5 ? 0.5 : 0.25;
  return { attacker: attackerPower < defenderPower ? weak : 0.25,
    defender: defenderPower < attackerPower ? weak : 0.25, ratio, attackerPower, defenderPower };
}

/** New study: side-specific HP thresholds and probabilities, fixed at battle start. */
export function adaptiveRetreatPolicy(attacker, defender, { revised = false } = {}) {
  const base = retreatProbabilities(attacker, defender);
  const ratio = base.ratio ?? Infinity;
  const [weak, strong] = ratio >= 3
    ? [{ chance: revised ? 0.7 : 0.75, threshold: 0.7 }, { chance: 0.1, threshold: 0.25 }]
    : ratio >= 2
      ? [{ chance: revised ? 0.55 : 0.5, threshold: revised ? 0.55 : 0.5 }, { chance: 0.15, threshold: 0.3 }]
      : ratio >= 1.5
        ? [{ chance: 0.33, threshold: 0.3 }, { chance: 0.2, threshold: 0.3 }]
        : [{ chance: 0.25, threshold: 0.25 }, { chance: 0.25, threshold: 0.25 }];
  return { ...base,
    attacker: base.attackerPower < base.defenderPower ? weak : strong,
    defender: base.defenderPower < base.attackerPower ? weak : strong };
}
