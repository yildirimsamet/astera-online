import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { ABUSE, coreTier } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { battleReports, missions, planets } from '../db/schema.js';
import { addMinutes } from '../clock.js';
import { lockClanPlayers } from './clanCombat.js';
import { GameError } from './planet.js';

/** Called only by ordinary raid launch, after the tier band and before spending. */
export async function assertPersonalRaidAvailable(
  tx: Tx,
  input: { attackerPlayerId: string; defenderPlayerId: string; attackerPeak: number; defenderPeak: number; now: Date },
): Promise<void> {
  if (Math.min(coreTier(input.attackerPeak), coreTier(input.defenderPeak)) > ABUSE.personalRaidProtectedTier) return;

  // The same player locks as settlement and clan quota checks, in their existing order.
  // Different origin/target colonies must not reserve the same allowance concurrently.
  await lockClanPlayers(tx, [input.attackerPlayerId, input.defenderPlayerId]);
  const [last] = await tx.select({ at: battleReports.createdAt }).from(battleReports)
    .where(and(
      eq(battleReports.attackerPlayerId, input.attackerPlayerId),
      eq(battleReports.defenderPlayerId, input.defenderPlayerId),
      eq(battleReports.targetKind, 'PLAYER'),
      isNull(battleReports.clanWarOperationId),
      gt(battleReports.createdAt, addMinutes(input.now, -ABUSE.personalRaidCooldownMinutes)),
    )).orderBy(desc(battleReports.createdAt)).limit(1);
  if (last) {
    throw new GameError('PERSONAL_RAID_COOLDOWN', 'Wait until the personal raid cooldown ends before attacking this commander again', 403, {
      until: addMinutes(last.at, ABUSE.personalRaidCooldownMinutes).toISOString(),
    });
  }

  // Reports start the clock; unresolved outbound fleets reserve the allowance.
  // Recall changes kind, radiation loss resolves the mission, and joint legs use
  // kind 'clan_war'. None of those should create an ordinary-raid cooldown.
  // Combat uses the current controller; a launch-time ownership snapshot can
  // become stale when a colony changes hands during the flight.
  const [pending] = await tx.select({ id: missions.id }).from(missions)
    .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
    .where(and(
      eq(missions.ownerPlayerId, input.attackerPlayerId),
      eq(missions.kind, 'attack'),
      eq(missions.status, 'in_flight'),
      isNull(missions.recalledAt),
      eq(planets.controllerPlayerId, input.defenderPlayerId),
    )).limit(1);
  if (pending) {
    throw new GameError('PERSONAL_RAID_PENDING', 'An ordinary raid is already on its way to this commander; wait for it or recall it', 409);
  }
}
