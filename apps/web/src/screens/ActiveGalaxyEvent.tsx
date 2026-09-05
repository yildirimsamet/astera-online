import { useTranslation } from 'react-i18next';
import { useGalaxyEvents } from '../api/queries.js';
import { compact } from '../lib/format.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { countdown, useNow } from '../lib/time.js';
import { GalaxyIcon } from '../ui/icons/index.js';

/**
 * Active clock-derived status; lifecycle notifications remain in Signals/history.
 *
 * TWO KINDS NOW. D149 · D156. A shower says what it is doing to the rock field; a
 * merchant says what it is paying. Both are one line and a countdown, and both are
 * the same chip — a public moment that is ON, with a clock on it.
 *
 * THE MERCHANT'S CHIP CARRIES THE RATE rather than only its name, because the rate
 * is the whole of the decision it is asking for (D124): a commander glancing at
 * the corner should already know whether it is worth opening. The full surface —
 * the orbit, the reach, the convoy — is the rail on the disc.
 *
 * AND IT CARRIES ALL THREE GOODS, IN THEIR OWN MARKS. Owner report: the chip read
 * *"90 alaşım = 1 döteryum"*, which names two of the three substances the merchant
 * deals in and spends a whole line of prose doing it. The rate is an equality
 * between three quantities and it is drawn as one — mark, number, equals, mark,
 * number, equals, mark, number — which is D142's rule about quantities a player
 * must judge, applied to the smallest surface in the game. It also stops being a
 * translated sentence: there is no grammar left in it to get wrong.
 */
export function ActiveGalaxyEvent() {
  const { t } = useTranslation();
  const events = useGalaxyEvents();
  const now = useNow(1_000);
  // `flatMap` rather than `filter`, because only the former narrows the union.
  const active = (events.data?.events ?? []).flatMap((event) => (
    now < event.endsAt.getTime() ? [event] : []
  ));
  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none flex flex-col">
      {active.map((event) => (
        <div
          key={event.id}
          role="status"
          className={`pointer-events-none mt-2 flex items-center gap-2 rounded-control border bg-deep/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
            event.kind === 'TRADE_SHIP'
              ? 'border-alloy/35 text-alloy'
              : 'border-crystal/35 text-crystal'
          }`}
        >
          <GalaxyIcon className="size-4 shrink-0" />
          <div className="min-w-0">
            <p className="legend truncate text-micro">
              {event.kind === 'TRADE_SHIP' ? t('trade.chip') : t('galaxy.asteroidShower')}
            </p>
            {event.kind === 'TRADE_SHIP' ? (
              <p className="num flex items-center gap-1 text-micro text-bone">
                {/*
                  ONE ANCHOR, THREE MARKS. A single deuterium is the unit the other
                  two are quoted against, because it is the dearest and therefore
                  the one whose figure stays small enough to read at this size.
                */}
                {(['alloy', 'crystal', 'deuterium'] as const).map((good, index) => (
                  <span key={good} className="flex items-center gap-0.5">
                    {index > 0 && <span aria-hidden className="text-faint">=</span>}
                    <img
                      src={RESOURCE_ART[good]}
                      alt={t(`trade.${good}`)}
                      className="size-3 shrink-0 object-contain"
                    />
                    {compact(event.rate.deuterium / event.rate[good])}
                  </span>
                ))}
                <span className="ml-1 truncate text-dim">
                  {t('trade.chipRemaining', {
                    remaining: countdown(event.endsAt.getTime() - now),
                  })}
                </span>
              </p>
            ) : (
              <p className="num truncate text-micro text-bone">
                {t('galaxy.asteroidShowerStatus', {
                  multiplier: event.asteroidSpawnMultiplier,
                  remaining: countdown(event.endsAt.getTime() - now),
                })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
