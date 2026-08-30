import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { isAdminAccount } from '../services/admin.js';
import { sanitizeAnnouncementHtml } from '../services/announcementHtml.js';
import {
  listAnnouncements,
  listFeedback,
  markAnnouncementsRead,
  publishAnnouncement,
  submitFeedback,
} from '../services/community.js';
import { GameError } from '../services/planet.js';

const announcementBody = z.object({
  title: z.string().trim().min(1).max(120).refine((title) => !/[<>]/u.test(title), {
    message: 'Title must be plain text',
  }),
  bodyHtml: z.string().trim().min(1).max(100_000),
}).strict();
const announcementReadBody = z.object({ ids: z.array(z.string().uuid()).max(30) }).strict();
const feedbackBody = z.object({
  kind: z.enum(['BUG', 'SUGGESTION', 'PRAISE']),
  message: z.string().trim().min(3).max(2_000),
}).strict();

async function requireAdmin(req: FastifyRequest): Promise<void> {
  await requireAuth(req);
  if (!await isAdminAccount(req.server.db, req.accountId!, req.server.adminUsernames)) {
    throw new GameError('ADMIN_FORBIDDEN', 'Admin access is required', 403);
  }
}

export function registerCommunityRoutes(app: FastifyInstance): void {
  app.get('/api/announcements', { preHandler: requireAuth }, async (req) =>
    listAnnouncements(app.db, req.accountId!));

  app.post('/api/announcements/read', { preHandler: requireAuth }, async (req) => {
    const { ids } = announcementReadBody.parse(req.body ?? {});
    return markAnnouncementsRead(app.db, req.accountId!, ids, app.clock);
  });

  app.post(
    '/api/feedback',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req) => submitFeedback(app.db, req.accountId!, feedbackBody.parse(req.body ?? {}), app.clock),
  );

  app.get('/api/admin/feedback', { preHandler: requireAdmin }, async () => listFeedback(app.db));

  app.post('/api/admin/announcements', { preHandler: requireAdmin }, async (req) => {
    const body = announcementBody.parse(req.body ?? {});
    const sanitized = sanitizeAnnouncementHtml(body.bodyHtml);
    if (sanitized.rejected.length > 0) {
      throw new GameError(
        'UNSAFE_HTML',
        'The announcement contains executable or unsupported active content',
        400,
      );
    }
    if (sanitized.html.trim().length === 0) {
      throw new GameError('EMPTY_ANNOUNCEMENT', 'Announcement content is empty', 400);
    }
    return app.db.transaction((tx) => publishAnnouncement(
      tx,
      req.accountId!,
      { title: body.title, bodyHtml: sanitized.html },
      app.clock,
    ));
  });
}
