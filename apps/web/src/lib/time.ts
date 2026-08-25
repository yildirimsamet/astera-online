import { useEffect, useState } from 'react';
import i18n from '../i18n/index.js';
import { serverNow } from './clock.js';

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
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(serverNow());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

/**
 * "1h 04m" · "9m 40s" · "18s" · "now". Never negative.
 *
 * The unit letters are translated, not appended: Turkish counts in `1s 04d` and
 * `9d 40sn`, and a countdown that read `1sa 04dk` would be two characters wider
 * on the one strip that has no room to give. The shapes are chosen in
 * `units` per language for exactly that reason — see the note there.
 */
export function countdown(ms: number): string {
  if (ms <= 0) return i18n.t('units.now');
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return i18n.t('units.hoursMinutes', { h, m: String(m).padStart(2, '0') });
  if (m > 0) return i18n.t('units.minutesSeconds', { m, s: String(s).padStart(2, '0') });
  return i18n.t('units.seconds', { s });
}

/**
 * MINUTES LEFT, OFF THE INSTANT ITSELF — never off a figure the server rounded-chip.
 *
 * Every payload that carries a flight carries both: an exact `arriveAt` and a
 * `minutesRemaining` computed and rounded-chip when the request was answered. Reading
 * the second one is what put two disagreeing clocks on screen at once — the focus
 * rail sat on a whole-minute figure that was up to a poll stale while the pending
 * strip directly beneath it counted the same craft down in seconds. An absolute
 * timestamp needs no anchor and cannot go stale; the rounded-chip figure is display
 * data, and only the surface that is genuinely offline should ever read it.
 */
export const minutesLeft = (arriveAt: Date, now: number): number =>
  Math.max(0, (arriveAt.getTime() - now) / MINUTE);

/** How long a span lasts, when it is not counting down. "3h 06m" · "45m". */
export function duration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return i18n.t('units.daysHours', { d, h: h % 24 });
  }
  if (h > 0) return i18n.t('units.hoursMinutes', { h, m: String(m).padStart(2, '0') });
  return i18n.t('units.minutes', { m });
}

/**
 * The age of a reading. The single most important string on the intel screen:
 * "HOME · 18 min ago" is a different decision from "HOME · live".
 */
export function staleness(minutes: number): string {
  if (minutes < 1) return i18n.t('units.live');
  return i18n.t('units.ago', { duration: duration(minutes) });
}

export const minutesUntil = (at: Date, now: number): number => (at.getTime() - now) / MINUTE;
