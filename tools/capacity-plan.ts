import { SERVERS } from '../packages/rules/src/index.js';
import {
  HEAVY_KINDS, isGlobalEvent, isPrivateEvent, isShardEvent,
  readsForGlobalEvent, readsForPlayerEvent, readsForPrivateEvent, readsForShardEvent,
} from '../apps/web/src/session/shardEvents.js';

/**
 * What a capacity run expects and decides, apart from the runner that drives the
 * sockets, so each rule has a test. Scaling plan F0.1.
 */

interface Servers { count: number; capacity: number }

/** Players each galaxy holds after `seeded` accounts are placed in order, a galaxy's capacity at a time. */
export const seatPlan = (seeded: number, servers: Servers = SERVERS): number[] =>
  Array.from({ length: servers.count }, (_, index) =>
    Math.max(0, Math.min(servers.capacity, seeded - index * servers.capacity)));

/** The galaxy the seed placed account `index` in. */
export const galaxyOf = (index: number, servers: Servers = SERVERS): number => Math.floor(index / servers.capacity);

/** Every seat may be online; the server closes an account's oldest stream beyond three (F1.1). */
export const RUNNER_LIMITS = { maxUsers: SERVERS.capacity * SERVERS.count, streamsPerAccount: 3 } as const;

/** The soonest instant still ahead: the one timer the web's `useArrivals` arms. */
export const soonestArrival = (threads: readonly { arriveAt: string | Date }[], now: number): number | null => {
  const ahead = threads.map(thread => new Date(thread.arriveAt).getTime()).filter(at => Number.isFinite(at) && at > now);
  return ahead.length === 0 ? null : Math.min(...ahead);
};

interface Quantiles { p99: number }
interface KindLoad { events: number; busyMs: number; durationMs: { p95: number } }

/**
 * Busy most of a peak window is a load the handlers cannot be trimmed out of: halving
 * every handler buys 2× headroom at best, and F7's lanes are the plan's answer to it.
 */
const LANES_AT = 0.85;
/** Busier than this, a burst already queues; the run asks for a fix before the threshold is hit. */
const WARN_AT = 0.7;

export type WorkerFix = 'OK' | 'POLL' | 'F1.7' | 'F7';

/**
 * WHICH FIX THE ONE WORKER NEEDS, from what the run measured.
 *
 * `frames` are the worker's busy-time counter, read in order; the busiest interval is
 * the peak load. Late waking is the poll's to fix, waiting in line the handlers'.
 */
export function workerVerdict(input: {
  frames: readonly { atMs: number; busyMs: number }[];
  lateness: Quantiles; wake: Quantiles; queue: Quantiles;
  kinds: Readonly<Record<string, KindLoad>>;
  thresholdMs: number;
}) {
  const loads: number[] = [];
  let busy = 0;
  let span = 0;
  for (let index = 1; index < input.frames.length; index += 1) {
    const [before, after] = [input.frames[index - 1]!, input.frames[index]!];
    const elapsed = after.atMs - before.atMs;
    const worked = after.busyMs - before.busyMs;
    // A restart resets the counter; that interval says nothing about load.
    if (elapsed <= 0 || worked < 0) continue;
    loads.push(worked / elapsed);
    busy += worked;
    span += elapsed;
  }
  const peakUtilization = loads.length === 0 ? 0 : Math.max(...loads);
  const meanUtilization = span === 0 ? 0 : busy / span;
  const total = Object.values(input.kinds).reduce((sum, kind) => sum + kind.busyMs, 0);
  const heaviestKinds = Object.entries(input.kinds)
    .map(([kind, load]) => ({ kind, events: load.events, busyShare: total === 0 ? 0 : load.busyMs / total,
      meanMs: load.events === 0 ? 0 : load.busyMs / load.events, p95Ms: load.durationMs.p95 }))
    .sort((a, b) => b.busyShare - a.busyShare);
  const late = input.lateness.p99 > input.thresholdMs;
  const wakeBound = input.wake.p99 >= input.queue.p99;
  const verdict: WorkerFix = peakUtilization >= LANES_AT ? 'F7'
    : late || peakUtilization >= WARN_AT ? (wakeBound ? 'POLL' : 'F1.7')
      : 'OK';
  return {
    verdict, peakUtilization, meanUtilization, thresholdMs: input.thresholdMs,
    latenessP99Ms: input.lateness.p99, wakeP99Ms: input.wake.p99, queueP99Ms: input.queue.p99,
    heaviestKinds,
  };
}

/** The screens a run keeps open, by the web's query key: what a resync re-reads. */
const OPEN_READS: readonly (readonly [readonly string[], string])[] = [
  [['planet'], '/api/planet'], [['planets'], '/api/planets'], [['galaxy'], '/api/galaxy'], [['intel'], '/api/intel'],
  [['notifications'], '/api/notifications?limit=30'], [['pending'], '/api/session/pending'], [['reports'], '/api/reports'],
  [['traffic'], '/api/galaxy/traffic'], [['mining', 'field'], '/api/mining/field'], [['mining', 'status'], '/api/mining/status'],
  [['rewards'], '/api/rewards'], [['chat', 'messages'], '/api/chat/messages'], [['chat', 'unread'], '/api/chat/unread'],
  [['chronicle'], '/api/chronicle'],
];
/** Open too, though a resync does not name them: shard events do. */
const SHARD_ONLY_READS: readonly (readonly [readonly string[], string])[] = [
  [['leaderboard'], '/api/leaderboard'], [['season'], '/api/season'],
];
export const FULL_READS: readonly string[] = OPEN_READS.map(([, path]) => path);

/**
 * WHAT A STREAM EVENT MAKES A SESSION READ: the web's own tables (`shardEvents.ts`),
 * in its dispatch order, limited to the screens a run keeps open. A key refreshes every
 * open query it prefixes, as `invalidateQueries` does. Scaling plan F0.1.
 */
export function eventReads(kind: string): { paths: readonly string[]; heavy: boolean } {
  if (kind === 'superseded' || kind === 'placement_changed' || kind === 'shard:rollover') return { paths: [], heavy: false };
  const keys = isGlobalEvent(kind) ? readsForGlobalEvent(kind)
    : isShardEvent(kind) ? readsForShardEvent(kind)
      : (isPrivateEvent(kind) ? readsForPrivateEvent(kind) : null) ?? readsForPlayerEvent(kind);
  if (keys === null) return { paths: FULL_READS, heavy: false };
  const open = [...OPEN_READS, ...SHARD_ONLY_READS];
  const paths = keys.flatMap(key => open.filter(([query]) => key.every((part, index) => query[index] === part))
    .map(([, path]) => path));
  return { paths: [...new Set(paths)], heavy: HEAVY_KINDS.has(kind) };
}
