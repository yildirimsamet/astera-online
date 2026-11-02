/** Pure reporting definitions shared with the server; no clock, identity, storage or I/O. */
export interface ActivityInterval { start: number; end: number }
export const ANALYTICS_SESSION_GAP_MS = 30 * 60_000;
export function shouldStartSession(previous: number | null, now: number): boolean {
  return previous === null || now < previous || now - previous >= ANALYTICS_SESSION_GAP_MS;
}
export function mergeIntervals(intervals: readonly ActivityInterval[]): ActivityInterval[] {
  const result: ActivityInterval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.end < interval.start) {
      throw new Error('Invalid activity interval');
    }
    const previous = result.at(-1);
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}
export const summarizeActivity = (intervals: readonly ActivityInterval[]): number =>
  mergeIntervals(intervals).reduce((sum, interval) => sum + interval.end - interval.start, 0);
export function retentionWindow(firstReady: number, day: 1 | 3 | 7, now: number, returns: readonly number[]) {
  const start = firstReady + day * 86_400_000, end = start + 86_400_000;
  if (now < end) return { mature: false, returned: null };
  return { mature: true, returned: returns.some(at => at >= start && at < end) };
}
