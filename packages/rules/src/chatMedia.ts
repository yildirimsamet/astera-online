/** One optional attachment per message; uploads are resolved from server-owned assets. */
export type ChatMedia =
  | { kind: 'image' | 'video'; assetId: string; mimeType: string }
  | { kind: 'youtube'; videoId: string };

export const CHAT_MEDIA = {
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  uploadLifetimeMs: 24 * 60 * 60 * 1000,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
} as const;
