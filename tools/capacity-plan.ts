import { SERVERS, TRAFFIC } from '../packages/rules/src/index.js';
import { EVENT_REFRESH_GAP_MS } from '../apps/web/src/api/eventRefresh.js';
import { NET_MS } from '../apps/web/src/api/liveChannel.js';
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

/** The commander the seed placed in seat `index`: the seat itself, whichever seat a runner starts from. */
export const capacityUsername = (index: number): string => `cap${String(index + 1).padStart(4, '0')}`;

/** A route's first answer is always checked, then every `every`th: a rare route must not go unchecked. */
export const checksAnswer = (requests: number, every: number): boolean => requests === 1 || requests % every === 0;

/** What the client sends to mine a rock; a rock with no id is no launch. */
export const miningLaunchBody = (rock: { id?: unknown } | undefined): { asteroidId: string; craft: number } | null =>
  typeof rock?.id === 'string' ? { asteroidId: rock.id, craft: 1 } : null;

interface WithId { id?: unknown }

/** A player's mining action: a rock if the disc holds one, otherwise a wreck, otherwise nothing to do. */
export function miningWrite(asteroids: readonly WithId[], debris: readonly WithId[], roll: number) {
  const pick = <Item>(items: readonly Item[]): Item | undefined => items[Math.floor(roll * items.length)];
  const body = miningLaunchBody(pick(asteroids));
  if (body !== null) return { path: '/api/mining/launch', body };
  const field = pick(debris)?.id;
  return typeof field === 'string' ? { path: '/api/mining/harvest', body: { fieldId: field, craft: 1 } } : null;
}

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

/**
 * The screens a client keeps open, by the web's query key: what a resync re-reads, as
 * `refreshQueries` skips a closed screen's query. Live logs show Chronicle, Leaderboard
 * and chat messages near zero (0.02 %, 0.1 %, 0.1 %): their screens are opened by hand,
 * and the workload's own table sends them at that rate.
 */
const OPEN_READS: readonly (readonly [readonly string[], string])[] = [
  [['planet'], '/api/planet'], [['planets'], '/api/planets'], [['galaxy'], '/api/galaxy'], [['intel'], '/api/intel'],
  [['notifications'], '/api/notifications?limit=30'], [['pending'], '/api/session/pending'], [['reports'], '/api/reports'],
  [['traffic'], '/api/galaxy/traffic'], [['mining', 'field'], '/api/mining/field'], [['mining', 'status'], '/api/mining/status'],
  [['rewards'], '/api/rewards'], [['chat', 'unread'], '/api/chat/unread'], [['dm', 'unread'], '/api/dm/unread'],
  [['pirates'], '/api/pirates'], [['galaxy-events'], '/api/galaxy/events'], [['unknown-signals'], '/api/unknown-signals'],
  [['monuments'], '/api/monuments'],
];
/** Open too, though a resync does not name them: shard events do. */
const SHARD_ONLY_READS: readonly (readonly [readonly string[], string])[] = [
  [['season'], '/api/season'],
];
/** `planetReads` answers a world from the list when both are asked for together. */
const oneWorldRead = (paths: readonly string[]): readonly string[] =>
  paths.includes('/api/planets') ? paths.filter(path => path !== '/api/planet') : paths;

export const FULL_READS: readonly string[] = oneWorldRead(OPEN_READS.map(([, path]) => path));

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
  // `useEventStream` reads traffic once for a shard event, after the consistency delay
  // (`followsWithTraffic`); its coalescer skips the key. Sending both doubled that read.
  const coalesced = isShardEvent(kind) ? keys.filter(key => key[0] !== 'traffic') : keys;
  const paths = coalesced.flatMap(key => open.filter(([query]) => key.every((part, index) => query[index] === part))
    .map(([, path]) => path));
  return { paths: oneWorldRead([...new Set(paths)]), heavy: HEAVY_KINDS.has(kind) };
}

const URGENT = 'private:strategic-sight';

/** What goes through the web's burst gate (`refreshForEvent`): what happened to this commander. */
export const isGatedEvent = (kind: string): boolean =>
  !isShardEvent(kind) && !isGlobalEvent(kind) && kind !== URGENT;

/** The second traffic read `useEventStream` schedules once a replica can have seen the commit. */
export const followsWithTraffic = (kind: string): boolean =>
  kind === URGENT || (isShardEvent(kind) && readsForShardEvent(kind).some(key => key[0] === 'traffic'));

/** `trafficPollMs`, per client: a run holds many in one process. */
export const trafficPeriodMs = (woken: boolean, calmMs: number): number => (woken ? calmMs : TRAFFIC.refreshMs);

/** `safetyNetMs`, per client. */
export const netPeriodMs = (live: boolean, calmMs: number): number => (live ? calmMs : NET_MS);

/** `refreshForEvent`, per client: first read at once, the rest of a burst share one after the gap. */
export function eventGate(read: (path: string) => void): (path: string) => void {
  const gates = new Map<string, { openAt: number; timer: ReturnType<typeof setTimeout> | null }>();
  return (path) => {
    const now = Date.now();
    const gate = gates.get(path);
    if (!gate || now >= gate.openAt) {
      gates.set(path, { openAt: now + EVENT_REFRESH_GAP_MS, timer: null });
      read(path);
      return;
    }
    if (gate.timer !== null) return;
    gate.timer = setTimeout(() => {
      gate.timer = null;
      gate.openAt = Date.now() + EVENT_REFRESH_GAP_MS;
      read(path);
    }, gate.openAt - now);
    // A read still waiting must not keep a finished run alive.
    gate.timer.unref();
  };
}

/**
 * What `useContactWindows` arms from a traffic answer: one timer chain, for the soonest
 * contact to end. The signature says whether the answer moved, as React's memo does: an
 * unmoved one lets the settling reads run on, a moved one replaces them. A run does not
 * solve sensor crossings, which the server's wake reaches within its own clock.
 */
export function contactWake(contacts: unknown, now: number): { at: number | null; signature: string } {
  const ends = (Array.isArray(contacts) ? contacts as readonly { endAt?: unknown }[] : [])
    .map(contact => (typeof contact.endAt === 'string' ? Date.parse(contact.endAt) : Number.NaN))
    .filter(Number.isFinite);
  const ahead = ends.filter(at => at > now);
  return { at: ahead.length === 0 ? null : Math.min(...ahead), signature: ends.sort((a, b) => a - b).join(',') };
}

interface ReadOutcome { valid: boolean; response: { status: number } | null; body: unknown }

/** The reads of a batch that failed, as `path status code`, so a run that stops says why. */
export function failedReads(paths: readonly string[], outcomes: readonly ReadOutcome[]): string {
  return outcomes.flatMap((outcome, index) => {
    if (outcome.valid) return [];
    const path = paths[index] ?? '?';
    if (outcome.response === null) return [`${path} no response`];
    const body = outcome.body;
    const code = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error : 'invalid payload';
    return [`${path} ${String(outcome.response.status)} ${code}`];
  }).join('; ');
}

const COLD_START_ATTEMPTS = 5;

/**
 * The opening reads of a commander, each asked again after a growing pause until it
 * answers or its attempts are spent. Only the failed ones go again, as a real client's.
 */
export async function coldStartReads<Outcome extends { valid: boolean }>(
  paths: readonly string[],
  read: (path: string) => Promise<Outcome>,
  pause: (ms: number) => Promise<void>,
  random: () => number = Math.random,
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  const ask = (path: string, index: number): Promise<void> => read(path).then((outcome) => { outcomes[index] = outcome; });
  await Promise.all(paths.map(ask));
  for (let attempt = 0; attempt < COLD_START_ATTEMPTS - 1 && outcomes.some((each) => !each.valid); attempt += 1) {
    await pause(random() * Math.min(30_000, 1000 * 2 ** attempt));
    await Promise.all(paths.map(async (path, index) => { if (!outcomes[index]?.valid) await ask(path, index); }));
  }
  return outcomes;
}

/**
 * WHAT A PLAYER DOES ARRIVES ON ITS OWN SCHEDULE, however slow the last answer was. A loop
 * that waits for one read before the next sends less as the server slows and so hides the
 * worst latencies (coordinated omission). A client's clock is different: a query does not
 * ask again while it is still asking, so those loops wait.
 */
export async function openArrivals(
  wait: () => number,
  act: () => Promise<unknown>,
  pause: (ms: number) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const running = new Set<Promise<void>>();
  const failures: unknown[] = [];
  for (;;) {
    await pause(wait());
    if (signal.aborted) break;
    const task: Promise<void> = act().then(() => undefined, (error: unknown) => { failures.push(error); })
      .finally(() => { running.delete(task); });
    running.add(task);
  }
  await Promise.all(running);
  if (failures.length > 0) throw failures[0];
}

export interface JoinFailure { label: string; error: string }

/**
 * THE RAMP SURVIVES ONE COMMANDER. A failed login is a measurement, not the end of the
 * run: one rejected join used to kill the process at connection 1,042 of 1,250 before any
 * report was written (2026-11-02), so nobody could say what the server had answered.
 */
export async function joinAll<Item>(
  items: readonly Item[],
  join: (item: Item, index: number) => Promise<void>,
  label: (item: Item) => string,
): Promise<{ joined: Item[]; failures: JoinFailure[] }> {
  const settled = await Promise.allSettled(items.map((item, index) => join(item, index)));
  const joined: Item[] = [];
  const failures: JoinFailure[] = [];
  settled.forEach((result, index) => {
    const item = items[index] as Item;
    if (result.status === 'fulfilled') joined.push(item);
    else failures.push({ label: label(item), error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
  });
  return { joined, failures };
}
