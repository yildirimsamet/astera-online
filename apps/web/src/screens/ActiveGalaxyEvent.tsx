import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxyEvents } from '../api/queries.js';
import { compact } from '../lib/format.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { countdown, useNow } from '../lib/time.js';
import { GalaxyIcon } from '../ui/icons/index.js';
import type { ActiveGalaxyEvent as ActiveGalaxyEventView } from '../api/schemas.js';

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
 * AND IT CARRIES ALL THREE GOODS, IN THEIR OWN MARKS. Historical D156 report: the chip read
 * *"90 alaşım = 1 döteryum"*, which names two of the three substances the merchant
 * deals in and spends a whole line of prose doing it. The rate is an equality
 * between three quantities and it is drawn as one — mark, number, equals, mark,
 * number, equals, mark, number — which is D142's rule about quantities a player
 * must judge, applied to the smallest surface in the game. It also stops being a
 * translated sentence: there is no grammar left in it to get wrong.
 */
interface ActiveGalaxyEventProps {
  onFocusTrade?: (id: string) => void;
  onFocusConvoy?: (id: string) => void;
}

export function ActiveGalaxyEvent({
  onFocusTrade,
  onFocusConvoy,
}: ActiveGalaxyEventProps = {}) {
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
        /*
          THE MERCHANT'S CHIP IS A BUTTON; THE SHOWER'S IS NOT. D170, owner request.

          A trade window is one ship, in one place, on the disc — so the chip that
          announces it can frame it, exactly as pressing anything else out there
          does. An Asteroid Shower is a property of the whole rock field with no
          single thing to look at, so its chip stays a status line and keeps
          `pointer-events-none`: a control that does nothing is worse than no
          control, and the surrounding layer must go on passing taps to the disc.
        */
        <Chip
          key={event.id}
          {...eventPress(event, onFocusTrade, onFocusConvoy)}
          tone={eventTone(event)}
        >
          <GalaxyIcon className="size-4 shrink-0" />
          <EventStatus event={event} now={now} />
        </Chip>
      ))}
    </div>
  );
}

function eventTone(event: ActiveGalaxyEventView): string {
  switch (event.kind) {
    case 'TRADE_SHIP': return 'border-alloy/35 text-alloy';
    case 'INTERGALACTIC_CONVOY': return 'border-threat/35 text-threat';
    case 'ASTEROID_SHOWER': return 'border-crystal/35 text-crystal';
  }
}

function eventPress(
  event: ActiveGalaxyEventView,
  onFocusTrade: ((id: string) => void) | undefined,
  onFocusConvoy: ((id: string) => void) | undefined,
): { onPress?: () => void } {
  switch (event.kind) {
    case 'TRADE_SHIP':
      return onFocusTrade ? { onPress: () => { onFocusTrade(event.id); } } : {};
    case 'INTERGALACTIC_CONVOY':
      return onFocusConvoy ? { onPress: () => { onFocusConvoy(event.id); } } : {};
    case 'ASTEROID_SHOWER':
      return {};
  }
}

function EventStatus({ event, now }: { event: ActiveGalaxyEventView; now: number }) {
  const { t } = useTranslation();
  switch (event.kind) {
    case 'TRADE_SHIP':
      return (
        <div className="min-w-0">
          <p className="legend truncate text-micro">{t('trade.chip')}</p>
          <p className="num flex items-center gap-1 text-micro text-bone">
            {(['alloy', 'crystal', 'deuterium'] as const).map((good, index) => (
              <span key={good} className="flex items-center gap-0.5">
                {index > 0 ? <span aria-hidden className="text-faint">=</span> : null}
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
        </div>
      );
    case 'INTERGALACTIC_CONVOY':
      return (
        <div className="min-w-0">
          <p className="legend truncate text-micro">{t('galaxy.intergalacticConvoy')}</p>
          <p className="num truncate text-micro text-bone">
            {t('galaxy.intergalacticConvoyStatus', {
              remaining: countdown(event.endsAt.getTime() - now),
            })}
          </p>
        </div>
      );
    case 'ASTEROID_SHOWER':
      return (
        <div className="min-w-0">
          <p className="legend truncate text-micro">{t('galaxy.asteroidShower')}</p>
          <p className="num truncate text-micro text-bone">
            {t('galaxy.asteroidShowerStatus', {
              multiplier: event.asteroidSpawnMultiplier,
              remaining: countdown(event.endsAt.getTime() - now),
            })}
          </p>
        </div>
      );
  }
}


/**
 * ONE CHIP, PRESSABLE OR NOT.
 *
 * The two states are a `button` and a `div` rather than a button that is
 * sometimes disabled: a disabled control still reads as a control a commander
 * has failed to earn, and a shower's chip is not a control at all. The pressable
 * one has to re-enable pointer events for itself — the layer around it stays
 * transparent to taps so the disc underneath keeps receiving them.
 */
function Chip({
  onPress,
  tone,
  children,
}: {
  onPress?: () => void;
  tone: string;
  children: ReactNode;
}) {
  const shell = `mt-2 flex items-center gap-2 rounded-control border bg-deep/95 px-2 py-1.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${tone}`;
  if (onPress === undefined) {
    return <div role="status" className={`pointer-events-none ${shell}`}>{children}</div>;
  }
  return (
    <button type="button" className={`pointer-events-auto ${shell}`} onClick={onPress}>
      {children}
    </button>
  );
}
