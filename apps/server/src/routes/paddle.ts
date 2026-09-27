import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import type { Env } from '../env.js';
import { GameError } from '../services/planet.js';
import { createSkinPurchase, isPaddleWebhookIp, livePricingForIp, paddleCustomerForAccount,
  paddleItemIds, paddleReady, paddleWebhookReady, priceIdsFor, processPaddleEvent, verifyPaddleSignature } from '../services/paddleLive.js';

const purchaseBody = z.object({ itemId: z.enum(paddleItemIds) }).strict();

export function registerPaddleRoutes(app: FastifyInstance, env: Env): void {
  app.get('/api/paddle/client-config', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    () => paddleReady(env) ? { enabled: true, clientToken: env.PADDLE_CLIENT_TOKEN } : { enabled: false });
  app.get('/api/skins/pricing', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    req => livePricingForIp(env, req.ip));
  app.get('/api/skins/shop', { preHandler: requireAuth }, async req => {
    if (!paddleReady(env)) return { enabled: false };
    return { enabled: true, clientToken: env.PADDLE_CLIENT_TOKEN, priceIds: priceIdsFor(env),
      paddleCustomerId: await paddleCustomerForAccount(app.db, req.accountId!) };
  });
  app.post('/api/skins/purchase', { preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, req => {
    const { itemId } = purchaseBody.parse(req.body ?? {});
    return createSkinPurchase(app.db, env, req.accountId!, itemId, req.ip);
  });
  // Raw body is essential: Paddle signs bytes, not parsed JSON.
  app.register((scope, _options, done) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 256 * 1024 },
      (_req, body, parsed) => { parsed(null, body); });
    scope.post('/api/paddle/webhook', { bodyLimit: 256 * 1024 }, async req => {
      if (!paddleWebhookReady(env)) throw new GameError('PADDLE_WEBHOOK_UNAVAILABLE', 'Paddle webhook is not configured', 503);
      if (!await isPaddleWebhookIp(req.ip, env)) throw new GameError('PADDLE_SOURCE_INVALID', 'Invalid Paddle source', 403);
      const signature = req.headers['paddle-signature'];
      if (typeof req.body !== 'string' || !verifyPaddleSignature(req.body,
        typeof signature === 'string' ? signature : undefined, env.PADDLE_WEBHOOK_SECRET)) {
        throw new GameError('PADDLE_SIGNATURE_INVALID', 'Invalid Paddle signature', 401);
      }
      await processPaddleEvent(app.db, req.body);
      return { ok: true };
    });
    done();
  });
}
