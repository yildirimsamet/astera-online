export type ClanTargetReason = 'targetOpen' | 'seasonTooShort' | null;

/** Surface gate only; the server rechecks the target and all seasonal rules. */
export function clanTargetDecision(input: {
  leader: boolean;
  available: boolean;
  realForeignPlayer: boolean;
  sameClan: boolean;
  operationOpen: boolean;
  seasonEndsAt: Date | null;
  now: number;
}): { visible: boolean; reason: ClanTargetReason } {
  const visible = input.leader && input.available && input.realForeignPlayer && !input.sameClan;
  if (!visible) return { visible: false, reason: null };
  if (input.operationOpen) return { visible: true, reason: 'targetOpen' };
  if (input.seasonEndsAt && input.seasonEndsAt.getTime() - input.now < 24 * 3_600_000) {
    return { visible: true, reason: 'seasonTooShort' };
  }
  return { visible: true, reason: null };
}
