import type { FastifyInstance } from 'fastify';
import { activeGalaxyEvents } from '../services/galaxyEvents.js';
import { requireAuth } from './auth.js';

export function registerGalaxyEventRoutes(app: FastifyInstance): void {
  app.get('/api/galaxy/events', { preHandler: requireAuth }, async (req) => ({
    events: await activeGalaxyEvents(app.db, req.accountId!, app.clock),
  }));
}
