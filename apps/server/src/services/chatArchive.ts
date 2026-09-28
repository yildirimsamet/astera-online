import { eq, sql } from 'drizzle-orm';
import type { Tx } from '../db/client.js';
import {
  accounts,
  chatArchive,
  chatMessages,
  clanMessages,
  clans,
  players,
} from '../db/schema.js';

/**
 * COPY EVERY LIVE MESSAGE INTO `chat_archive` BEFORE A WIPE CLEARS IT. Owner instruction,
 * 2026-09-27: *"force wipe bile olsa chat saklanmalı silinmemeli."*
 *
 * Both channels, every season still in the world — the wipe clears the tables whole, so the copy
 * is whole too. Two `INSERT … SELECT`s rather than a read into memory: a season's chat is thousands
 * of rows and this runs inside the wipe's one transaction. The author is resolved through the
 * player to the permanent account and the name it wears now, the same name chat displays.
 * Idempotent on the live message id.
 */
export async function archiveSeasonChat(tx: Tx, now: Date): Promise<void> {
  await tx.insert(chatArchive).select(
    tx.select({
      id: chatMessages.id,
      seasonId: chatMessages.seasonId,
      channel: sql<'GALAXY'>`'GALAXY'`.as('channel'),
      language: chatMessages.language,
      clanId: sql<string | null>`null::uuid`.as('clan_id'),
      clanTag: sql<string | null>`null::text`.as('clan_tag'),
      clanName: sql<string | null>`null::text`.as('clan_name'),
      authorAccountId: accounts.id,
      authorName: accounts.displayName,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
      archivedAt: sql<Date>`${now.toISOString()}::timestamptz`.as('archived_at'),
    })
      .from(chatMessages)
      .innerJoin(players, eq(players.id, chatMessages.authorPlayerId))
      .innerJoin(accounts, eq(accounts.id, players.accountId)),
  ).onConflictDoNothing();

  await tx.insert(chatArchive).select(
    tx.select({
      id: clanMessages.id,
      seasonId: clanMessages.seasonId,
      channel: sql<'CLAN'>`'CLAN'`.as('channel'),
      language: sql<null>`null::text`.as('language'),
      clanId: clans.id,
      clanTag: clans.tag,
      clanName: clans.name,
      authorAccountId: accounts.id,
      authorName: accounts.displayName,
      content: clanMessages.content,
      createdAt: clanMessages.createdAt,
      archivedAt: sql<Date>`${now.toISOString()}::timestamptz`.as('archived_at'),
    })
      .from(clanMessages)
      .innerJoin(clans, eq(clans.id, clanMessages.clanId))
      .innerJoin(players, eq(players.id, clanMessages.authorPlayerId))
      .innerJoin(accounts, eq(accounts.id, players.accountId)),
  ).onConflictDoNothing();

  // A DM is private to its participants in the game, but the owner's retained
  // operator history must survive the same force wipe as both public channels.
  await tx.execute(sql`
    INSERT INTO dm_archive (
      id, season_id, sender_account_id, recipient_account_id,
      sender_name, recipient_name, content, created_at, archived_at
    )
    SELECT m.id, c.season_id, sender_account.id, recipient_account.id,
           sender_account.display_name, recipient_account.display_name,
           m.content, m.created_at, ${now.toISOString()}::timestamptz
      FROM dm_messages m
      JOIN dm_conversations c ON c.id = m.conversation_id
      JOIN players sender ON sender.id = m.author_player_id
      JOIN players recipient ON recipient.id = CASE
        WHEN c.player_low_id = sender.id THEN c.player_high_id ELSE c.player_low_id END
      JOIN accounts sender_account ON sender_account.id = sender.account_id
      JOIN accounts recipient_account ON recipient_account.id = recipient.account_id
    ON CONFLICT (id) DO NOTHING
  `);
}
