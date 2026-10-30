import { ALERT_TIMINGS, type PaidAlertKind } from '@astera/rules';
import { z } from 'zod';

/** Bildirim Merkezi view. Mirrors `notificationCenterView` in the server. */
export const PAID_ALERT_KINDS = ['incoming_attack', 'incoming_strategic', 'probe_detected'] as const satisfies readonly PaidAlertKind[];

const timedPrices = z.object({ T3: z.number(), T5: z.number(), T15: z.number(), RADAR: z.number() });

export const notificationCenterSchema = z.object({
  built: z.boolean(),
  wallet: z.number(),
  timing: z.enum(ALERT_TIMINGS),
  muted: z.array(z.enum(PAID_ALERT_KINDS)),
  buildCost: z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() }),
  deuteriumPerHour: z.number(),
  prices: z.object({ incoming_attack: timedPrices, incoming_strategic: timedPrices, probe_detected: z.number() }),
  unfunded: z.number(),
  recent: z.array(z.object({
    kind: z.enum(PAID_ALERT_KINDS),
    status: z.enum(['PENDING', 'SENT', 'UNFUNDED', 'CANCELLED', 'NO_DEVICE']),
    price: z.number().nullable(),
    sendAt: z.coerce.date(),
    payload: z.object({ targetPlanetName: z.string().optional() }).passthrough(),
  })),
});
export type NotificationCenter = z.infer<typeof notificationCenterSchema>;
