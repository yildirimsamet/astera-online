import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { COSMETIC_IDS, COSMETIC_CATEGORIES, MOBILE_HULLS, PLANET_SKIN_IDS, type MobileHullId } from '@astera/rules';
import { requireAuth } from './auth.js';
import { isAdminAccount } from '../services/admin.js';
import { GameError } from '../services/planet.js';
import { equipPlanetSkin, grantPlanetSkin, skinCollection } from '../services/cosmetics.js';
import { usernameSchema } from '../auth/credentials.js';
import { equipCosmetic } from '../services/cosmeticEquipment.js';
import { setSupporterStatus } from '../services/supporters.js';

const skinId = z.enum(PLANET_SKIN_IDS);
const mobileHull = z.string().refine((id): id is MobileHullId => MOBILE_HULLS.some(hull => hull === id), 'Invalid ship type');
const equipBody = z.object({ skinId: skinId.nullable() }).strict();
const planetParam = z.object({ planetId: z.string().uuid() });
const grantBody = z.object({
  username: usernameSchema,
  skinId,
  orderRef: z.string().trim().min(3).max(120),
}).strict();
const supporterBody = z.object({ username: usernameSchema, supporter: z.boolean() }).strict();

async function requireAdmin(req: FastifyRequest): Promise<void> {
  await requireAuth(req);
  if (!await isAdminAccount(req.server.db, req.accountId!, req.server.adminUsernames)) {
    throw new GameError('ADMIN_FORBIDDEN', 'Admin access is required', 403);
  }
}

export function registerCosmeticRoutes(app: FastifyInstance): void {
  app.post('/api/cosmetics/equip', {
    preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, req => {
    const body = z.object({ category: z.enum(COSMETIC_CATEGORIES), cosmeticId: z.enum(COSMETIC_IDS).nullable(), hull: mobileHull.optional() }).strict().parse(req.body);
    return equipCosmetic(app.db, req.accountId!, body.category, body.cosmeticId, body.hull);
  });
  app.post('/api/admin/cosmetics/grant', { preHandler: requireAdmin }, req => {
    const body = grantBody.extend({ skinId: z.enum(COSMETIC_IDS) }).parse(req.body);
    return grantPlanetSkin(app.db, req.accountId!, body.username, body.skinId, body.orderRef);
  });
  app.get('/api/skins', { preHandler: requireAuth }, (req) =>
    skinCollection(app.db, req.accountId!));
  app.post('/api/skins/planets/:planetId', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, (req) => {
    const { planetId } = planetParam.parse(req.params);
    const { skinId: choice } = equipBody.parse(req.body ?? {});
    return equipPlanetSkin(app.db, req.accountId!, planetId, choice);
  });
  app.post('/api/admin/skins/grant', { preHandler: requireAdmin }, (req) => {
    const body = grantBody.parse(req.body ?? {});
    return grantPlanetSkin(app.db, req.accountId!, body.username, body.skinId, body.orderRef);
  });
  app.post('/api/admin/supporters', { preHandler: requireAdmin }, async (req) => {
    const body = supporterBody.parse(req.body ?? {});
    const result = await setSupporterStatus(app.db, app.clock, req.accountId!, body.username, body.supporter);
    req.log.info({ operatorAccountId: req.accountId, accountId: result.accountId, supporter: result.supporter }, 'Manual supporter status');
    return result;
  });
}
