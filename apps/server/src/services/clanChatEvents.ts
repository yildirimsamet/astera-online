import { desc, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db/client.js';
import { clanMessages, type ClanChatEvent } from '../db/schema.js';
import { publishPrivate } from '../stream/bus.js';
import { activeClanPlayerIds } from './clanCombat.js';

/**
 * F2 E2 — THE CLAN CHAT CARRIES THE FIGHT (owner 2026-11-10). An alarm, a wave sent, a supported
 * defence's result and a rung bought are posted to the clan's room as a kind and its facts, under
 * the commander they are about; the reader's client words them in the reader's language. A posted
 * line never spends its author's typing allowance (`postClanChat` counts typed lines only).
 */
export async function postClanEvent(tx: Tx, input: {
  clanId: string;
  seasonId: string;
  authorPlayerId: string;
  event: ClanChatEvent;
  now: Date;
}): Promise<void> {
  // The room's order is its createdAt; the same lock as a typed line keeps it strictly rising.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-chat:${input.clanId}`}))`);
  const [latest] = await tx.select({ createdAt: clanMessages.createdAt })
    .from(clanMessages).where(eq(clanMessages.clanId, input.clanId))
    .orderBy(desc(clanMessages.createdAt), desc(clanMessages.id)).limit(1);
  const createdAt = latest && latest.createdAt >= input.now
    ? new Date(latest.createdAt.getTime() + 1)
    : input.now;
  await tx.insert(clanMessages).values({
    seasonId: input.seasonId,
    clanId: input.clanId,
    authorPlayerId: input.authorPlayerId,
    content: '',
    event: input.event,
    createdAt,
  });
  for (const playerId of await activeClanPlayerIds(tx, input.clanId)) {
    await publishPrivate(tx, playerId, 'chat');
  }
}
