import { z } from 'zod';
import type { NotificationView } from '../api/schemas.js';
import { compact } from './format.js';

/**
 * The four notification types, turned into the four sentences a player reads.
 *
 * There are exactly four and there will not be a fifth: incoming fleet, fleet
 * returned, raided while away, scan detected. "Your storage is full", "we miss
 * you", streaks and login bonuses are all deliberately absent — every one of them
 * is a dark pattern, and the game is supposed to be worth opening on its own.
 *
 * Payloads are parsed, never trusted: the same worker writes richer payloads at
 * higher radar levels, so the extra fields are genuinely optional.
 */

const incoming = z.object({
  etaMinutes: z.number(),
  estimatedShips: z.number().optional(),
  fleet: z.record(z.string(), z.number()).optional(),
});

const returned = z.object({
  ships: z.number(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
});

const raided = z.object({
  grade: z.string(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
  unitsLost: z.number(),
});

const scanned = z.object({ bearing: z.string().optional() });

export function describeNotification(notification: NotificationView): string | null {
  switch (notification.kind) {
    case 'incoming_fleet': {
      const parsed = incoming.safeParse(notification.payload);
      if (!parsed.success) return 'Incoming fleet.';
      const size = parsed.data.estimatedShips;
      return `Incoming fleet · ETA ${String(parsed.data.etaMinutes)} min${
        size === undefined ? '' : ` · est. ${String(size)} ships`
      }`;
    }
    case 'fleet_returned': {
      const parsed = returned.safeParse(notification.payload);
      if (!parsed.success) return 'Your fleet is home.';
      const loot = parsed.data.lootAlloy + parsed.data.lootCrystal;
      return loot > 0
        ? `Fleet home · ${String(parsed.data.ships)} ships · +${compact(loot)} looted`
        : `Fleet home · ${String(parsed.data.ships)} ships · empty-handed`;
    }
    case 'raided': {
      const parsed = raided.safeParse(notification.payload);
      if (!parsed.success) return 'You were raided.';
      if (parsed.data.grade === 'REPELLED') return 'You repelled a raid.';
      const loot = parsed.data.lootAlloy + parsed.data.lootCrystal;
      return `Raided · −${compact(loot)} taken · ${String(parsed.data.unitsLost)} units lost`;
    }
    case 'scan_detected': {
      const parsed = scanned.safeParse(notification.payload);
      const bearing = parsed.success ? parsed.data.bearing : undefined;
      // Bearing is in every payload, but only radar L2+ has earned the right to
      // read it — so the API's own radar-filtered log is the source for that, and
      // this line stays deliberately vague.
      void bearing;
      return 'Scan detected. Someone is building a picture of you.';
    }
    default:
      return null;
  }
}

/** Only these two are worth interrupting a session for. */
export const isUrgent = (notification: NotificationView): boolean =>
  notification.kind === 'incoming_fleet' || notification.kind === 'raided';
