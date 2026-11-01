import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { coreTier, type LegacyMetric } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { accounts, legacyAttackIntents, planets, players, scheduledEvents, seasons, shards } from '../db/schema.js';
import { recordLegacyFact } from './legacy.js';
import { peakCoreLevels } from './player.js';

/** Resolve ownership at the action, never from the world after it changes hands. */
export async function recordPlayerLegacyFact(tx: Tx, playerId: string, seasonId: string,
  metric: LegacyMetric, sourceKey: string, at: Date, amount = 1): Promise<void> {
  const [owner] = await tx.select({ accountId: players.accountId, endsAt: seasons.endsAt })
    .from(players).innerJoin(seasons, eq(seasons.id, seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(players.id, playerId), eq(shards.role, 'MAIN')));
  if (!owner) return;
  // Late delivery must not turn a cosmetic into a failure of a legitimate game event.
  const occurredAt = at > owner.endsAt ? owner.endsAt : at;
  await recordLegacyFact(tx, { accountId: owner.accountId, seasonId, metric, sourceKey, amount, at: occurredAt });
}

const attribution = z.object({ defenderPlayerId: z.string().uuid(), accountIds: z.array(z.string().uuid()).min(1).max(5) });

/** A zero-loyalty watch owns the cause. Repair/rebooking discards it with the old watch. */
export async function attributeLegacyColonyLoss(tx: Tx, planetId: string, attackerPlayerIds: readonly string[]): Promise<void> {
  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId));
  if (world?.kind !== 'COLONY' || world.loyalty > 0 || world.controllerPlayerId === null) return;
  const owners = await tx.select({ accountId: players.accountId, playerId: players.id }).from(players)
    .where(inArray(players.id, [...new Set(attackerPlayerIds)].filter(id => id !== world.controllerPlayerId)));
  if (owners.length === 0) return;
  const events = await tx.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, planetId),
    eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.status, 'pending')));
  for (const event of events) {
    await tx.update(scheduledEvents).set({ payload: { ...event.payload,
      legacyNeutralisation: { defenderPlayerId: world.controllerPlayerId, accountIds: owners.map(owner => owner.accountId) } } })
      .where(eq(scheduledEvents.id, event.id));
  }
}

export async function recordLegacyColonyLoss(tx: Tx, planetId: string, defenderPlayerId: string, eventId: string): Promise<void> {
  const [event] = await tx.select().from(scheduledEvents).where(and(eq(scheduledEvents.id, eventId), eq(scheduledEvents.kind, 'colony_secession')));
  const value = event?.payload?.legacyNeutralisation;
  if (value === undefined || event?.refId !== planetId) return;
  const proof = attribution.parse(value);
  if (proof.defenderPlayerId !== defenderPlayerId) return;
  // Deletion of a commander while a watch waited must not prevent the colony from seceding.
  const existing = await tx.select({ id: accounts.id }).from(accounts).where(inArray(accounts.id, proof.accountIds));
  for (const owner of existing) await recordLegacyFact(tx, { accountId: owner.id, seasonId: event.seasonId,
    metric: 'COLONIES_NEUTRALISED', sourceKey: `colony:${planetId}`, amount: 1, at: event.resolveAt });
}

export async function commitLegacyAttack(tx: Tx, input: {
  seasonId: string; sourceKey: string; attackers: readonly string[]; defenders: readonly string[]; at: Date;
}): Promise<void> {
  const ids = [...new Set([...input.attackers, ...input.defenders])];
  if (input.attackers.length === 0 || input.defenders.length === 0) return;
  const identities = await tx.select({ id: players.id, accountId: players.accountId }).from(players)
    .where(and(inArray(players.id, ids), eq(players.seasonId, input.seasonId)));
  const accountsByPlayer = new Map(identities.map(row => [row.id, row.accountId]));
  const peaks = await peakCoreLevels(tx, ids);
  const values: typeof legacyAttackIntents.$inferInsert[] = [];
  for (const attacker of new Set(input.attackers)) for (const defender of new Set(input.defenders)) {
    const accountId = accountsByPlayer.get(attacker), opponentAccountId = accountsByPlayer.get(defender);
    const attackerTier = coreTier(peaks.get(attacker) ?? 1), defenderTier = coreTier(peaks.get(defender) ?? 1);
    if (!accountId || !opponentAccountId || accountId === opponentAccountId || defenderTier <= attackerTier) continue;
    values.push({ accountId, opponentAccountId, seasonId: input.seasonId, sourceKey: input.sourceKey,
      attackerTier, defenderTier, committedAt: input.at });
  }
  if (values.length > 0) await tx.insert(legacyAttackIntents).values(values).onConflictDoNothing();
}

export async function settleLegacyAttack(tx: Tx, input: {
  seasonId: string; sourceKey: string; defenders: readonly string[]; at: Date;
}): Promise<void> {
  if (input.defenders.length === 0) return;
  const defenders = await tx.select({ accountId: players.accountId }).from(players).where(inArray(players.id, [...input.defenders]));
  if (defenders.length === 0) return;
  const settled = await tx.update(legacyAttackIntents).set({ settledAt: input.at }).where(and(
    eq(legacyAttackIntents.seasonId, input.seasonId), eq(legacyAttackIntents.sourceKey, input.sourceKey),
    inArray(legacyAttackIntents.opponentAccountId, defenders.map(row => row.accountId)), isNull(legacyAttackIntents.settledAt),
  )).returning();
  for (const row of settled) await recordLegacyFact(tx, { accountId: row.accountId, seasonId: input.seasonId,
    metric: 'HIGHER_TIER_ATTACKS', sourceKey: input.sourceKey, amount: 1, at: input.at });
}
