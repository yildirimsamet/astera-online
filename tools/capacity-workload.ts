/**
 * WHAT PLAYERS REALLY SEND. Owner, 2026-11-03: a run keeps the live proportions and
 * multiplies what a player does; a client clock cannot be multiplied, so it stays.
 *
 * Measured from nginx logs, 2026-11-01 00:00 to 2026-11-02 16:00 UTC (180,103 requests,
 * 3.824 streams online on average). A burst is ten or more requests from one address
 * with gaps of two seconds or less; 55 % of all requests arrive that way. Shares held
 * within a point or two across days, peak and quiet hours, and without the busiest
 * address. Only about thirty players stand behind it, so the rate of public events is
 * left to the real stream: event-driven reads come from the web's tables, not from here.
 */
export const MEASURED = { requests: 180_103, onlineSeconds: 144_000 * 3.824, writes: 7_300 } as const;

export interface Read { path: string; route: string }
export interface Counted<Item> { read: Item; count: number }

const SELF = '{self}';
const read = (path: string): Read => ({ path, route: `GET ${path.split('?')[0] ?? path}` });
const counted = (path: string, count: number): Counted<Read> => ({ read: read(path), count });
const PLANET_BY_ID: Read = { path: `/api/planets/${SELF}`, route: 'GET /api/planets/:id' };

/** Reads inside bursts. The tail left out is under 2 % and needs ids a run does not hold. */
export const BURST_READS: readonly Counted<Read>[] = [
  counted('/api/galaxy/traffic', 9_528), counted('/api/mining/field', 5_976), counted('/api/mining/status', 5_348),
  counted(`/api/pirates?originPlanetId=${SELF}`, 5_102), counted('/api/session/pending', 4_851),
  counted('/api/planets', 4_484), counted('/api/galaxy/events', 4_308), counted('/api/unknown-signals', 4_251),
  counted('/api/notifications?limit=30', 4_213), counted('/api/intel', 4_199), counted('/api/galaxy', 4_135),
  counted('/api/reports', 3_713), counted('/api/rewards', 3_624), counted('/api/chat/unread?language=en', 3_543),
  counted('/api/monuments', 3_444), counted('/api/dm/unread', 3_442), counted('/api/clan/badge', 3_391),
  { read: PLANET_BY_ID, count: 3_278 }, counted('/api/skins', 2_675), counted('/api/season', 2_203),
  counted('/api/return-applications', 2_175), counted('/api/commander-ship', 1_510), counted('/api/planet', 1_211),
  counted('/api/legacy/me/reveals', 762), counted('/api/maintenance', 753), counted('/api/session/brand-recall', 736),
  counted('/api/session/return', 684), counted('/api/auth/me', 578), counted('/api/chat/messages?language=en', 147),
  counted('/api/dm/conversations', 132), counted('/api/clan/support', 109), counted('/api/community/policy', 105),
  counted('/api/announcements', 58), counted('/api/leaderboard', 55),
];

/**
 * Reads outside bursts for routes no client clock drives. Screen visits, mostly. The
 * rest of what the logs show outside bursts (field, galaxy, pirates) follows stream
 * events in a live galaxy, and this runner's stream produces those by itself.
 */
export const SINGLE_READS: readonly Counted<Read>[] = [
  { read: PLANET_BY_ID, count: 1_460 }, counted('/api/commander-ship', 1_068), counted('/api/servers', 1_019),
  counted('/api/return-applications', 1_016), counted('/api/legacy/me/reveals', 946), counted('/api/planets', 742),
  counted('/api/notifications?limit=30', 722), counted('/api/unknown-signals', 689), counted('/api/rewards', 395),
  counted('/api/clan/support', 270), counted('/api/chat/unread?language=en', 232), counted('/api/leaderboard', 140),
  counted('/api/announcements', 109), counted('/api/chat/messages?language=en', 95), counted('/api/reports', 93),
  counted('/api/clan/badge', 77), counted('/api/community/policy', 76), counted('/api/maintenance', 63),
  counted('/api/dm/unread', 53), counted('/api/session/return', 47), counted('/api/auth/me', 32),
  counted('/api/chronicle', 30),
];

/** Client clocks beside the runner's traffic (5 s) and safety-net (60 s) loops, on a screen that stays open. */
export const TIMER_READS: readonly { read: Read; periodMs: number }[] = [
  { read: read('/api/skins'), periodMs: 30_000 },
  { read: read('/api/season'), periodMs: 60_000 },
  { read: read('/api/intel'), periodMs: 60_000 },
  { read: read('/api/galaxy/events'), periodMs: 60_000 },
  { read: read('/api/monuments'), periodMs: 60_000 },
  { read: read(`/api/pirates?originPlanetId=${SELF}`), periodMs: 60_000 },
];
const TRAFFIC_PER_SECOND = 1 / 5;
const SAFETY_NET_PER_SECOND = 4 / 60;

export type WriteKind = 'collect' | 'refresh' | 'returnSeen' | 'notificationsSeen' | 'mining' | 'upgrade' | 'probe' | 'build' | 'fleet';

/** Writes a run can make on its own. The rest (chat read, reward claim…) need ids it does not hold. */
export const WRITES: readonly (Counted<WriteKind> & { kind: WriteKind })[] = ([
  ['collect', 1_778], ['refresh', 1_424], ['returnSeen', 1_091], ['notificationsSeen', 705],
  ['mining', 403], ['upgrade', 340], ['probe', 205], ['build', 186], ['fleet', 17],
] as const).map(([kind, count]) => ({ kind, read: kind, count }));

const sum = (table: readonly { count: number }[]): number => table.reduce((total, entry) => total + entry.count, 0);

/** Share of real writes the table names; its routes carry the whole write rate between them. */
export const WRITES_COVERED = sum(WRITES) / MEASURED.writes;

/** Measured burst sizes by quantile: p10 11, p25 13, p50 20, p75 36, p90 49, p99 92, largest 183. */
const BURST_SIZES: readonly (readonly [number, number])[] = [
  [0, 10], [0.1, 11], [0.25, 13], [0.5, 20], [0.75, 36], [0.9, 49], [0.99, 92], [1, 183],
];

export function burstSize(roll: number): number {
  const at = Math.min(1, Math.max(0, roll));
  for (let index = 1; index < BURST_SIZES.length; index += 1) {
    const [q0, size0] = BURST_SIZES[index - 1]!;
    const [q1, size1] = BURST_SIZES[index]!;
    if (at <= q1) return Math.round(size0 + (size1 - size0) * ((at - q0) / (q1 - q0)));
  }
  return 183;
}

const meanBurstSize = (): number => {
  let total = 0;
  for (let index = 1; index < BURST_SIZES.length; index += 1) {
    const [q0, size0] = BURST_SIZES[index - 1]!;
    const [q1, size1] = BURST_SIZES[index]!;
    total += ((size0 + size1) / 2) * (q1 - q0);
  }
  return total;
};

/** What one online commander sends each second at this multiplier, by layer. */
export function workloadRates(multiplier: number) {
  const per = (count: number): number => (count / MEASURED.onlineSeconds) * multiplier;
  const burstReads = per(sum(BURST_READS));
  const singles = per(sum(SINGLE_READS));
  const writes = per(MEASURED.writes);
  const timers = TRAFFIC_PER_SECOND + SAFETY_NET_PER_SECOND + TIMER_READS.reduce((total, timer) => total + 1000 / timer.periodMs, 0);
  return {
    burstReads, singles, writes, timers,
    burstsPerSecond: burstReads / meanBurstSize(),
    total: burstReads + singles + writes + timers,
  };
}

/** The entry a roll in [0, 1) lands on, by weight. */
export function pickWeighted<Entry extends { count: number }>(table: readonly Entry[], roll: number): Entry {
  let left = roll * sum(table);
  for (const entry of table) {
    left -= entry.count;
    if (left < 0) return entry;
  }
  return table[table.length - 1]!;
}

export const resolveRead = (entry: Read, planetId: string): Read =>
  ({ path: entry.path.replace(SELF, encodeURIComponent(planetId)), route: entry.route });
