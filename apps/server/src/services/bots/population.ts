import { GALAXY_EVENTS, MULTI_WORLD } from '@astera/rules';

/** Initial balance hypothesis. The operator cap and the authored address pool still win. */
const BOT_SHARE = 0.25;
const ACTIVE_SHARE = 0.25;
export const BOT_SEAT_BATCH = 4;
export const BOT_SEAT_INTERVAL_MS = 30 * 60_000;
export const BOT_ACTIVITY_BUCKET_MS = 5 * 60_000;
export const BOT_SESSION_MIN_MS = 60 * 60_000;
export const BOT_SESSION_MAX_MS = 180 * 60_000;
export const BOT_SESSION_REST_MS = 30 * 60_000;
const SESSION_EXTENSION_MS = 10 * 60_000;

const nonNegativeInteger = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function botSeatTarget(people: number, operatorCap: number): number {
  const n = nonNegativeInteger(people);
  const cap = Math.min(MULTI_WORLD.botSlots, nonNegativeInteger(operatorCap));
  if (n === 0 || cap === 0) return 0;
  return Math.min(cap, Math.max(2, Math.round(n * BOT_SHARE)));
}

export function botAwakeTarget(activePeople: number, seatedBots: number): number {
  const active = nonNegativeInteger(activePeople);
  const seated = nonNegativeInteger(seatedBots);
  if (active === 0 || seated === 0) return 0;
  return Math.min(seated, Math.ceil(seated / 2), Math.max(1, Math.round(active * ACTIVE_SHARE)));
}

export interface BotSessionCandidate {
  accountId: string;
  playerId: string;
  ordinal: number;
  sessionPlayerId: string | null;
  startedAt: Date | null;
  untilAt: Date | null;
}

export interface BotSessionPlan {
  /** Sessions that must be closed now. */
  stop: string[];
  /** New sessions; each runs for at least BOT_SESSION_MIN_MS. */
  start: BotSessionCandidate[];
  /** Existing sessions that should run beyond their current deadline. */
  extend: { accountId: string; untilAt: Date }[];
  /** The accounts allowed to take a turn immediately after applying this plan. */
  active: string[];
}

type ActiveBot = BotSessionCandidate & { startedAt: Date; untilAt: Date };

/** The calendar already pins Türkiye's offset for the game's public events. */
function localHour(at: Date): number {
  const minute = Math.floor((at.getTime() + GALAXY_EVENTS.calendar.utcOffsetMinutes * 60_000) / 60_000);
  return ((Math.floor(minute / 60) % 24) + 24) % 24;
}

export function botQuietAt(at: Date): boolean {
  const hour = localHour(at);
  return hour >= 1 && hour < 8;
}

/**
 * One deterministic decision from persisted sessions and a current demand snapshot.
 * Calling it again with the committed rows is a no-op; no in-memory worker state
 * decides whether a bot is at the controls.
 */
export function planBotSessions(
  candidates: readonly BotSessionCandidate[],
  targetInput: number,
  now: Date,
): BotSessionPlan {
  const target = nonNegativeInteger(targetInput);
  const nowMs = now.getTime();
  const plan: BotSessionPlan = { stop: [], start: [], extend: [], active: [] };
  const active = candidates.filter((bot): bot is ActiveBot =>
    bot.sessionPlayerId === bot.playerId
    && bot.startedAt !== null
    && bot.startedAt.getTime() <= nowMs
    && bot.untilAt !== null
    && bot.untilAt.getTime() > nowMs);

  if (botQuietAt(now)) {
    plan.stop = active.map((bot) => bot.accountId);
    return plan;
  }

  const kept = active.filter((bot) => {
    if (nowMs - bot.startedAt.getTime() < BOT_SESSION_MAX_MS) return true;
    plan.stop.push(bot.accountId);
    return false;
  });

  // Preserve every session's first hour even if the online count drops to zero.
  const stoppable = kept
    .filter((bot) => nowMs - bot.startedAt.getTime() >= BOT_SESSION_MIN_MS)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.ordinal - b.ordinal);
  let remaining = kept.length;
  // A population dip should not end every mature session on the same check.
  // Maximum-duration and blackout exits above are hard limits, so only demand
  // reductions use this per-check throttle.
  const bucketStart = Math.floor(nowMs / BOT_ACTIVITY_BUCKET_MS) * BOT_ACTIVITY_BUCKET_MS;
  const recentlyStopped = candidates.filter((bot) =>
    bot.sessionPlayerId === bot.playerId
    && bot.startedAt !== null
    && bot.untilAt !== null
    && bot.untilAt.getTime() >= bucketStart
    && bot.untilAt.getTime() <= nowMs
    && bot.startedAt.getTime() < bot.untilAt.getTime()).length;
  const stopBudget = Math.max(0, Math.ceil((kept.length + recentlyStopped) * 0.25) - recentlyStopped);
  let demandStops = 0;
  while (remaining > target && stoppable.length > 0 && demandStops < stopBudget) {
    const bot = stoppable.shift();
    if (!bot) break;
    plan.stop.push(bot.accountId);
    remaining -= 1;
    demandStops += 1;
  }
  const stopped = new Set(plan.stop);
  const retained = kept.filter((bot) => !stopped.has(bot.accountId));

  for (const bot of retained) {
    const limit = bot.startedAt.getTime() + BOT_SESSION_MAX_MS;
    const until = Math.min(limit, Math.max(bot.untilAt.getTime(), nowMs + SESSION_EXTENSION_MS));
    if (until > bot.untilAt.getTime()) {
      plan.extend.push({ accountId: bot.accountId, untilAt: new Date(until) });
    }
    plan.active.push(bot.accountId);
  }

  // A new session cannot obtain its guaranteed hour before the 01:00 blackout.
  if (localHour(now) === 0) return plan;
  const room = Math.max(0, target - retained.length);
  const activeIds = new Set(active.map((bot) => bot.accountId));
  const eligible = candidates
    .filter((bot) => !activeIds.has(bot.accountId))
    .filter((bot) => {
      if (bot.sessionPlayerId !== bot.playerId || bot.untilAt === null) return true;
      return nowMs - bot.untilAt.getTime() >= BOT_SESSION_REST_MS;
    })
    .sort((a, b) =>
      (a.untilAt?.getTime() ?? Number.NEGATIVE_INFINITY)
        - (b.untilAt?.getTime() ?? Number.NEGATIVE_INFINITY)
      || a.ordinal - b.ordinal);
  plan.start = eligible.slice(0, room);
  plan.active.push(...plan.start.map((bot) => bot.accountId));
  return plan;
}
