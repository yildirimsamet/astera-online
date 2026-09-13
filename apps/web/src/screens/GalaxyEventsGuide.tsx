import { GALAXY_EVENTS } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { CargoIcon, CrystalIcon, GalaxyIcon } from '../ui/icons/index.js';
import { Sheet } from '../ui/kit/Sheet.js';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** Fixed event windows are authored in Türkiye minutes; this only turns them into clock text. */
export function eventWindow(startsAtLocalMinute: number, endsAtLocalMinute: number): string {
  const clock = (minute: number): string => `${twoDigits(Math.floor(minute / 60))}:${twoDigits(minute % 60)}`;
  return `${clock(startsAtLocalMinute)}–${clock(endsAtLocalMinute)}`;
}

export function GalaxyEventsGuide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const asteroidWindows = GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows;
  const tradeWindows = GALAXY_EVENTS.definitions.TRADE_SHIP.windows;
  const convoyWindows = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows;

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
            {asteroidWindows.map((window) => (
              <TimePill
                key={window.startsAtLocalMinute}
                time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
                detail={`×${String(window.effect.asteroidSpawnMultiplier)}`}
              />
            ))}
          </EventCard>

          <EventCard
            tone="alloy"
            icon={<CargoIcon className="size-5" />}
            title={t('galaxy.eventsGuide.trade.title')}
            summary={t('galaxy.eventsGuide.trade.summary')}
            note={t('galaxy.eventsGuide.trade.rate')}
          >
            {tradeWindows.map((window) => (
              <TimePill
                key={window.startsAtLocalMinute}
                time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
              />
            ))}
          </EventCard>

          <EventCard
            tone="threat"
            icon={<GalaxyIcon className="size-5" />}
            title={t('galaxy.eventsGuide.convoy.title')}
            summary={t('galaxy.eventsGuide.convoy.summary')}
            note={t('galaxy.eventsGuide.convoy.note')}
          >
            {convoyWindows.map((window) => (
              <TimePill
                key={window.startsAtLocalMinute}
                time={eventWindow(window.startsAtLocalMinute, window.endsAtLocalMinute)}
              />
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
      <div className="mt-3 flex flex-wrap gap-1.5">{children}</div>
      {note === undefined ? null : (
        <p className="mt-3 border-t border-line-soft pt-2 text-caption leading-snug text-bone">{note}</p>
      )}
    </article>
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
