import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CHAT_MEDIA } from '@astera/rules';
import { InvalidSessionError } from '../auth/tokens.js';
import { chatMediaAssets, chatMessages, clanMessages, dmMessages } from '../db/schema.js';
import { cleanupChatUploads, saveChatUpload } from '../services/chatMedia.js';
import { assertMessageReadable } from '../services/messageAccess.js';
import { GameError } from '../services/planet.js';
import { requireAuth } from './auth.js';
import { requireAdmin } from './community.js';

/** Native image/video requests use the same HttpOnly session cookie as token refresh. */
async function requireMediaReader(req: FastifyRequest): Promise<void> {
  if (req.headers.authorization) return requireAuth(req);
  const cookie = req.cookies.bs_refresh;
  if (!cookie) throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  try {
    const identity = await req.server.tokens.identity(cookie, 'refresh');
    req.accountId = identity.accountId;
    req.authVersion = identity.version;
  } catch (error) {
    if (!(error instanceof InvalidSessionError)) throw error;
    throw new GameError('UNAUTHENTICATED', 'Sign in first', 401);
  }
}

export function registerChatMediaRoutes(app: FastifyInstance, directory: string): void {
  // A private parser keeps the ordinary JSON body ceiling intact elsewhere.
  void app.register((uploads, _options, done) => {
    uploads.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: CHAT_MEDIA.videoMaxBytes }, (_req, bytes, done) => { done(null, bytes); });
    uploads.post('/api/admin/chat/media', { onRequest: requireAdmin, bodyLimit: CHAT_MEDIA.videoMaxBytes }, async req => {
      if (!Buffer.isBuffer(req.body)) throw new GameError('BAD_CHAT_MEDIA', 'Choose a supported file', 400);
      const type = z.enum(CHAT_MEDIA.mimeTypes).parse(req.headers['x-media-type']);
      await cleanupChatUploads(app.db, directory, app.clock.now());
      return saveChatUpload(app.db, req.accountId!, req.body, type, directory, app.clock.now());
    });
    done();
  });
  app.get('/api/chat/media/:id', { preHandler: requireMediaReader }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [asset] = await app.db.select().from(chatMediaAssets).where(eq(chatMediaAssets.id, id)).limit(1);
    if (!asset) throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Media not found', 404);
    if (asset.claimedAt && asset.channel && asset.messageId) {
      const scope = z.object({ channel: z.enum(['general', 'clan', 'dm']).optional(), messageId: z.string().uuid().optional() }).parse(req.query);
      if (scope.channel !== asset.channel || scope.messageId !== asset.messageId) throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Media not found', 404);
      await assertMessageReadable(app.db, req.accountId!, asset.channel, asset.messageId, app.adminUsernames, app.clock.now());
      const table = asset.channel === 'general' ? chatMessages : asset.channel === 'clan' ? clanMessages : dmMessages;
      const [message] = await app.db.select({ media: table.media }).from(table).where(eq(table.id, asset.messageId)).limit(1);
      if (!message?.media || message.media.kind === 'youtube' || message.media.assetId !== id) {
        throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Media not found', 404);
      }
    } else if (asset.ownerAccountId !== req.accountId || asset.createdAt.getTime() + CHAT_MEDIA.uploadLifetimeMs <= app.clock.now().getTime()) {
      throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Media not found', 404);
    }
    const file = join(directory, id);
    const info = await stat(file).catch(() => null);
    if (info?.size !== asset.byteSize) throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Media not found; ask the sender to resend it', 404);
    void reply.header('content-type', asset.mimeType).header('cache-control', 'private, no-store')
      .header('x-content-type-options', 'nosniff').header('accept-ranges', 'bytes')
      .header('content-disposition', 'inline');
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, info.size - Number(match[2])) : NaN;
      const end = match?.[1] && match[2] ? Math.min(info.size - 1, Number(match[2])) : info.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= info.size || end < start) {
        return reply.code(416).header('content-range', `bytes */${info.size}`).send();
      }
      return reply.code(206).header('content-range', `bytes ${start}-${end}/${info.size}`)
        .header('content-length', end - start + 1).send(createReadStream(file, { start, end }));
    }
    return reply.header('content-length', info.size).send(createReadStream(file));
  });
}
