import {
  ASTEROID_DYNAMIC,
  ASTEROID_SHOWER_FRONT_LOAD, SPAWN_GATE,
  GALAXY_EVENTS,
  type GalaxyEventDays,
  type GalaxyEventKind,
} from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxyEvents } from '../api/queries.js';
import { Glyph, artIconSrc, type GlyphId } from '../game-ui/index.js';
import { serverNow } from '../lib/clock.js';
import { decimal } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { duration, useNow } from '../lib/time.js';
import { Sheet } from '../v2/kit/Sheet.js';

const twoDigits = (value: number): string => String(value).padStart(2, '0');
const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const DAY_MS = DAY_MINUTES * MINUTE_MS;

interface GuideWindow {
  kind: GalaxyEventKind;
  startsAtLocalMinute: number;
  endsAtLocalMinute: number;
  days?: GalaxyEventDays;
}

const runsOn = (days: GalaxyEventDays | undefined, localDay: number): boolean => {
  const weekday = new Date(localDay * DAY_MINUTES * MINUTE_MS).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  return days === undefined || (days === 'WEEKEND' ? weekend : !weekend);
};

const occurrence = (window: GuideWindow, localDay: number) => {
  const offset = GALAXY_EVENTS.calendar.utcOffsetMinutes;
  return {
    kind: window.kind,
    startsAt: new Date((localDay * DAY_MINUTES - offset + window.startsAtLocalMinute) * MINUTE_MS),
    endsAt: new Date((localDay * DAY_MINUTES - offset + window.endsAtLocalMinute) * MINUTE_MS),
  };
};

function nextOccurrence(window: GuideWindow, now: Date) {
  const unixMinute = now.getTime() / MINUTE_MS;
  const localDay = Math.floor((unixMinute + GALAXY_EVENTS.calendar.utcOffsetMinutes) / DAY_MINUTES);
  for (let day = localDay; day <= localDay + 7; day += 1) {
    if (!runsOn(window.days, day)) continue;
    const item = occurrence(window, day);
    if (item.endsAt.getTime() > now.getTime()) return { ...item, day };
  }
  return null;
}

/** The device's own zone: the guide prints every time on the player's clock (owner 2026-11-14). */
const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The zone as the player knows it on a clock: "GMT+9", "UTC−4". */
const zoneName = (timeZone: string, language: string, at: Date): string =>
  new Intl.DateTimeFormat(language, { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(at).find((part) => part.type === 'timeZoneName')?.value ?? timeZone;

/** A moment on a zone's wall clock: its calendar day (days since 1970-01-01) and minute of the day. */
function wallClock(date: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return {
    day: Date.UTC(part('year'), part('month') - 1, part('day')) / DAY_MS,
    minute: (part('hour') % 24) * 60 + part('minute'),
  };
}

const clock = (minute: number): string => `${twoDigits(Math.floor(minute / 60))}:${twoDigits(minute % 60)}`;

/** Where a window sits in a reading day: the small hours read last, as the night's tail. */
const readingKey = (minute: number): number =>
  minute < READING_DAY_STARTS_AT_LOCAL_MINUTE ? minute + DAY_MINUTES : minute;

/**
 * ONE WINDOW ON THE PLAYER'S OWN CLOCK. Owner instruction, 2026-11-14.
 *
 * The rules author every window in Türkiye minutes, on Türkiye's weekdays and weekend. A
 * player in Tokyo or New York used to read those and a second "local" line under each;
 * now the device's zone is the only clock printed. The window's next run is read off that
 * zone, so summer time is whatever the zone says on that day.
 *
 * The kind of day stays the galaxy's: a weekday shower at 20:00 in Türkiye starts at 02:00
 * the NEXT day in Tokyo. `shift` says so (+1, −1). A window that runs every day has no
 * other day to land on, so it never shifts.
 */
function localWindow(window: GuideWindow, now: Date, timeZone: string): { time: string; shift: number; key: number } {
  const next = nextOccurrence(window, now);
  if (next === null) {
    return { time: `${clock(window.startsAtLocalMinute)}–${clock(window.endsAtLocalMinute)}`, shift: 0, key: readingKey(window.startsAtLocalMinute) };
  }
  const start = wallClock(next.startsAt, timeZone);
  const end = wallClock(next.endsAt, timeZone);
  const shift = window.days === undefined ? 0 : start.day - next.day;
  // a window that closes at midnight closes at 24:00 of its own day, as the calendar writes it
  const closes = end.minute === 0 && end.day > start.day ? DAY_MINUTES : end.minute;
  return { time: `${clock(start.minute)}–${clock(closes)}`, shift, key: readingKey(shift * DAY_MINUTES + start.minute) };
}

/**
 * WHERE THE READING DAY BEGINS. Owner instruction, 2026-09-16.
 *
 * The rules author every window in ascending local minutes and this guide printed
 * them in that order, so each lane opened on its smallest hours: the merchant's
 * list began 01:00 and the shower's began 02:00. Two problems, and the second is
 * the one the owner reported. A player scanning for "what is next" met the two
 * windows they are least likely to be awake for; and with a shower now closing the
 * day at 23:00–24:00, a list that then printed 02:00 read as a day ENDING at two
 * in the morning rather than as the night's tail.
 *
 * SIX IS THE CUT AND IT IS A JUDGEMENT, not a derived figure. Everything the
 * calendar holds before it — 01:00 and 02:00 — is a window somebody meets by
 * staying up or by waking to it; everything after is a window they plan around.
 * The merchant's 07:00 is the first of those, which is why the cut sits below it
 * and not at the config's own `lowPriorityWindow` (00:00–08:00): that band is the
 * legacy random planner's quiet hours and would have sent 07:00 to the back.
 */
const READING_DAY_STARTS_AT_LOCAL_MINUTE = 6 * 60;

type DayGroup = GalaxyEventDays | 'EVERY_DAY';

/**
 * A LANE SPLIT BY THE KIND OF DAY IT RUNS ON. Owner instruction, 2026-09-16.
 *
 * The same 20:00 hour is a x3 shower on a weekday and a x5 one at the weekend, so
 * a flat row of pills could not say which was which. Weekdays first, because that
 * is the calendar a player meets five days out of seven; a window with no `days`
 * runs every day and is its own row.
 */
function byDays<T extends { readonly days?: GalaxyEventDays; readonly key: number }>(
  windows: readonly T[],
): { days: DayGroup; windows: T[] }[] {
  const order: DayGroup[] = ['WEEKDAY', 'WEEKEND', 'EVERY_DAY'];
  return order
    .map((days) => ({
      days,
      // a sorted COPY: the rules' own window order fixes each shower's sequence and asteroid ids
      windows: windows.filter((window) => (window.days ?? 'EVERY_DAY') === days).sort((left, right) => left.key - right.key),
    }))
    .filter((group) => group.windows.length > 0);
}

interface Authored {
  readonly startsAtLocalMinute: number;
  readonly endsAtLocalMinute: number;
  readonly days?: GalaxyEventDays;
}

/** Each authored window beside its reading on the player's clock. */
function place<W extends Authored>(kind: GalaxyEventKind, windows: readonly W[], now: Date, timeZone: string) {
  return windows.map((window) => ({
    window,
    ...(window.days === undefined ? {} : { days: window.days }),
    ...localWindow({
      kind,
      startsAtLocalMinute: window.startsAtLocalMinute,
      endsAtLocalMinute: window.endsAtLocalMinute,
      ...(window.days === undefined ? {} : { days: window.days }),
    }, now, timeZone),
  }));
}

/**
 * THE GALAXY EVENTS GUIDE (C10, on the kit). It answers "when is the next one, and what
 * does it give me?": a lit countdown to the next event, then one plate per event with its
 * rule and its windows, each kind of day on its own row. The unknown signal is a personal
 * event, not a calendar one, so its rules fold under their name at the foot.
 */
export function GalaxyEventsGuide({ onClose, timeZone = deviceTimeZone() }: { onClose: () => void; timeZone?: string }) {
  const { t, i18n } = useTranslation();
  const events = useGalaxyEvents();
  const now = new Date(serverNow());
  const asteroids = place('ASTEROID_SHOWER', GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows, now, timeZone);
  const trades = place('TRADE_SHIP', GALAXY_EVENTS.definitions.TRADE_SHIP.windows, now, timeZone);
  const convoys = place('INTERGALACTIC_CONVOY', GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows, now, timeZone);
  const shifted = [...asteroids, ...trades, ...convoys].some((item) => item.shift !== 0);
  const dayLabel = (days: DayGroup): string => t(`galaxy.eventsGuide.days.${days}`);

  return (
    <Sheet
      eyebrow={t('galaxy.eventsGuide.eyebrow')}
      title={t('galaxy.eventsGuide.title')}
      onClose={onClose}
      kit={{ art: artIconSrc('hud-timers'), tone: 'self' }}
    >
      <div className="gk gk-guide">
        <NextEventSummary event={events.data?.next ?? null} />
        <p className="gk-guide__intro">
          <span>{t('galaxy.eventsGuide.intro')}</span>
          <span className="gk-guide__zone"><Glyph id="clock" />{t('galaxy.eventsGuide.timeZone', { zone: zoneName(timeZone, i18n.language, now) })}</span>
        </p>
        {shifted ? <p className="gk-note">{t('galaxy.eventsGuide.dayShift')}</p> : null}

        <EventCard
          tone="crystal"
          glyph="asteroid"
          title={t('galaxy.eventsGuide.asteroid.title')}
          summary={t('galaxy.eventsGuide.asteroid.summary', {
            rate: decimal(ASTEROID_DYNAMIC.perPlayerPerHour, 2),
            frontMinutes: ASTEROID_SHOWER_FRONT_LOAD.minutes,
            window: SPAWN_GATE.onlineWindowMinutes,
          })}
        >
          {byDays(asteroids).map((group) => (
            <DayRow key={group.days} label={dayLabel(group.days)}>
              {group.windows.map((item) => (
                <TimePill
                  key={item.window.startsAtLocalMinute}
                  time={item.time}
                  shift={item.shift}
                  detail={`×${String(item.window.effect.asteroidSpawnMultiplier)}`}
                />
              ))}
            </DayRow>
          ))}
        </EventCard>

        <EventCard
          tone="alloy"
          glyph="crate"
          title={t('galaxy.eventsGuide.trade.title')}
          summary={t('galaxy.eventsGuide.trade.summary')}
          note={t('galaxy.eventsGuide.trade.rate')}
        >
          {byDays(trades).map((group) => (
            <DayRow key={group.days} label={dayLabel(group.days)}>
              {group.windows.map((item) => (
                <TimePill key={item.window.startsAtLocalMinute} time={item.time} shift={item.shift} />
              ))}
            </DayRow>
          ))}
        </EventCard>

        <EventCard
          tone="hostile"
          glyph="rocket"
          title={t('galaxy.eventsGuide.convoy.title')}
          summary={t('galaxy.eventsGuide.convoy.summary')}
          note={t('galaxy.eventsGuide.convoy.note')}
        >
          {byDays(convoys).map((group) => (
            <DayRow key={group.days} label={dayLabel(group.days)}>
              {group.windows.map((item) => (
                <TimePill key={item.window.startsAtLocalMinute} time={item.time} shift={item.shift} />
              ))}
            </DayRow>
          ))}
        </EventCard>

        <SignalRules />

        <p className="gk-note gk-guide__daily">{t('galaxy.eventsGuide.dailyNote')}</p>
      </div>
    </Sheet>
  );
}

/** The next public event, lit: what it is and how long until it starts. */
function NextEventSummary({ event }: { event: { kind: GalaxyEventKind; startsAt: Date } | null }) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  if (!event || event.startsAt.getTime() <= now) return null;
  const eventName = t(`galaxy.eventsGuide.event.${event.kind}`);
  const left = duration((event.startsAt.getTime() - now) / MINUTE_MS);
  return (
    <div role="status" aria-label={t('galaxy.eventsGuide.nextLabel')} className="gk-nextevent">
      <span className="gk-nextevent__mark" aria-hidden="true"><Glyph id="timed" /></span>
      <span className="gk-nextevent__words">
        <span className="gk-nextevent__label">{t('galaxy.eventsGuide.nextLabel')}</span>
        <span className="gk-nextevent__line">
          {t('galaxy.eventsGuide.nextUpcoming', { event: eventName, duration: left })}
        </span>
      </span>
    </div>
  );
}

/** The personal signal's rules, one press away under their name. */
function SignalRules() {
  const { t } = useTranslation();
  return (
    <details className="gk-rules">
      <summary className="gk-rules__head" {...OWN_SOUND} onClick={() => { playSound('tap'); haptic('tap'); }}>
        <Glyph id="siren" />
        <span className="flex-1">{t('unknownSignal.title')}</span>
        <span className="gk-rules__chev"><Glyph id="down" /></span>
      </summary>
      <div className="gk-rules__body">
        <p>{t('unknownSignal.wiki')}</p>
        <p>{t('unknownSignal.collector')}</p>
      </div>
    </details>
  );
}

/** One event as a kit plate: its mark in its colour, its rule, then its windows by kind of day. */
function EventCard({
  tone,
  glyph,
  title,
  summary,
  note,
  children,
}: {
  tone: 'crystal' | 'alloy' | 'hostile';
  glyph: GlyphId;
  title: string;
  summary: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <article className="gk-event" data-tone={tone}>
      <div className="gk-event__head">
        <span className="gk-event__bay" aria-hidden="true"><Glyph id={glyph} /></span>
        <div className="gk-event__words">
          <h3 className="gk-event__title">{title}</h3>
          <p className="gk-event__summary">{summary}</p>
        </div>
      </div>
      <div className="gk-event__days">{children}</div>
      {note === undefined ? null : <p className="gk-event__note">{note}</p>}
    </article>
  );
}

/** One kind of day: its name on the left, its windows beside it. */
function DayRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-event-days className="gk-event__day">
      <span data-day-name className="gk-event__dayname">{label}</span>
      <div className="gk-event__windows">{children}</div>
    </div>
  );
}

/** One window on the player's clock; a start that lands on another day than the galaxy's says which. */
function TimePill({ time, shift, detail }: { time: string; shift: number; detail?: string }) {
  const { t } = useTranslation();
  return (
    <span className="gk-window" {...(shift === 0 ? {} : { 'data-shift': String(shift) })}>
      <span data-window-time className="gk-window__time gk-num">
        <span>{time}</span>
        {detail === undefined ? null : <span className="gk-window__boost">{detail}</span>}
      </span>
      {shift === 0 ? null : (
        <span className="gk-window__shift">
          <span aria-hidden="true">{`${shift > 0 ? '+' : '−'}${String(Math.abs(shift))}`}</span>
          <span className="sr-only">{t(shift > 0 ? 'galaxy.eventsGuide.nextDay' : 'galaxy.eventsGuide.previousDay')}</span>
        </span>
      )}
    </span>
  );
}
