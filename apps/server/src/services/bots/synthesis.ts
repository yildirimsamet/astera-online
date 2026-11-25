import { eq } from 'drizzle-orm';
import { CAPSULE_CATALOG, CAPSULE_IDS, capsulesForLaunch, type CapsuleId, type Fleet } from '@astera/rules';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import { playerCapsules, players } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { seasonHasSynthesis, startSynthesis } from '../synthesis.js';
import type { BotSynthesisHabit } from './personas.js';

/**
 * A LABORATORY TURN (plan 2026-11-24 step 7). Through `startSynthesis`, the service a person's tap reaches,
 * so every refusal (locked, busy, short of stock) is the same refusal. Returns whether a batch started.
 */
export async function tendBotSynthesis(
  db: Db, clock: Clock, playerId: string, habit: BotSynthesisHabit, rng: () => number,
): Promise<boolean> {
  if (rng() >= habit.brewChance) return false;
  const [seat] = await db.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId));
  if (!seat || !await seasonHasSynthesis(db, seat.seasonId)) return false;
  try {
    await db.transaction((tx) => startSynthesis(tx, playerId, habit.prefer, habit.batch, clock));
    return true;
  } catch (error) {
    if (error instanceof GameError) return false;
    throw error;
  }
}

/** The capsules this raid wears: those the commander's own stock fully covers for this wing, on a roll. */
export async function raidCapsules(
  db: Db, playerId: string, wing: Fleet, habit: BotSynthesisHabit, rng: () => number,
): Promise<CapsuleId[]> {
  if (rng() >= habit.useChance) return [];
  const held = new Map((await db.select({ id: playerCapsules.capsuleId, n: playerCapsules.quantity }).from(playerCapsules)
    .where(eq(playerCapsules.playerId, playerId))).map((row) => [row.id, row.n]));
  const allowed = CAPSULE_IDS.filter((id) => CAPSULE_CATALOG[id].allowedMissions.includes('attack'));
  return capsulesForLaunch(allowed, wing).filter((need) => need.count > 0 && (held.get(need.id) ?? 0) >= need.count).map((need) => need.id);
}
