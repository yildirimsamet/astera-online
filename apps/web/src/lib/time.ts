import { useEffect, useState } from 'react';
import i18n from '../i18n/index.js';
import { serverNow } from './clock.js';

/**
 * Time is the game's other currency, so it gets its own vocabulary.
 *
 * Everything here reads in the tense the player is in: what is coming reads as a
 * countdown, what has passed reads as an age.
 *
 * ONE EXCEPTION, ADDED WITH THE RESEARCH SCREEN. T12. This file used to say that
 * absolute timestamps appear nowhere, because "14:32" answers a question nobody in
 * this game is asking — and for a fleet in the air that is still exactly right: an
 * arrival is watched, and what you need is how long you have. A research project
 * is the opposite kind of wait. It runs for hours, nobody sits with it, and the
 * question it is actually answering is "will it be done before I next open this".
 * A countdown makes the player do that arithmetic against their own day; a clock
 * time hands them the answer. See `clockTime`, and nothing else here has changed.
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

/**
 * How long a span lasts, when it is not counting down. "3h 06m" · "45m" · "29s".
 *
 * IT LEARNED SECONDS AT D121, BECAUSE SOMETHING GOT SHORTER THAN A MINUTE.
 *
 * `Math.round` was the whole of it, and every span in the game was over a minute
 * long, so nothing ever hit the case. A probe with no launch overhead crosses to
 * a neighbour in 29 seconds — and the sentence a player reads at the moment they
 * commit to it read "Probe away · reports back in 0m", which is the interface
 * telling somebody their craft takes no time to fly. Under a minute it says the
 * seconds; at a minute and over nothing changes, so no other surface moves.
 *
 * `countdown` above has always done this and its shapes are the ones borrowed
 * here, so a probe's ETA and a probe's countdown speak the same language.
 */
export function duration(minutes: number): string {
  if (minutes > 0 && minutes < 1) {
    return i18n.t('units.seconds', { s: Math.max(1, Math.round(minutes * 60)) });
  }
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
 * HOW LONG UNTIL SOMETHING OPENS — AND IT NEVER READS ZERO.
 *
 * Owner report: *"Araştırmalarda ve bazı butonların üstünde '0d sonra
 * araştırılabilir', '0d sonra açılır' gibi kötü UX writingler var. 0D diye bir şey
 * olamaz."*
 *
 * Turkish abbreviates minutes as `d` for dakika, so a spent countdown rendered as
 * "0d" — which reads as zero DAYS, and is a nonsense sentence in either language:
 * a thing that opens in no time at all is a thing that is open.
 *
 * IT IS A SEPARATE FUNCTION FROM `duration`, and that separation is the fix rather
 * than an implementation detail. `duration` measures a SPAN, where zero is a true
 * answer somebody may legitimately want to print — a flight that took no time, a
 * record with no age — and `i18n.test.ts` pins that on purpose. Counting DOWN is
 * the other question: a clock that has run out has not measured zero, it has
 * arrived, and a view whose cache is a few seconds behind the server should say so
 * rather than announce a wait of none.
 */
export function untilReady(minutes: number): string {
  return minutes <= 0 ? i18n.t('units.imminent') : duration(minutes);
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

/**
 * THE MINUTE A TIMESTAMP FALLS IN — a dependency for work that is priced in minutes.
 *
 * `useNow()` ticks every second or five, and a `useMemo` that lists its value can
 * never hit. That is free for arithmetic and expensive for a SOLVE: the merchant's
 * "soonest reach" runs a scan and a bisection over a three-hour horizon, and it was
 * doing that twelve times a minute for the whole window, on the main thread, beside
 * the 3D scene — to produce a figure printed in whole minutes.
 *
 * Quantising the dependency keeps the answer exactly as accurate as the thing that
 * reads it and does the work once per minute instead. Use it wherever a memo's only
 * reason to depend on the clock is that its OUTPUT is a duration.
 */
export const minuteTick = (now: number): number => Math.floor(now / MINUTE);

/**
 * A WALL CLOCK, IN THE PLAYER'S OWN LOCALE AND THEIR OWN TIME ZONE. T12.
 *
 * The only absolute time in the game — see the note at the top of this file for
 * why research earns one and a fleet does not.
 *
 * `units.numberLocale` rather than `i18n.language`, for the same reason `format.ts`
 * uses it: the locale is a translated string, so a language can choose a
 * convention that is not its default. It also decides the 12/24-hour clock, which
 * is the difference between "9:40 PM" and "21:40" and is not something to hard-code
 * for a game played in two languages.
 */
export const clockTime = (at: Date): string =>
  at.toLocaleTimeString(i18n.t('units.numberLocale'), {
    hour: '2-digit',
    minute: '2-digit',
  });
