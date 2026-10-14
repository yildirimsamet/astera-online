import { z } from 'zod';

const mutedPlayerSchema = z.object({ playerId: z.string().min(1), username: z.string().min(1) });
const mutedPlayersSchema = z.array(mutedPlayerSchema);
export type MutedChatPlayer = z.infer<typeof mutedPlayerSchema>;
export interface ChatMuteAuthor {
  authorPlayerId: string;
  username: string;
  self: boolean;
  admin?: boolean;
}

export const chatMuteStorageKey = (accountId: string): string => `astera.chat.mutes.v1:${accountId}`;

/** Personal visibility preferences never change messages or the separate DM block. */
export function readChatMutes(accountId: string | undefined): MutedChatPlayer[] {
  if (!accountId) return [];
  try {
    const stored = localStorage.getItem(chatMuteStorageKey(accountId));
    if (!stored) return [];
    const result = mutedPlayersSchema.safeParse(JSON.parse(stored));
    return result.success ? [...new Map(result.data.map(player => [player.playerId, player])).values()] : [];
  } catch { return []; }
}

export function writeChatMutes(accountId: string | undefined, players: readonly MutedChatPlayer[]): void {
  if (!accountId) return;
  try {
    if (players.length === 0) localStorage.removeItem(chatMuteStorageKey(accountId));
    else localStorage.setItem(chatMuteStorageKey(accountId), JSON.stringify(players));
  } catch { /* A full or denied preference store must not break this session's filter. */ }
}

export function addChatMute(players: readonly MutedChatPlayer[], author: ChatMuteAuthor): MutedChatPlayer[] {
  if (author.self || author.admin === true) return [...players];
  return [...players.filter(player => player.playerId !== author.authorPlayerId), { playerId: author.authorPlayerId, username: author.username }];
}

export function isChatMessageVisible(author: Pick<ChatMuteAuthor, 'authorPlayerId' | 'self' | 'admin'>, mutedIds: ReadonlySet<string>): boolean {
  return author.self || author.admin === true || !mutedIds.has(author.authorPlayerId);
}
