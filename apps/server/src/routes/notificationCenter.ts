import type { FastifyInstance } from 'fastify';
import { ALERT_TIMINGS, PAID_ALERTS, type PaidAlertKind } from '@astera/rules';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { commanderForAccount } from '../services/ownership.js';
import {
  buildNotificationCenter, forgetPushDevice, fundNotificationCenter, notificationCenterView, registerPushDevice,
  setNotificationCenter,
} from '../services/notificationCenter.js';

const paidKind = z.custom<PaidAlertKind>(value => typeof value === 'string' && Object.hasOwn(PAID_ALERTS, value));
const locale = z.enum(['en', 'tr', 'de', 'fr', 'es', 'ja']);

/** Bildirim Merkezi. Every mutation answers with the whole view (D53). */
export function registerNotificationCenterRoutes(app: FastifyInstance) {
  const viewFor = (playerId: string) => notificationCenterView(app.db, playerId, app.clock);

  app.get('/api/notification-center', { preHandler: requireAuth }, async req => {
    const owner = await commanderForAccount(app.db, req.accountId!);
    return viewFor(owner.playerId);
  });
  app.post('/api/notification-center/build', { preHandler: requireAuth }, async req => {
    const input = z.object({ planetId: z.string().uuid() }).strict().parse(req.body);
    const owner = await commanderForAccount(app.db, req.accountId!);
    await buildNotificationCenter(app.db, owner.playerId, input.planetId, app.clock);
    return viewFor(owner.playerId);
  });
  app.post('/api/notification-center/fund', { preHandler: requireAuth }, async req => {
    // `confirm` is the player having read "this cannot be taken back" (owner 2026-10-30).
    const input = z.object({ planetId: z.string().uuid(), amount: z.number().int().min(1).max(10_000_000), confirm: z.literal(true) })
      .strict().parse(req.body);
    const owner = await commanderForAccount(app.db, req.accountId!);
    await fundNotificationCenter(app.db, owner.playerId, input.planetId, input.amount, input.confirm, app.clock);
    return viewFor(owner.playerId);
  });
  app.put('/api/notification-center/settings', { preHandler: requireAuth }, async req => {
    const input = z.object({ timing: z.enum(ALERT_TIMINGS).optional(), muted: z.array(paidKind).max(16).optional() })
      .strict().parse(req.body);
    const owner = await commanderForAccount(app.db, req.accountId!);
    await setNotificationCenter(app.db, owner.playerId, input);
    return viewFor(owner.playerId);
  });

  app.post('/api/push/devices', { preHandler: requireAuth }, async (req, reply) => {
    const input = z.object({ token: z.string().min(1).max(4096), platform: z.literal('android'), locale }).strict().parse(req.body);
    await registerPushDevice(app.db, req.accountId!, input.token, input.platform, input.locale, app.clock);
    return reply.code(204).send();
  });
  app.delete('/api/push/devices', { preHandler: requireAuth }, async (req, reply) => {
    const input = z.object({ token: z.string().min(1).max(4096) }).strict().parse(req.body);
    await forgetPushDevice(app.db, req.accountId!, input.token);
    return reply.code(204).send();
  });
}
