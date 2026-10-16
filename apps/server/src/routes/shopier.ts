import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { usernameSchema } from '../auth/credentials.js';
import type { Env } from '../env.js';
import { GameError } from '../services/planet.js';
import { verifyShopierSignature } from '../services/shopier.js';
import { dismissShopierOrder, grantShopierOrder, issueShopierCode, processShopierEvent, revokeShopierOrder,
  shopierItemIds, shopierQueue, shopierShop, syncShopierOrders } from '../services/shopierSales.js';
import { requireAuth } from './auth.js';
import { requireAdmin } from './community.js';

const codeBody = z.object({ itemId: z.enum(shopierItemIds) }).strict();
const orderParam = z.object({ orderId: z.string().regex(/^\d{1,20}$/) });
const grantBody = z.object({ username: usernameSchema }).strict();

export function registerShopierRoutes(app: FastifyInstance, env: Env): void {
  app.get('/api/skins/shopier-shop', () => shopierShop(env));
  app.post('/api/skins/shopier-code', { preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, req => {
    const { itemId } = codeBody.parse(req.body ?? {});
    return issueShopierCode(app.db, env, req.accountId!, itemId);
  });

  app.get('/api/admin/shopier/orders', { preHandler: requireAdmin }, () => shopierQueue(app.db));
  app.post('/api/admin/shopier/orders/:orderId/grant', { preHandler: requireAdmin }, req => {
    const { orderId } = orderParam.parse(req.params);
    const { username } = grantBody.parse(req.body ?? {});
    return grantShopierOrder(app.db, env, orderId, username);
  });
  app.post('/api/admin/shopier/orders/:orderId/dismiss', { preHandler: requireAdmin }, req =>
    dismissShopierOrder(app.db, env, orderParam.parse(req.params).orderId));
  app.post('/api/admin/shopier/orders/:orderId/revoke', { preHandler: requireAdmin }, req =>
    revokeShopierOrder(app.db, orderParam.parse(req.params).orderId));
  app.post('/api/admin/shopier/sync', { preHandler: requireAdmin }, () => syncShopierOrders(app.db, env));

  // Raw body is essential: Shopier signs bytes, not parsed JSON.
  app.register((scope, _options, done) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 256 * 1024 },
      (_req, body, parsed) => { parsed(null, body); });
    scope.post('/api/shopier/webhook', { bodyLimit: 256 * 1024 }, async req => {
      if (!env.SHOPIER_WEBHOOK_TOKEN.trim()) throw new GameError('SHOPIER_WEBHOOK_UNAVAILABLE', 'Shopier webhook is not configured', 503);
      const signature = req.headers['shopier-signature'];
      const webhookId = req.headers['shopier-webhook-id'];
      const eventType = req.headers['shopier-event'];
      if (typeof req.body !== 'string' || typeof webhookId !== 'string' || typeof eventType !== 'string'
        || !verifyShopierSignature(req.body, typeof signature === 'string' ? signature : undefined, env.SHOPIER_WEBHOOK_TOKEN)) {
        // The shape of the refusal, never the values: enough to tell a format change from a forgery.
        req.log.warn({ event: typeof eventType === 'string' ? eventType.slice(0, 64) : null, hasWebhookId: typeof webhookId === 'string',
          signatureLength: typeof signature === 'string' ? signature.length : null, bodyBytes: typeof req.body === 'string' ? req.body.length : null },
        'Shopier webhook signature rejected');
        throw new GameError('SHOPIER_SIGNATURE_INVALID', 'Invalid Shopier signature', 401);
      }
      let payload: unknown;
      try { payload = JSON.parse(req.body); } catch { return { ok: true }; }
      await processShopierEvent(app.db, env, webhookId, eventType, payload);
      return { ok: true };
    });
    done();
  });
}
