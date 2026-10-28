import { and, eq } from 'drizzle-orm';
import { GALAXY_EVENTS, hashSeed, mulberry32 } from '@astera/rules';
import type { Queryable } from '../../db/client.js';
import { botProfiles, players } from '../../db/schema.js';
import { planBotSessions, type BotSessionCandidate, type BotSessionPlan } from './population.js';

/** A role, independent of public identity. Retired identities retain their place in this selection. */
export const guardIds = (rows: readonly { playerId: string; persona: string; ordinal: number }[]): Set<string> =>
  new Set(rows.filter(row => row.persona === 'RAIDER').toSorted((a, b) => a.ordinal - b.ordinal)
    .slice(0, 2).map(row => row.playerId));

export async function guardPlayerIds(db: Queryable, seasonId: string): Promise<Set<string>> {
  return guardIds(await db.select({ playerId: players.id, persona: botProfiles.persona, ordinal: botProfiles.ordinal })
    .from(players).innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .where(and(eq(players.seasonId, seasonId), eq(botProfiles.persona, 'RAIDER'))));
}

/** Three paid development sessions; jitter is stable across restarts, distinct per identity and day. */
export function guardWindow(playerId: string, now: Date): { startsAt: Date; untilAt: Date } | null {
  const offset = GALAXY_EVENTS.calendar.utcOffsetMinutes * 60_000;
  const day = Math.floor((now.getTime() + offset) / 86_400_000);
  const startOfDay = day * 86_400_000 - offset;
  for (const hour of [8, 14, 21]) {
    const jitter = Math.floor(mulberry32(hashSeed('astera:guard-session', playerId, day, hour))() * 45);
    const startsAt = new Date(startOfDay + (hour * 60 + jitter) * 60_000);
    const untilAt = new Date(startsAt.getTime() + 60 * 60_000);
    if (startsAt <= now && now < untilAt) return { startsAt, untilAt };
  }
  return null;
}

export function planRosterSessions(
  candidates: readonly BotSessionCandidate[], target: number, now: Date, guards: ReadonlySet<string>,
): BotSessionPlan {
  const plans = candidates.filter(bot => guards.has(bot.playerId)).map(bot =>
    planBotSessions([bot], guardWindow(bot.playerId, now) ? 1 : 0, now));
  const driven = plans.reduce((sum, plan) => sum + plan.active.length, 0);
  plans.push(planBotSessions(candidates.filter(bot => !guards.has(bot.playerId)), Math.max(0, target - driven), now));
  return { stop: plans.flatMap(plan => plan.stop), start: plans.flatMap(plan => plan.start),
    extend: plans.flatMap(plan => plan.extend), active: plans.flatMap(plan => plan.active) };
}
