import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { deferredPushes, pushDevices } from '../db/schema.js';
import { sendPush, type PushMessage } from './notificationCenter.js';

interface Phone { token: string; locale: typeof pushDevices.$inferSelect.locale }
const messageSchema = z.object({
  kind: z.enum(['incoming_attack', 'incoming_strategic', 'probe_detected', 'raid_over', 'raided', 'system_open', 'shield_falling', 'repair_done', 'miner_home', 'repair_funded', 'while_away']),
  title: z.string(), body: z.string(), data: z.record(z.string()),
});

/** Offset east of UTC, matching the client. 23:00 belongs to quiet time; 08:00 does not. */
export function quietDeliveryAt(now: Date, offsetMinutes: number): Date {
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const hour = local.getUTCHours();
  if (hour >= 8 && hour < 23) return now;
  if (hour >= 23) local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(8, 0, 0, 0);
  return new Date(local.getTime() - offsetMinutes * 60_000);
}

export async function deferQuietPushes(db: Db, devices: readonly Phone[], write: (locale: Phone['locale']) => PushMessage, now: Date): Promise<Phone[]> {
  if (!devices.length) return [];
  const registered = await db.select().from(pushDevices).where(inArray(pushDevices.token, devices.map(d => d.token)));
  const ready: Phone[] = [];
  for (const device of devices) {
    const phone = registered.find(p => p.token === device.token);
    if (!phone) continue;
    const message = write(device.locale);
    const deliverAt = quietDeliveryAt(now, phone.utcOffsetMinutes);
    if (message.kind === 'incoming_attack' || message.kind === 'shield_falling' || deliverAt <= now) { ready.push(device); continue; }
    const id = createHash('sha256').update(JSON.stringify([device.token, phone.accountId, message])).digest('hex');
    await db.insert(deferredPushes).values({ id, token: phone.token, accountId: phone.accountId, message: { ...message }, deliverAt }).onConflictDoNothing();
  }
  return ready;
}

/** Token ownership is rechecked: a phone handed to another account cannot hear the old account. */
export async function deliverDeferredPushes(db: Db, now: Date): Promise<void> {
  const claimed = await db.transaction(async tx => {
    const due = await tx.select().from(deferredPushes).where(lte(deferredPushes.deliverAt, now)).orderBy(asc(deferredPushes.deliverAt)).limit(100).for('update', { skipLocked: true });
    const messages: { phone: typeof pushDevices.$inferSelect; message: PushMessage }[] = [];
    for (const row of due) {
      const [phone] = await tx.select().from(pushDevices).where(and(eq(pushDevices.token, row.token), eq(pushDevices.accountId, row.accountId)));
      const parsed = messageSchema.safeParse(row.message);
      if (phone && parsed.success) {
        const deliverAt = quietDeliveryAt(now, phone.utcOffsetMinutes);
        if (parsed.data.kind !== 'incoming_attack' && parsed.data.kind !== 'shield_falling' && deliverAt > now) {
          await tx.update(deferredPushes).set({ deliverAt }).where(eq(deferredPushes.id, row.id));
          continue;
        }
        messages.push({ phone, message: parsed.data });
      }
      await tx.delete(deferredPushes).where(eq(deferredPushes.id, row.id));
    }
    return messages;
  });
  // Claims committed before FCM: an outage cannot replay an earlier successful delivery.
  // Each claimed message is attempted at most once; one failure does not stop its neighbours.
  for (const { phone, message } of claimed) {
    try { await sendPush(db, [phone], () => message, now); } catch { /* At most once delivery. */ }
  }
}
