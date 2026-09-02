import { useTranslation } from 'react-i18next';
import { useGalaxyEvents } from '../api/queries.js';
import { countdown, useNow } from '../lib/time.js';
import { GalaxyIcon } from '../ui/icons/index.js';

/** Active clock-derived status; lifecycle notifications remain in Signals/history. */
export function ActiveGalaxyEvent() {
  const { t } = useTranslation();
  const events = useGalaxyEvents();
  const now = useNow(1_000);
  const active = events.data?.events.filter((event) => now < event.endsAt.getTime()) ?? [];
  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none flex flex-col">
      {active.map((event) => (
        <div
          key={event.id}
          role="status"
          className="pointer-events-none mt-2 flex items-center gap-2 rounded-control border border-crystal/35 bg-deep/95 px-2 py-1.5 text-crystal shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          <GalaxyIcon className="size-4 shrink-0" />
          <div className="min-w-0">
            <p className="legend truncate text-micro">{t('galaxy.asteroidShower')}</p>
            <p className="num truncate text-micro text-bone">
              {t('galaxy.asteroidShowerStatus', {
                multiplier: event.asteroidSpawnMultiplier,
                remaining: countdown(event.endsAt.getTime() - now),
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
