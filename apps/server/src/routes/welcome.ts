import type { FastifyInstance } from 'fastify';
import { openWelcomeBox, welcomeView } from '../services/welcomeWeek.js';
import { requireAuth } from './auth.js';

/** New Commander 7 Days (plan 2026-11-06 §7.2): account-level, so the same door aboard and landed. */
export function registerWelcomeRoutes(app: FastifyInstance): void {
  app.get('/api/welcome', { preHandler: requireAuth }, (req) => welcomeView(app.db, req.accountId!, app.clock.now()));
  app.post('/api/welcome/open', { preHandler: requireAuth }, (req) => openWelcomeBox(app.db, req.accountId!, app.clock));
}
