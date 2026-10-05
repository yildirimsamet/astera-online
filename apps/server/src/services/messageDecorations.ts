import { sql } from 'drizzle-orm';
import { REACTION_EMOJIS, type ReactionEmoji } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { supporterPlayers } from './supporters.js';

export type MessageChannel = 'general' | 'clan' | 'dm';
export interface ReplyPreview { id: string; username: string; content: string }
export interface ReactionView { emoji: ReactionEmoji; count: number; mine: boolean }
export type PodiumPlace = 1 | 2 | 3;
export interface AuthorRecognition { previousSeasonRank?: PodiumPlace; supporter?: boolean }
export interface MessageDecoration extends AuthorRecognition { replyTo: ReplyPreview | null; reactions: ReactionView[] }

/** Batch recognition once per page; also used by immediate send responses. */
export async function authorRecognition(db: Queryable, playerIds: readonly string[]): Promise<Map<string, AuthorRecognition>> {
  const ids = [...new Set(playerIds)];
  const [podium, supporters] = await Promise.all([previousSeasonPodium(db, ids), supporterPlayers(db, ids)]);
  return new Map(ids.map((id) => [id, {
    ...(podium.has(id) ? { previousSeasonRank: podium.get(id) } : {}),
    ...(supporters.has(id) ? { supporter: true } : {}),
  }]));
}

/** The frozen previous cycle, across wipes and galaxy transfers; never the live ladder. */
export async function previousSeasonPodium(
  db: Queryable, playerIds: readonly string[],
): Promise<Map<string, PodiumPlace>> {
  if (playerIds.length === 0) return new Map();
  const ids = sql.join([...new Set(playerIds)].map((id) => sql`${id}::uuid`), sql`, `);
  const rows = await db.execute<{ playerId: string; place: number }>(sql`
    SELECT p.id AS "playerId", r.final_rank AS place
      FROM players p
      JOIN seasons current_season ON current_season.id = p.season_id
      JOIN season_cycles current_cycle ON current_cycle.id = current_season.cycle_id
      JOIN season_cycles previous_cycle ON previous_cycle.ordinal = current_cycle.ordinal - 1
      JOIN season_results r ON r.cycle_id = previous_cycle.id AND r.account_id = p.account_id
      JOIN seasons previous_season ON previous_season.id = r.season_id AND previous_season.status IN ('frozen', 'wiped')
      JOIN shards previous_shard ON previous_shard.id = previous_season.shard_id
     WHERE p.id IN (${ids}) AND r.final_rank BETWEEN 1 AND 3
       AND (previous_shard.role = 'MAIN' OR EXISTS (
         SELECT 1 FROM season_reward_entitlements e
          WHERE e.source_season_id = r.season_id AND e.target_cycle_id = current_cycle.id
       ))
  `);
  const places = new Map<string, PodiumPlace>();
  for (const row of rows) {
    if (row.place === 1 || row.place === 2 || row.place === 3) places.set(row.playerId, row.place);
  }
  return places;
}

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
  rows: readonly { id: string; authorPlayerId: string; replyToMessageId: string | null }[],
  playerId: string,
  earliest?: Date,
): Promise<Map<string, MessageDecoration>> {
  const [previews, reactions, recognition] = await Promise.all([
    replyPreviews(db, channel, rows.flatMap((row) => row.replyToMessageId ? [row.replyToMessageId] : []), earliest),
    reactionViews(db, channel, rows.map((row) => row.id), playerId),
    authorRecognition(db, rows.map((row) => row.authorPlayerId)),
  ]);
  return new Map(rows.map((row) => [row.id, {
    replyTo: row.replyToMessageId ? previews.get(row.replyToMessageId) ?? null : null,
    reactions: reactions.get(row.id) ?? [],
    ...recognition.get(row.authorPlayerId),
  }]));
}
