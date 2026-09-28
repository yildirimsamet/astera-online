import { sql } from 'drizzle-orm';
import { REACTION_EMOJIS, type ReactionEmoji } from '@astera/rules';
import type { Queryable } from '../db/client.js';

export type MessageChannel = 'general' | 'clan' | 'dm';
export interface ReplyPreview { id: string; username: string; content: string }
export interface ReactionView { emoji: ReactionEmoji; count: number; mine: boolean }
export interface MessageDecoration { replyTo: ReplyPreview | null; reactions: ReactionView[] }

const tableFor = (channel: MessageChannel): string => channel === 'general' ? 'chat_messages'
  : channel === 'clan' ? 'clan_messages' : 'dm_messages';
const reactionColumnFor = (channel: MessageChannel): string => channel === 'general' ? 'chat_message_id'
  : channel === 'clan' ? 'clan_message_id' : 'dm_message_id';

interface ReplyRow extends Record<string, unknown> { id: string; username: string; content: string }
interface ReactionRow extends Record<string, unknown> {
  messageId: string; emoji: ReactionEmoji; count: number; mine: boolean;
}

export async function replyPreviews(
  db: Queryable, channel: MessageChannel, ids: readonly string[], earliest?: Date,
): Promise<Map<string, ReplyPreview>> {
  if (ids.length === 0) return new Map();
  // Both identifiers come from a closed server-side choice, never request text.
  const table = sql.raw(tableFor(channel));
  const values = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const rows = await db.execute<ReplyRow>(sql`
    SELECT m.id, a.display_name AS username, m.content
      FROM ${table} m
      JOIN players p ON p.id = m.author_player_id
      JOIN accounts a ON a.id = p.account_id
     WHERE m.id IN (${values})
       ${earliest ? sql`AND m.created_at >= ${earliest.toISOString()}::timestamptz` : sql``}
  `);
  return new Map(rows.map(({ id, username, content }) => [id, { id, username, content }]));
}

export async function reactionViews(
  db: Queryable, channel: MessageChannel, ids: readonly string[], playerId: string,
): Promise<Map<string, ReactionView[]>> {
  if (ids.length === 0) return new Map();
  const column = sql.raw(reactionColumnFor(channel));
  const values = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const rows = await db.execute<ReactionRow>(sql`
    SELECT ${column} AS "messageId", emoji, count(*)::int AS count,
           bool_or(player_id = ${playerId}::uuid) AS mine
      FROM message_reactions
     WHERE ${column} IN (${values})
     GROUP BY ${column}, emoji
  `);
  const byMessage = new Map<string, ReactionView[]>();
  for (const row of rows) {
    const group = byMessage.get(row.messageId) ?? [];
    group.push({ emoji: row.emoji, count: row.count, mine: row.mine });
    byMessage.set(row.messageId, group);
  }
  for (const group of byMessage.values()) {
    group.sort((a, b) => REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji));
  }
  return byMessage;
}

export async function messageDecorations(
  db: Queryable,
  channel: MessageChannel,
  rows: readonly { id: string; replyToMessageId: string | null }[],
  playerId: string,
  earliest?: Date,
): Promise<Map<string, MessageDecoration>> {
  const [previews, reactions] = await Promise.all([
    replyPreviews(db, channel, rows.flatMap((row) => row.replyToMessageId ? [row.replyToMessageId] : []), earliest),
    reactionViews(db, channel, rows.map((row) => row.id), playerId),
  ]);
  return new Map(rows.map((row) => [row.id, {
    replyTo: row.replyToMessageId ? previews.get(row.replyToMessageId) ?? null : null,
    reactions: reactions.get(row.id) ?? [],
  }]));
}
