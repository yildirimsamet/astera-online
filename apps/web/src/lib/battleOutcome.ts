import { fleetCount, type Grade } from '@astera/rules';
import type { BattleReport } from '../api/schemas.js';

export type BattleOutcome = 'win' | 'partial' | 'loss' | 'neutral';

/** Control/grade describe the side; a destroyed personal fleet is a separate loss.
 * Score and urgency must never replace either fact. Missing historical rosters
 * are unknown, rather than evidence that every ship was destroyed. */
export function battleOutcome(input: {
  attacking: boolean;
  grade: Grade;
  control?: 'ATTACKER' | 'DEFENDER' | 'EMPTY';
  survivors?: number;
  losses: number;
}): BattleOutcome {
  if (input.survivors === 0 && input.losses > 0) return 'loss';
  if (input.control === 'EMPTY') return 'neutral';
  if (input.control !== undefined) {
    const ownControl = input.attacking ? 'ATTACKER' : 'DEFENDER';
    if (input.control === ownControl) return 'win';
    return input.attacking && input.grade === 'PARTIAL' ? 'partial' : 'loss';
  }
  if (input.grade === 'PARTIAL') return 'partial';
  return (input.attacking ? input.grade === 'DECISIVE' : input.grade === 'REPELLED') ? 'win' : 'loss';
}

export function ordinaryBattleOutcome(report: BattleReport): BattleOutcome {
  const sent = fleetCount(report.yourFleet);
  return battleOutcome({ attacking: report.attacking, grade: report.grade,
    losses: fleetCount(report.yourLosses),
    survivors: sent > 0 ? Math.max(0, sent - fleetCount(report.yourLosses)) : undefined });
}

const controlKeys = {
  attacking: {
    ATTACKER: 'monument.battleResult.control.attacking.ATTACKER',
    DEFENDER: 'monument.battleResult.control.attacking.DEFENDER',
    EMPTY: 'monument.battleResult.control.attacking.EMPTY',
  },
  defending: {
    ATTACKER: 'monument.battleResult.control.defending.ATTACKER',
    DEFENDER: 'monument.battleResult.control.defending.DEFENDER',
    EMPTY: 'monument.battleResult.control.defending.EMPTY',
  },
} as const;
const gradeKeys = {
  attacking: {
    DECISIVE: 'monument.battleResult.grade.attacking.DECISIVE',
    PARTIAL: 'monument.battleResult.grade.attacking.PARTIAL',
    REPELLED: 'monument.battleResult.grade.attacking.REPELLED',
  },
  defending: {
    DECISIVE: 'monument.battleResult.grade.defending.DECISIVE',
    PARTIAL: 'monument.battleResult.grade.defending.PARTIAL',
    REPELLED: 'monument.battleResult.grade.defending.REPELLED',
  },
} as const;

export const monumentControlKey = (result: { attacking: boolean; control: 'ATTACKER' | 'DEFENDER' | 'EMPTY' }) =>
  controlKeys[result.attacking ? 'attacking' : 'defending'][result.control];
export const monumentGradeKey = (result: { attacking: boolean; grade: Grade }) =>
  gradeKeys[result.attacking ? 'attacking' : 'defending'][result.grade];

export const battleTone: Record<BattleOutcome, string> = {
  win: 'border-v2-self/40 bg-v2-self/5 text-v2-self',
  partial: 'border-v2-alloy/40 bg-v2-alloy/5 text-v2-alloy',
  loss: 'border-v2-hostile/40 bg-v2-hostile/5 text-v2-hostile',
  neutral: 'border-v2-line bg-v2-deep/40 text-v2-ink-2',
};
