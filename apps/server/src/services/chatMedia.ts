import { randomUUID } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { CHAT, CHAT_MEDIA, type ChatMedia } from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import { chatMediaAssets } from '../db/schema.js';
import { isAdminAccount } from './admin.js';
import type { MessageChannel } from './messageDecorations.js';
import { GameError } from './planet.js';

export const chatMediaSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('youtube'), videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }).strict(),
  z.object({ kind: z.literal('image'), assetId: z.string().uuid(), mimeType: z.string().max(60) }).strict(),
  z.object({ kind: z.literal('video'), assetId: z.string().uuid(), mimeType: z.string().max(60) }).strict(),
]);
export const chatMessageBody = z.object({
  content: z.string().trim().refine(value => Array.from(value).length <= CHAT.maxChars),
  replyToMessageId: z.string().uuid().optional(),
  media: chatMediaSchema.optional(),
}).strict().refine(value => value.content.length > 0 || value.media !== undefined, 'Write a message or attach media');

export async function claimChatMedia(
  tx: Tx, accountId: string, input: ChatMedia | undefined, adminUsernames: ReadonlySet<string>,
  now: Date, channel: MessageChannel, messageId: string,
): Promise<ChatMedia | null> {
  if (!input) return null;
  if (!await isAdminAccount(tx, accountId, adminUsernames)) throw new GameError('ADMIN_REQUIRED', 'Administrator access required', 403);
  if (input.kind === 'youtube') return chatMediaSchema.parse(input);
  const [asset] = await tx.select().from(chatMediaAssets)
    .where(and(eq(chatMediaAssets.id, input.assetId), eq(chatMediaAssets.ownerAccountId, accountId))).for('update').limit(1);
  if (!asset) throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Choose the file again', 404);
  if (asset.claimedAt) throw new GameError('CHAT_MEDIA_USED', 'This upload was already sent; choose the file again', 409);
  if (asset.createdAt.getTime() + CHAT_MEDIA.uploadLifetimeMs <= now.getTime()) {
    throw new GameError('CHAT_MEDIA_NOT_FOUND', 'Upload expired; choose the file again', 404);
  }
  if (asset.kind !== input.kind) throw new GameError('BAD_CHAT_MEDIA', 'Choose a supported file', 400);
  await tx.update(chatMediaAssets).set({ claimedAt: now, channel, messageId }).where(eq(chatMediaAssets.id, asset.id));
  return { kind: asset.kind, assetId: asset.id, mimeType: asset.mimeType };
}

export async function saveChatUpload(db: Db, accountId: string, bytes: Buffer, declaredType: string, directory: string, now: Date) {
  if (bytes.length === 0) throw new GameError('BAD_CHAT_MEDIA', 'Choose a supported file', 400);
  const limit = declaredType.startsWith('image/') ? CHAT_MEDIA.imageMaxBytes : CHAT_MEDIA.videoMaxBytes;
  if (bytes.length > limit) throw new GameError('CHAT_MEDIA_TOO_LARGE', 'Choose a smaller file', 413);
  let detected;
  try { detected = await fileTypeFromBuffer(bytes.subarray(0, 8192)); } catch { detected = undefined; }
  if (!detected || !CHAT_MEDIA.mimeTypes.some(type => type === detected.mime) || detected.mime !== declaredType) {
    throw new GameError('BAD_CHAT_MEDIA', 'Choose a JPEG, PNG, WebP, GIF, MP4 or WebM file', 400);
  }
  await mkdir(directory, { recursive: true });
  const id = randomUUID();
  const kind = detected.mime.startsWith('image/') ? 'image' as const : 'video' as const;
  await writeFile(join(directory, id), bytes, { flag: 'wx', mode: 0o600 });
  try {
    await db.insert(chatMediaAssets).values({ id, ownerAccountId: accountId, kind, mimeType: detected.mime, byteSize: bytes.length, createdAt: now });
  } catch (error) { await unlink(join(directory, id)); throw error; }
  return { media: { kind, assetId: id, mimeType: detected.mime } };
}

/** Pending claims are row-locked against sending; claimed files never expire. */
export async function cleanupChatUploads(db: Db, directory: string, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - CHAT_MEDIA.uploadLifetimeMs);
  await db.transaction(async tx => {
    const expired = await tx.select({ id: chatMediaAssets.id }).from(chatMediaAssets)
      .where(and(isNull(chatMediaAssets.claimedAt), lt(chatMediaAssets.createdAt, cutoff))).limit(256).for('update');
    for (const asset of expired) {
      await unlink(join(directory, asset.id)).catch((error: unknown) => { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; });
    }
    if (expired.length > 0) await tx.delete(chatMediaAssets).where(inArray(chatMediaAssets.id, expired.map(asset => asset.id)));
  });
  // Retained files are resolved in bounded batches, without one database read per file.
  const files = await readdir(directory).catch(() => []);
  const idSchema = z.string().uuid();
  const candidates = files.filter(id => idSchema.safeParse(id).success);
  for (let offset = 0; offset < candidates.length; offset += 256) {
    const batch = candidates.slice(offset, offset + 256);
    const existing = await db.select({ id: chatMediaAssets.id }).from(chatMediaAssets).where(inArray(chatMediaAssets.id, batch));
    const retained = new Set(existing.map(asset => asset.id));
    for (const id of batch) {
      if (retained.has(id)) continue;
      const info = await stat(join(directory, id)).catch(() => null);
      if (!info || info.mtimeMs >= cutoff.getTime()) continue;
      await unlink(join(directory, id)).catch((error: unknown) => {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      });
    }
  }
}
