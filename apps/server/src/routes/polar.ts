import { webhooks } from '@polar-sh/sdk/2026-04';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Env } from '../env.js';
import { GameError } from '../services/planet.js';
import { polarPricingForIp, polarReady } from '../services/polar.js';
import { requireAuth } from './auth.js';
import { polarItemIds, processPolarEvent, startPolarPurchase } from '../services/polarSales.js';

const purchaseBody = z.object({ itemId: z.enum(polarItemIds) }).strict();

export function registerPolarRoutes(app: FastifyInstance, env: Env): void {
  app.get('/api/skins/polar-pricing', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    req => polarPricingForIp(req.ip));
  app.get('/api/skins/polar-shop', () => ({ enabled: polarReady(env) }));
  app.post('/api/skins/polar-purchase', { preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, req => {
    const { itemId } = purchaseBody.parse(req.body ?? {});
    return startPolarPurchase(app.db, env, req.accountId!, itemId, req.ip);
  });

  app.register((scope, _options, done) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 256 * 1024 },
      (_req, body, parsed) => { parsed(null, body); });
    scope.post('/api/polar/webhook', { bodyLimit: 256 * 1024 }, async req => {
      if (!env.POLAR_WEBHOOK_SECRET) throw new GameError('POLAR_WEBHOOK_UNAVAILABLE', 'Polar webhook is not configured', 503);
      if (typeof req.body !== 'string') throw new GameError('POLAR_SIGNATURE_INVALID', 'Invalid Polar signature', 401);
      const webhookId = req.headers['webhook-id'];
      const timestamp = req.headers['webhook-timestamp'];
      const signature = req.headers['webhook-signature'];
      if (typeof webhookId !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string') {
        throw new GameError('POLAR_SIGNATURE_INVALID', 'Invalid Polar signature', 401);
      }
      let event: unknown;
      try {
        event = await webhooks.validateEvent(Buffer.from(req.body), {
          'webhook-id': webhookId, 'webhook-timestamp': timestamp, 'webhook-signature': signature,
        }, env.POLAR_WEBHOOK_SECRET);
      } catch (error) {
        if (error instanceof webhooks.PolarWebhookError) {
          throw new GameError('POLAR_SIGNATURE_INVALID', 'Invalid Polar signature', 401);
        }
        throw error;
      }
      await processPolarEvent(app.db, webhookId, event);
      return { ok: true };
    });
    done();
  });
}
