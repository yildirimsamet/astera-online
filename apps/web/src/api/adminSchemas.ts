import { z } from 'zod';
import { accountDeletionRequestSchema } from './schemas.js';
import type { CHAT_LANGUAGES } from '@astera/rules';

export const MODERATED_CHANNELS = ['general', 'clan', 'dm'] as const;
export type ModeratedChannel = typeof MODERATED_CHANNELS[number];
export type MuteDuration = '5m' | '15m' | '1h' | '4h' | '1d' | 'permanent' | 'remove';
export interface AdminMuteInput { username: string; channels: ModeratedChannel[]; duration: MuteDuration }
export type AdminMaskInput = { username: string; count: number } & (
  { channel: 'general'; seasonId: string; language: typeof CHAT_LANGUAGES[number] }
  | { channel: 'clan'; clanId: string }
);

const resources = z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() });
export const adminPlayersSchema = z.object({
  // An older API can still serve its list during rollout; its unknown total stays omitted.
  total: z.number().int().nonnegative().optional(),
  measuredAt: z.coerce.date(), onlineWindowMinutes: z.number(), nextBefore: z.string().nullable(),
  players: z.array(z.object({
    playerId: z.string(), username: z.string(), displayName: z.string(), seasonId: z.string(),
    galaxy: z.string(), galaxyCode: z.string(), lastActiveAt: z.coerce.date(),
    resources: z.object({ storage: resources, buffer: resources }),
    activity: z.object({ asteroidDispatches: z.number().int(), minersSent: z.number(), pirateDispatches: z.number().int(), pirateShipsSent: z.number() }),
    mutes: z.array(z.object({ channel: z.enum(MODERATED_CHANNELS), expiresAt: z.coerce.date().nullable() })),
  })),
});
export const adminChatScopesSchema = z.object({
  galaxies: z.array(z.object({ seasonId: z.string(), name: z.string(), code: z.string() })),
  clans: z.array(z.object({ id: z.string(), name: z.string(), tag: z.string(), seasonId: z.string(), galaxy: z.string(), galaxyCode: z.string() })),
});
export const adminMuteSchema = z.object({
  username: z.string(), channels: z.array(z.enum(MODERATED_CHANNELS)),
  duration: z.enum(['5m', '15m', '1h', '4h', '1d', 'permanent', 'remove']), expiresAt: z.coerce.date().nullable(),
});
export const adminMaskSchema = z.object({ masked: z.number().int().nonnegative() });

export const adminDeletionQueueSchema = z.object({
  requests: z.array(accountDeletionRequestSchema.extend({ accountId: z.string().uuid(), username: z.string(), displayName: z.string() })),
  mediaPending: z.array(z.object({ requestId: z.string().uuid(), files: z.number().int().positive() })),
});
export const adminDeletionCompletedSchema = z.object({ requestId: z.string().uuid(), status: z.literal('completed'), mediaCleanupPending: z.boolean().optional() });
export const adminDeletionMediaSchema = z.object({ requestId: z.string().uuid(), mediaCleanupPending: z.boolean() });
export const adminArenaPilotsSchema = z.object({
  pilots: z.array(z.object({ accountId: z.string(), username: z.string(), name: z.string(), grantedAt: z.coerce.date() })),
});
export const adminArenaPilotSchema = z.object({ accountId: z.string(), username: z.string(), pilot: z.boolean() });
