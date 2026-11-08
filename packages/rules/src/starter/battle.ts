import type { OutcomeRow } from '../battleRetreat.js';
import type { BattleRecording } from '../battleRecording.js';
import { resolveBattle, type BattleResult, type DefenderStack, type JointAttackerStack } from '../combat.js';
import type { PvpBalance } from '../pvpBalance.js';
import type { Grade, Rng } from '../types.js';
import { STARTER } from './constants.js';
import { isFeatureOpen } from './features.js';
import { isJumpReady, moduleStage, type VesselProgress } from './ladder.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Written on every report here. Recovery has no "how much did you lose" test in this galaxy: a
 * decisive defeat is enough (§3.6), which is what the two zeros say.
 */
export const STARTER_PVP_BALANCE: PvpBalance = {
  lootDecisive: STARTER.pvp.lootDecisive,
  lootPartial: STARTER.pvp.lootPartial,
  lootBufferShare: STARTER.pvp.lootBufferShare,
  recoveryLossHours: 0,
  recoveryLookbackHours: 0,
  recoveryShieldHours: STARTER.pvp.recoveryShieldHours,
};

/**
 * THE ONE DOOR TO A BATTLE IN THIS GALAXY. The main solver, whole: counter cycle, eight rounds,
 * retreat, wounds and the ships too hurt to fire. The tempo is the only difference, so what is
 * learned here still holds after landing.
 */
export const starterBattle = (
  stacks: readonly JointAttackerStack[],
  defendingLine: readonly DefenderStack[],
  shield: number,
  rng: Rng,
  recording?: BattleRecording,
): BattleResult => resolveBattle(stacks, defendingLine, shield, rng, 'HP_PLANET', true, recording, STARTER.combat.tempo);

const ROW_RATIOS = [1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3];
const WEAK_KEEPS = [0.24, 0.31, 0.36, 0.38, 0.52, 0.65, 0.80, 0.85];
const STRONG_LOSES = [0.68, 0.47, 0.30, 0.24, 0.13, 0.06, 0.04, 0.02];

/**
 * THIS GALAXY'S ODDS, MEASURED. `combatOutcomeTable` is the owner's table for the main tempo and is
 * wrong here. These are readings of `starterBattle` over mixed small fleets with no Aegis, and
 * `starter-outcome-table` measures them again, so a change to `COMBAT` cannot leave them behind.
 */
export const starterOutcomeTable = (): OutcomeRow[] => ROW_RATIOS.map((ratio, i) => ({
  ratio,
  weakKeeps: { low: WEAK_KEEPS[i]!, high: WEAK_KEEPS[i]! },
  strongLoses: { low: STRONG_LOSES[i]!, high: STRONG_LOSES[i]! },
}));

export type VesselStatus = 'ACTIVE' | 'DORMANT' | 'DEPARTING' | 'DEPARTED';

export interface VesselStanding {
  id: string;
  status: VesselStatus;
  progress: VesselProgress;
  enlistedAtMs: number;
  /** Null until the Aegis is repaired: nobody may attack this ship before it has one. */
  pvpOpenAtMs: number | null;
  recoveryUntilMs: number | null;
}

export type AttackAnswer =
  | { ok: true; dropsOwnShield: boolean }
  | { ok: false; code: 'FEATURE_LOCKED' | 'PVP_LOCKED' | 'PVP_PROTECTED' | 'TARGET_GONE' | 'BASH_LIMIT' | 'RAID_CAP' };

export interface AttackQuestion {
  attacker: VesselStanding;
  target: VesselStanding;
  nowMs: number;
  /** When this attacker last launched at this target, however it went. */
  attacksByAttackerOnTargetMs: readonly number[];
  /** When anybody last took something from this target. */
  successfulRaidsOnTargetMs: readonly number[];
}

const within = (times: readonly number[], nowMs: number, windowMs: number): number =>
  times.filter(at => nowMs - at < windowMs).length;

const shielded = (ship: VesselStanding, nowMs: number): boolean =>
  (ship.pvpOpenAtMs !== null && ship.pvpOpenAtMs > nowMs) || (ship.recoveryUntilMs !== null && ship.recoveryUntilMs > nowMs);

/**
 * MAY THIS SHIP ATTACK THAT ONE, RIGHT NOW. Plan §3.6. There is no tier here, so this is the whole
 * protection model. Asked at launch and asked again at arrival: a fleet whose target has changed
 * turns back without a fight.
 */
export function canAttackVessel(question: AttackQuestion): AttackAnswer {
  const { attacker, target, nowMs } = question;
  // The attacker is asked what the target is asked: a shield, and the record that it went up.
  if (!isFeatureOpen(attacker.progress, 'attack') || attacker.pvpOpenAtMs === null) return { ok: false, code: 'FEATURE_LOCKED' };
  // Without this a ship could hold off its jump and spend its days on newcomers (A9).
  if (isJumpReady(attacker.progress) || nowMs - attacker.enlistedAtMs >= STARTER.pvp.lockAfterDays * DAY_MS) {
    return { ok: false, code: 'PVP_LOCKED' };
  }
  if (attacker.id === target.id || target.status !== 'ACTIVE') return { ok: false, code: 'TARGET_GONE' };
  if (moduleStage(target.progress, 'AEGIS') < 1 || target.pvpOpenAtMs === null || shielded(target, nowMs)) {
    return { ok: false, code: 'PVP_PROTECTED' };
  }
  if (within(question.attacksByAttackerOnTargetMs, nowMs, STARTER.pvp.bashWindowMinutes * 60_000) >= STARTER.pvp.bashLimit) {
    return { ok: false, code: 'BASH_LIMIT' };
  }
  if (within(question.successfulRaidsOnTargetMs, nowMs, DAY_MS) >= STARTER.pvp.dailyRaidCap) {
    return { ok: false, code: 'RAID_CAP' };
  }
  return { ok: true, dropsOwnShield: shielded(attacker, nowMs) };
}

/** Time to get ready, and a reason to come back ("my shield is ending"). */
export const vesselPvpOpenAt = (aegisRepairedAtMs: number): number =>
  aegisRepairedAtMs + STARTER.pvp.shieldHours * HOUR_MS;

/** What a defeat leaves behind, read from the attacker's grade. */
export const recoveryUntilAfter = (grade: Grade, nowMs: number): number | null =>
  grade === 'DECISIVE' ? nowMs + STARTER.pvp.recoveryShieldHours * HOUR_MS : null;
