import type { FastifyInstance } from 'fastify';
import { nextMaintenance } from '../services/maintenanceWindow.js';

/**
 * THE PLANNED MAINTENANCE NOTICE. Scaling plan F0.9.
 *
 * PUBLIC: the client shows the coming window a day ahead and counts down to the
 * reopening while nginx answers everything else with 503. Two instants, nothing
 * about any player.
 */
export function registerMaintenanceRoutes(app: FastifyInstance): void {
  app.get('/api/maintenance', async () => {
    const window = await nextMaintenance(app.db, app.clock.now());
    return { window: window ? { startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString() } : null };
  });
}
