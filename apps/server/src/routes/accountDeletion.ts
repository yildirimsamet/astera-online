import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { securityLocales } from '../services/accountSecurity.js';
import { accountDeletionStatus, requestAccountDeletion, listAccountDeletionRequests, approveAccountDeletion, completeAccountDeletion, recordSupportDeletionRequest } from '../services/accountDeletionRequest.js';
import { requireAdmin } from './community.js';
import { processMediaDeletionQueue } from '../services/mediaErasure.js';
import { mediaDeletionQueue } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const requestBody = z.object({ currentPassword: z.string().min(1).max(200), locale: z.enum(securityLocales) }).strict();

async function cleanupMedia(app: FastifyInstance, directory: string, requestId: string): Promise<boolean> {
  try {
    await processMediaDeletionQueue(app.db, directory, requestId);
    const [pending] = await app.db.select({ assetId: mediaDeletionQueue.assetId }).from(mediaDeletionQueue).where(eq(mediaDeletionQueue.requestId, requestId)).limit(1);
    return !!pending;
  } catch {
    app.log.error('Account media erasure deferred; durable outbox will retry');
    return true;
  }
}

/** Shared by cookie/web and native Bearer clients; responses contain no account selector. */
export function registerAccountDeletionRoutes(app: FastifyInstance, mediaDirectory: string, journalSecret: string): void {
  const journal = { directory: mediaDirectory, secret: journalSecret };
  app.addHook('onSend', (req, reply, payload, done) => {
    if (req.url.startsWith('/api/admin/account-deletion')) void reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
  app.get('/api/auth/account-deletion', { preHandler: requireAuth }, req => accountDeletionStatus(app.db, req.accountId!));
  app.post('/api/auth/account-deletion', { bodyLimit: 4096, preHandler: requireAuth, config: { rateLimit: app.limits.auth } }, async (req, reply) => {
    const body = requestBody.parse(req.body);
    const result = await requestAccountDeletion(app.db, app.clock, req.accountId!, req.authVersion!, body.currentPassword, body.locale);
    return reply.code(202).send(result);
  });
  app.get('/api/admin/account-deletion', { preHandler: requireAdmin }, () => listAccountDeletionRequests(app.db));
  app.post('/api/admin/account-deletion', { bodyLimit: 4096, preHandler: requireAdmin, config: { rateLimit: app.limits.auth } }, async (req, reply) => {
    const body = z.object({ username: z.string().trim().min(1).max(128), locale: z.enum(securityLocales), confirm: z.literal(true) }).strict().parse(req.body);
    return reply.code(202).send(await recordSupportDeletionRequest(app.db, app.clock, body.username, body.locale, req.accountId!));
  });
  app.post('/api/admin/account-deletion/:requestId/media-cleanup', { bodyLimit: 4096, preHandler: requireAdmin, config: { rateLimit: app.limits.auth } }, async req => {
    const { requestId } = z.object({ requestId: z.string().uuid() }).strict().parse(req.params);
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    return { requestId, mediaCleanupPending: await cleanupMedia(app, mediaDirectory, requestId) };
  });
  app.post('/api/admin/account-deletion/:requestId/approve', { bodyLimit: 4096, preHandler: requireAdmin, config: { rateLimit: app.limits.auth } }, req => {
    const { requestId } = z.object({ requestId: z.string().uuid() }).strict().parse(req.params);
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    return approveAccountDeletion(app.db, app.clock, requestId, req.accountId!, journal);
  });
  app.post('/api/admin/account-deletion/:requestId/complete', { bodyLimit: 4096, preHandler: requireAdmin, config: { rateLimit: app.limits.auth } }, async req => {
    const { requestId } = z.object({ requestId: z.string().uuid() }).strict().parse(req.params);
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    const result = await completeAccountDeletion(app.db, app.clock, requestId, req.accountId!, journal);
    // Account erasure already committed. Housekeeping failures cannot undo it.
    const pending = await cleanupMedia(app, mediaDirectory, requestId);
    return { ...result, ...(pending ? { mediaCleanupPending: true } : {}) };
  });
}
