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
    if (item.endsAt.getTime() > now.getTime()) return item;
  }
  return null;
}

const deviceClock = (date: Date): string => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(date);

/** Fixed event windows are authored in Türkiye minutes; this only turns them into clock text. */
export function eventWindow(startsAtLocalMinute: number, endsAtLocalMinute: number): string {
  const clock = (minute: number): string => `${twoDigits(Math.floor(minute / 60))}:${twoDigits(minute % 60)}`;
  return `${clock(startsAtLocalMinute)}–${clock(endsAtLocalMinute)}`;
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

/**
 * Order a lane for reading, without touching the authored array.
 *
 * `packages/rules` decides sequence numbers from its own window order, and a
 * shower's sequence fixes the index every asteroid id is an HMAC of — so this
 * sorts a COPY and nothing here may ever be pushed back into the rules.
 */
function readingOrder<T extends { readonly startsAtLocalMinute: number }>(
  windows: readonly T[],
): T[] {
  const key = (minute: number): number =>
    minute < READING_DAY_STARTS_AT_LOCAL_MINUTE ? minute + 24 * 60 : minute;
  return [...windows].sort((left, right) =>
    key(left.startsAtLocalMinute) - key(right.startsAtLocalMinute));
}

type DayGroup = GalaxyEventDays | 'EVERY_DAY';

/**
 * A LANE SPLIT BY THE KIND OF DAY IT RUNS ON. Owner instruction, 2026-09-16.
 *
 * The same 20:00 hour is a x3 shower on a weekday and a x5 one at the weekend, so
 * a flat row of pills could not say which was which. Weekdays first, because that
 * is the calendar a player meets five days out of seven; a window with no `days`
 * runs every day and is its own row.
 */
function byDays<T extends { readonly days?: GalaxyEventDays; readonly startsAtLocalMinute: number }>(
  windows: readonly T[],
): { days: DayGroup; windows: T[] }[] {
  const order: DayGroup[] = ['WEEKDAY', 'WEEKEND', 'EVERY_DAY'];
  return order
    .map((days) => ({
      days,
      windows: readingOrder(windows.filter((window) => (window.days ?? 'EVERY_DAY') === days)),
    }))
    .filter((group) => group.windows.length > 0);
}

/**
 * THE GALAXY EVENTS GUIDE (C10, on the kit). It answers "when is the next one, and what
 * does it give me?": a lit countdown to the next event, then one plate per event with its
 * rule and its windows, each kind of day on its own row. The unknown signal is a personal
 * event, not a calendar one, so its rules fold under their name at the foot.
 */
export function GalaxyEventsGuide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const events = useGalaxyEvents();
  const asteroidGroups = byDays(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows);
  const tradeGroups = byDays(GALAXY_EVENTS.definitions.TRADE_SHIP.windows);
  const convoyGroups = byDays(GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows);
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
          <span className="gk-guide__zone"><Glyph id="clock" />{t('galaxy.eventsGuide.timeZone')}</span>
        </p>

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
          {asteroidGroups.map((group) => (
            <DayRow key={group.days} label={dayLabel(group.days)}>
              {group.windows.map((window) => (
                <TimePill
                  key={window.startsAtLocalMinute}
                  kind="ASTEROID_SHOWER"
                  startsAtLocalMinute={window.startsAtLocalMinute}
                  endsAtLocalMinute={window.endsAtLocalMinute}
                  days={'days' in window ? window.days : undefined}
                  time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                  detail={`×${String(window.effect.asteroidSpawnMultiplier)}`}
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
          {tradeGroups.map((group) => (
            <DayRow key={group.days} label={dayLabel(group.days)}>
              {group.windows.map((window) => (
                <TimePill
                  key={window.startsAtLocalMinute}
                  kind="TRADE_SHIP"
                  startsAtLocalMinute={window.startsAtLocalMinute}
                  endsAtLocalMinute={window.endsAtLocalMinute}
                  time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                />
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
          {convoyGroups.map((group) => (
            <DayRow key={group.days} label={dayLabel(group.days)}>
              {group.windows.map((window) => (
                <TimePill
                  key={window.startsAtLocalMinute}
                  kind="INTERGALACTIC_CONVOY"
                  startsAtLocalMinute={window.startsAtLocalMinute}
                  endsAtLocalMinute={window.endsAtLocalMinute}
                  days={window.days}
                  time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                />
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

function TimePill({
  kind,
  startsAtLocalMinute,
  endsAtLocalMinute,
  days,
  time,
  detail,
}: GuideWindow & { time: string; detail?: string }) {
  const { t } = useTranslation();
  const next = nextOccurrence({ kind, startsAtLocalMinute, endsAtLocalMinute, days }, new Date(serverNow()));
  const local = next === null
    ? null
    : `${deviceClock(next.startsAt)}–${deviceClock(next.endsAt)}`;
  return (
    <span className="gk-window">
      <span data-window-time className="gk-window__time gk-num">
        <span>{time}</span>
        {detail === undefined ? null : <span className="gk-window__boost">{detail}</span>}
      </span>
      {local === null ? null : (
        <span className="gk-window__local">{t('galaxy.eventsGuide.localTime', { time: local })}</span>
      )}
    </span>
  );
}
