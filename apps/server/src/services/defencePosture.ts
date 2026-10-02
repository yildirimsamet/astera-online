import {
  clanDefenseApplies,
  togglesOf,
  type DefencePosture,
} from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { activeClanMembership } from './clanCombat.js';

/**
 * THE TWO DEFENCE TOGGLES AS A WORLD'S OWNER SEES THEM. Klan Savunma Desteği, owner K4.
 *
 * Its own module because both the planet view and the support service read it, and
 * the support service also renders the planet view.
 */
/** Why the support toggle is greyed on a world; null when it may be switched on. */
export type SupportLockedReason = 'NOT_IN_CLAN';

export interface DefencePostureView {
  posture: DefencePosture;
  escape: boolean;
  support: boolean;
  supportLocked: SupportLockedReason | null;
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
  return {
    posture: input.posture,
    ...togglesOf(input.posture),
    supportLocked: membership === null ? 'NOT_IN_CLAN' : null,
  };
}
