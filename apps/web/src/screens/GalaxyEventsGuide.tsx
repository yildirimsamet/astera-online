import { GALAXY_EVENTS, type GalaxyEventDays } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { CargoIcon, CrystalIcon, GalaxyIcon } from '../ui/icons/index.js';
import { Sheet } from '../ui/kit/Sheet.js';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

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
 * The same 20:00 hour is a x10 shower on a weekday and a x15 one at the weekend, so
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

export function GalaxyEventsGuide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const asteroidGroups = byDays(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows);
  const tradeGroups = byDays(GALAXY_EVENTS.definitions.TRADE_SHIP.windows);
  const convoyGroups = byDays(GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows);
  const dayLabel = (days: DayGroup): string => t(`galaxy.eventsGuide.days.${days}`);

  return (
    <Sheet
      eyebrow={t('galaxy.eventsGuide.eyebrow')}
      title={t('galaxy.eventsGuide.title')}
      onClose={onClose}
    >
      <div className="pb-2">
        <div className="plate plate-inset flex items-center justify-between gap-3 rounded-chip px-3 py-2">
          <p className="text-caption leading-snug text-dim">{t('galaxy.eventsGuide.intro')}</p>
          <span className="legend shrink-0 rounded-full border border-crystal/25 bg-crystal/10 px-2 py-1 text-micro text-crystal">
            {t('galaxy.eventsGuide.timeZone')}
          </span>
        </div>

        <div className="mt-3 space-y-3">
          <EventCard
            tone="crystal"
            icon={<CrystalIcon className="size-5" />}
            title={t('galaxy.eventsGuide.asteroid.title')}
            summary={t('galaxy.eventsGuide.asteroid.summary')}
          >
            {asteroidGroups.map((group) => (
              <DayRow key={group.days} label={dayLabel(group.days)}>
                {group.windows.map((window) => (
                  <TimePill
                    key={window.startsAtLocalMinute}
                    time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                    detail={`×${String(window.effect.asteroidSpawnMultiplier)}`}
                  />
                ))}
              </DayRow>
            ))}
          </EventCard>

          <EventCard
            tone="alloy"
            icon={<CargoIcon className="size-5" />}
            title={t('galaxy.eventsGuide.trade.title')}
            summary={t('galaxy.eventsGuide.trade.summary')}
            note={t('galaxy.eventsGuide.trade.rate')}
          >
            {tradeGroups.map((group) => (
              <DayRow key={group.days} label={dayLabel(group.days)}>
                {group.windows.map((window) => (
                  <TimePill
                    key={window.startsAtLocalMinute}
                    time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                  />
                ))}
              </DayRow>
            ))}
          </EventCard>

          <EventCard
            tone="threat"
            icon={<GalaxyIcon className="size-5" />}
            title={t('galaxy.eventsGuide.convoy.title')}
            summary={t('galaxy.eventsGuide.convoy.summary')}
            note={t('galaxy.eventsGuide.convoy.note')}
          >
            {convoyGroups.map((group) => (
              <DayRow key={group.days} label={dayLabel(group.days)}>
                {group.windows.map((window) => (
                  <TimePill
                    key={window.startsAtLocalMinute}
                    time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                  />
                ))}
              </DayRow>
            ))}
          </EventCard>
        </div>

        <p className="mt-3 text-center text-micro leading-relaxed text-faint">
          {t('galaxy.eventsGuide.dailyNote')}
        </p>
      </div>
    </Sheet>
  );
}

function EventCard({
  tone,
  icon,
  title,
  summary,
  note,
  children,
}: {
  tone: 'crystal' | 'alloy' | 'threat';
  icon: React.ReactNode;
  title: string;
  summary: string;
  note?: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    crystal: 'border-crystal/25 text-crystal',
    alloy: 'border-alloy/25 text-alloy',
    threat: 'border-threat/25 text-threat',
  }[tone];

  return (
    <article className={`plate plate-inset rounded-plate border px-3 py-3 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-chip border border-current/25 bg-current/5">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="name text-bone">{title}</h3>
          <p className="mt-1 text-caption leading-snug text-dim">{summary}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">{children}</div>
      {note === undefined ? null : (
        <p className="mt-3 border-t border-line-soft pt-2 text-caption leading-snug text-bone">{note}</p>
      )}
    </article>
  );
}

/** One kind of day: its name on the left, its windows beside it. */
function DayRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-event-days className="flex items-center gap-2">
      <span className="legend w-[62px] shrink-0 text-dim">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function TimePill({ time, detail }: { time: string; detail?: string }) {
  return (
    <span className="num inline-flex items-center gap-1 rounded-full border border-line-soft bg-void/45 px-2 py-1 text-label text-bone">
      {time}
      {detail === undefined ? null : <span className="text-crystal">{detail}</span>}
    </span>
  );
}
