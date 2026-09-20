import type { FastifyInstance } from 'fastify';
import { activeGalaxyEvents, nextPublicGalaxyEvent } from '../services/galaxyEvents.js';
import { requireAuth } from './auth.js';

export function registerGalaxyEventRoutes(app: FastifyInstance): void {
  app.get('/api/galaxy/events', { preHandler: requireAuth }, async (req) => {
    const [events, next] = await Promise.all([
      activeGalaxyEvents(app.db, req.accountId!, app.clock),
      nextPublicGalaxyEvent(app.db, req.accountId!, app.clock),
    ]);
    return { events, next };
  });
}
