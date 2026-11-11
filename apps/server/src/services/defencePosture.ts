import {
  clanDefenseApplies,
  legacyPosture,
  postureFromToggles,
  togglesOf,
  type DefencePosture,
  type LegacyDefencePosture,
} from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { activeClanMembership } from './clanCombat.js';

/**
 * THE TWO DEFENCE TOGGLES AS A WORLD'S OWNER SEES THEM. Klan Savunma Desteği, owner K4;
 * independent since F1 (2026-11-10).
 *
 * Its own module because both the planet view and the support service read it, and
 * the support service also renders the planet view.
 */
/** Why the support toggle is greyed on a world; null when it may be switched on. */
export type SupportLockedReason = 'NOT_IN_CLAN';

export interface DefencePostureView {
  /** The three values an old client parses; ESCAPE_SUPPORT goes out as ESCAPE (`legacyPosture`). */
  posture: LegacyDefencePosture;
  /** The posture in effect, exactly. */
  stance: DefencePosture;
  escape: boolean;
  support: boolean;
  supportLocked: SupportLockedReason | null;
}

/**
 * THE POSTURE IN EFFECT. The stored value is the commander's setting; support only takes
 * anyone while they are in a clan, so outside one the door reads closed — to them, to the
 * raider's probe, to everybody. Joining a clan opens it again without a write.
 */
export function effectivePosture(posture: DefencePosture, inClan: boolean): DefencePosture {
  const toggles = togglesOf(posture);
  return postureFromToggles({ escape: toggles.escape, support: toggles.support && inClan });
}

/**
 * WHAT THE HANGAR PAGE SHOWS FOR THE TWO TOGGLES. Null in a season without the rule,
 * where the retreat is automatic and there is nothing to choose.
 */
export async function defencePostureView(
  db: Queryable,
  input: { playerId: string; posture: DefencePosture; rulesetVersion: number },
): Promise<DefencePostureView | null> {
  if (!clanDefenseApplies(input.rulesetVersion)) return null;
  const membership = await activeClanMembership(db, input.playerId);
  return buildDefencePostureView(input, membership !== null);
}

export function buildDefencePostureView(
  input: { posture: DefencePosture; rulesetVersion: number },
  hasMembership: boolean,
): DefencePostureView | null {
  if (!clanDefenseApplies(input.rulesetVersion)) return null;
  const stance = effectivePosture(input.posture, hasMembership);
  return {
    posture: legacyPosture(stance),
    stance,
    ...togglesOf(stance),
    supportLocked: hasMembership ? null : 'NOT_IN_CLAN',
  };
}

/**
 * THE PROBE'S POSTURE AND SUPPORT READINGS ON THE WIRE (owner K9). Absent where the report
 * read neither (a season without clan defence, a neutral world), never defaulted.
 */
export function probePostureFields<S>(report: { posture: DefencePosture | null; support: S | null }):
  { posture?: LegacyDefencePosture; stance?: DefencePosture; support?: S | null } {
  if (report.posture === null) return {};
  return { posture: legacyPosture(report.posture), stance: report.posture, support: report.support };
}
