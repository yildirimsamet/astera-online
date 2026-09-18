import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PLANET_SKIN_IDS } from '@astera/rules';
import { requireAuth } from './auth.js';
import { isAdminAccount } from '../services/admin.js';
import { GameError } from '../services/planet.js';
import { equipPlanetSkin, grantPlanetSkin, skinCollection } from '../services/cosmetics.js';
import { usernameSchema } from '../auth/credentials.js';

const skinId = z.enum(PLANET_SKIN_IDS);
const equipBody = z.object({ skinId: skinId.nullable() }).strict();
const planetParam = z.object({ planetId: z.string().uuid() });
const grantBody = z.object({
  username: usernameSchema,
  skinId,
  orderRef: z.string().trim().min(3).max(120),
}).strict();

async function requireAdmin(req: FastifyRequest): Promise<void> {
  await requireAuth(req);
  if (!await isAdminAccount(req.server.db, req.accountId!, req.server.adminUsernames)) {
    throw new GameError('ADMIN_FORBIDDEN', 'Admin access is required', 403);
  }
}

export function registerCosmeticRoutes(app: FastifyInstance): void {
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
}
