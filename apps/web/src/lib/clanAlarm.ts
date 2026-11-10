import { z } from 'zod';
import type { Fleet } from '@astera/rules';
import { sumFleets } from './fleetPage.js';
import type { NotificationView } from '../api/schemas.js';

/**
 * KLAN ALARMI — a clanmate's radar heard a raid (F2 P2 · E1, owner 2026-11-10).
 *
 * The bell's row is the door: one tap opens the support sheet aimed at the host's world, with
 * the raid's landing instant beside the wave's, so the sheet can say "in time" or "too late".
 */
export interface ClanAlarmCall {
  alarmId: string;
  hostPlanetId: string;
  hostPlanetName: string;
  /** Absent on a row written before the server named the host. */
  hostName: string | null;
  arriveAt: Date;
}

const alarmPayload = z.object({
  alarmId: z.string().uuid(),
  hostPlanetId: z.string().min(1),
  targetPlanetName: z.string(),
  hostName: z.string().optional(),
  arriveAt: z.coerce.date(),
  /** Present only when the host's radar read where the raid came from. */
  originPlanetId: z.string().min(1).optional(),
});

export function clanAlarmOf(notification: NotificationView): ClanAlarmCall | null {
  if (notification.kind !== 'clan_alarm') return null;
  const parsed = alarmPayload.safeParse(notification.payload);
  if (!parsed.success) return null;
  const { alarmId, hostPlanetId, targetPlanetName, hostName, arriveAt } = parsed.data;
  return { alarmId, hostPlanetId, hostPlanetName: targetPlanetName, hostName: hostName ?? null, arriveAt };
}

/** A clanmate world under a raid still in the air, as the galaxy rings it (F2). */
export interface ActiveClanAlarm {
  hostPlanetId: string;
  arriveAt: Date;
  /** The raider's world when the host's radar read it; null otherwise. */
  originPlanetId: string | null;
}

/**
 * THE GALAXY'S ALARM RINGS, from the bell the reader already holds. One per world — the raid that
 * lands first — and only while it is still in the air; soonest first.
 */
export function activeClanAlarms(notifications: readonly NotificationView[], now: number): ActiveClanAlarm[] {
  const byWorld = new Map<string, ActiveClanAlarm>();
  for (const notification of notifications) {
    if (notification.kind !== 'clan_alarm') continue;
    const parsed = alarmPayload.safeParse(notification.payload);
    if (!parsed.success || parsed.data.arriveAt.getTime() <= now) continue;
    const { hostPlanetId, arriveAt, originPlanetId } = parsed.data;
    const held = byWorld.get(hostPlanetId);
    if (held && held.arriveAt <= arriveAt) continue;
    byWorld.set(hostPlanetId, { hostPlanetId, arriveAt, originPlanetId: originPlanetId ?? null });
  }
  return [...byWorld.values()].sort((a, b) => a.arriveAt.getTime() - b.arriveAt.getTime());
}

/**
 * IN TIME OR TOO LATE. A wave stands in the line only if it lands strictly before the raid; one
 * landing at the same instant is late. `minutes` is the gap either way, unrounded.
 */
export function supportVerdict(landsAt: Date, raidAt: Date): { inTime: boolean; minutes: number } {
  const gap = raidAt.getTime() - landsAt.getTime();
  return { inTime: gap > 0, minutes: Math.abs(gap) / 60_000 };
}

/**
 * F2 E6: the support in the air that lands before this world's next raid — every wave the host's
 * line will hold when the raid lands, beyond the one already standing. Empty with no raid ahead.
 */
export function supportLandingBefore(
  waves: readonly { status: string; arriveAt: Date; fleet: Fleet }[],
  alarms: readonly { arriveAt: Date }[] | undefined,
  now: number,
): Fleet {
  const raid = Math.min(...(alarms ?? []).map((alarm) => alarm.arriveAt.getTime()).filter((at) => at > now));
  if (!Number.isFinite(raid)) return {};
  return sumFleets(...waves.filter((wave) => wave.status === 'OUTBOUND' && wave.arriveAt.getTime() < raid).map((wave) => wave.fleet));
}
