import { missionHidesFromGalaxy, type AppliedCapsule } from '@astera/rules';
import { and, inArray, isNull } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { clanMemberships } from '../db/schema.js';

/**
 * WHO MAY SEE A FLIGHT UNDER OPTIK ÖRTÜ (plan 2026-11-24 §3.5, K11, owner 2026-11-25): its owner and the
 * owner's clan, nobody else, whatever their Telescope, Radar or Gözcü. No counter exists yet, so this is
 * the whole rule. Two batched reads for every veiled leg in the season, none when there is none.
 */
export type VeiledViewers = ReadonlyMap<string, ReadonlySet<string>>;

export async function veiledViewers(
  db: Queryable,
  legs: readonly { id: string; ownerPlayerId: string; appliedCapsules: readonly AppliedCapsule[] }[],
): Promise<VeiledViewers> {
  const veiled = legs.filter((leg) => missionHidesFromGalaxy(leg.appliedCapsules));
  if (veiled.length === 0) return new Map();
  const owners = [...new Set(veiled.map((leg) => leg.ownerPlayerId))];
  const ownerClans = await db.select({ playerId: clanMemberships.playerId, clanId: clanMemberships.clanId }).from(clanMemberships)
    .where(and(inArray(clanMemberships.playerId, owners), isNull(clanMemberships.leftAt)));
  const clanIds = [...new Set(ownerClans.map((row) => row.clanId))];
  const members = clanIds.length === 0 ? [] : await db.select({ playerId: clanMemberships.playerId, clanId: clanMemberships.clanId })
    .from(clanMemberships).where(and(inArray(clanMemberships.clanId, clanIds), isNull(clanMemberships.leftAt)));
  const clanOf = new Map(ownerClans.map((row) => [row.playerId, row.clanId]));
  return new Map(veiled.map((leg) => {
    const clanId = clanOf.get(leg.ownerPlayerId);
    const viewers = new Set([leg.ownerPlayerId, ...members.filter((row) => row.clanId === clanId).map((row) => row.playerId)]);
    return [leg.id, viewers];
  }));
}

/** True when `viewer` must not see this leg at all. A missing viewer (a visitor) sees no veiled leg. */
export const hiddenByVeil = (viewers: VeiledViewers | undefined, missionId: string, viewer: string | null): boolean => {
  const allowed = viewers?.get(missionId);
  return allowed !== undefined && (viewer === null || !allowed.has(viewer));
};
