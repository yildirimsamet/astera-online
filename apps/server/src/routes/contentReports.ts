import { requireMediaReader, sendChatMediaFile } from './chatMedia.js';
import { isAdminAccount } from '../services/admin.js';
import { GameError } from '../services/planet.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { requireAdmin } from './community.js';
import { contentReportBody, contentReportMedia, listContentReports, submitContentReport, resolveContentReport } from '../services/contentReports.js';

export function registerContentReportRoutes(app: FastifyInstance, directory: string): void {
  app.addHook('onSend', (req, reply, payload, done) => {
    if (!reply.hasHeader('cache-control') && (req.url.startsWith('/api/community/reports') || req.url.startsWith('/api/admin/content-reports'))) void reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
  const requireOperatorMedia = async (req: FastifyRequest): Promise<void> => {
    await requireMediaReader(req);
    if (!await isAdminAccount(app.db, req.accountId!, app.adminUsernames)) throw new GameError('ADMIN_FORBIDDEN', 'Admin access is required', 403);
  };
  app.get('/api/admin/content-reports/:id/media', { preHandler: requireOperatorMedia }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).strict().parse(req.params);
    z.object({}).strict().parse(req.query);
    const asset = await contentReportMedia(app.db, app.clock, id);
    return sendChatMediaFile(req, reply, asset, directory);
  });
  app.post('/api/community/reports', { bodyLimit: 8192, preHandler: requireAuth }, async (req, reply) =>
    reply.code(202).send(await submitContentReport(app.db, app.clock, req.accountId!, contentReportBody.parse(req.body), app.adminUsernames)));
  app.get('/api/admin/content-reports', { preHandler: requireAdmin }, () => listContentReports(app.db));
  app.post('/api/admin/content-reports/:id/resolve', { bodyLimit: 4096, preHandler: requireAdmin }, req => {
    const { id } = z.object({ id: z.string().uuid() }).strict().parse(req.params);
    const body = z.object({ action: z.enum(['MASK', 'DISMISS']), confirm: z.literal(true) }).strict().parse(req.body);
    return resolveContentReport(app.db, app.clock, id, body.action, req.accountId!);
  });
}
