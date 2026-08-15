import { useEffect, useState } from 'react';

/**
 * Time is the game's other currency, so it gets its own vocabulary.
 *
 * Everything here reads in the tense the player is in: what is coming reads as a
 * countdown, what has passed reads as an age. Absolute timestamps appear nowhere
 * — "14:32" answers a question nobody in this game is asking.
 */

const MINUTE = 60_000;

/** A live clock, shared shape for every countdown. One interval per component. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

/** "1h 04m" · "9m 40s" · "18s" · "now". Never negative. */
export function countdown(ms: number): string {
  if (ms <= 0) return 'now';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h)}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${String(m)}m ${String(s).padStart(2, '0')}s`;
  return `${String(s)}s`;
}

/** How long a span lasts, when it is not counting down. "3h 06m" · "45m". */
export function duration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${String(d)}d ${String(h % 24)}h`;
  }
  if (h > 0) return `${String(h)}h ${String(m).padStart(2, '0')}m`;
  return `${String(m)}m`;
}

/**
 * The age of a reading. The single most important string on the intel screen:
 * "HOME · 18 min ago" is a different decision from "HOME · live".
 */
export function staleness(minutes: number): string {
  if (minutes < 1) return 'live';
  return `${duration(minutes)} ago`;
}

export const minutesUntil = (at: Date, now: number): number => (at.getTime() - now) / MINUTE;
