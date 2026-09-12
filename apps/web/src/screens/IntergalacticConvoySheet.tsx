import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MOBILE_HULLS,
  combatValue,
  convoyProductionCap,
  fleetCargo,
  fleetCount,
  quoteIntergalacticConvoyReward,
  type BuildingLevels,
  type Fleet,
  type HullId,
  type Resources,
} from '@astera/rules';
import { ApiError, createIdempotencyKey } from '../api/client.js';
import { useLaunchIntergalacticConvoy } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import type { IntergalacticConvoyEvent } from '../lib/intergalacticConvoy.js';
import {
  flightModifiers,
  planIntergalacticConvoyRoute,
  type IntergalacticConvoyRoute,
} from '../lib/navigation.js';
import { compact, full } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { duration, useNow } from '../lib/time.js';
import { hullLabel } from '../i18n/names.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const GOODS = ['alloy', 'crystal', 'deuterium'] as const;

interface Confirmation {
  key: string;
  quotedAt: Date;
  route: IntergalacticConvoyRoute;
}

/** Dedicated commitment surface: no defender forecast, casualties, or recall. */
export function IntergalacticConvoySheet({
  event,
  seasonStart,
  planet,
  onClose,
  onLaunched,
  onAim,
}: {
  event: IntergalacticConvoyEvent;
  seasonStart: Date;
  planet: PlanetView;
  onClose: () => void;
  onLaunched: () => void;
  onAim?: (at: { x: number; y: number; z: number } | null) => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const launch = useLaunchIntergalacticConvoy(planet.planet.id);
  const now = useNow(5_000);
  const [fleet, setFleet] = useState<Fleet>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const mods = flightModifiers(planet);
  const nowMinutes = (now - seasonStart.getTime()) / 60_000;
  const firepower = combatValue(fleet);
  const cargo = fleetCargo(fleet, mods.tech);
  const route = planIntergalacticConvoyRoute(
    planet.planet.position,
    event,
    nowMinutes,
    fleet,
    planet.fleet,
    planet.ground,
    mods,
  );
  const buildings: BuildingLevels = {
    CORE: planet.buildings.CORE ?? 0,
    REFINERY: planet.buildings.REFINERY ?? 0,
    EXTRACTOR: planet.buildings.EXTRACTOR ?? 0,
    VAULT: planet.buildings.VAULT ?? 0,
    SHIPYARD: planet.buildings.SHIPYARD ?? 0,
    DEUTERIUM_PLANT: planet.buildings.DEUTERIUM_PLANT ?? 0,
  };
  const productionCap = convoyProductionCap({
    buildings,
    orbit: planet.effectiveOrbit ?? planet.orbit,
    effect: event.rewardPolicy,
  });
  const quote = firepower > 0
    ? quoteIntergalacticConvoyReward({
        productionCap,
        fleet,
        launchTech: mods.tech,
        effect: event.rewardPolicy,
      })
    : null;
  const shownRoute = confirmation?.route ?? route;

  useEffect(() => {
    onAim?.(route?.rendezvous ?? null);
    return () => { onAim?.(null); };
  }, [onAim, route?.rendezvous?.x, route?.rendezvous?.y, route?.rendezvous?.z]);

  const owned = useMemo(
    () => MOBILE_HULLS.filter((hull) => (planet.fleet[hull] ?? 0) > 0),
    [planet.fleet],
  );
  const ships = fleetCount(fleet);
  const windowOpen = now < event.endsAt.getTime();
  const fuel = shownRoute?.fuel ?? 0;
  /*
    THE SPENT QUOTA IS ORDERED AHEAD OF THE FLEET STATE, because it is the one
    refusal no amount of choosing fixes: this world is finished with this convoy
    whatever is in the hangar. D124 — it is stated on the control, never only in
    the server's answer.
  */
  const refusal = planet.convoyOccurrenceSpent === true
    ? t('convoy.alreadyStruck')
    : ships === 0
      ? t('convoy.chooseFleet')
      : firepower <= 0
        ? t('convoy.needsFirepower')
        : !windowOpen
          ? t('convoy.windowClosed')
          : planet.convoyLaunchLocked
            ? t('convoy.alreadyAway')
            : planet.flight.used >= planet.flight.total
              ? t('convoy.noBay')
              : route === null
                ? t('convoy.cannotReach')
                : planet.planet.deuterium < route.fuel
                  ? t('convoy.noFuel')
                  : null;
  const minutesLeft = Math.max(0, (event.endsAt.getTime() - now) / 60_000);

  const setShip = (hull: HullId, count: number): void => {
    const available = planet.fleet[hull] ?? 0;
    setFleet((current) => ({
      ...current,
      [hull]: Math.max(0, Math.min(available, count)),
    }));
    setConfirmation(null);
  };

  return (
    <Sheet
      eyebrow={t('convoy.sheetEyebrow', { duration: duration(minutesLeft) })}
      title={t('convoy.sheetTitle')}
      onClose={onClose}
      footer={confirmation && quote ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { setConfirmation(null); }}>
            {t('convoy.back')}
          </Button>
          <Button
            testId="convoy-confirm"
            variant="commit"
            size="lg"
            className="flex-[2]"
            disabled={launch.isPending}
            onClick={() => {
              launch.mutate({
                occurrenceId: event.id,
                fleet,
                quotedAt: confirmation.quotedAt,
                quotedFlightSeconds: confirmation.route.oneWayMinutes * 60,
                quotedArriveAt: new Date(
                  confirmation.quotedAt.getTime() + confirmation.route.oneWayMinutes * 60_000,
                ),
                idempotencyKey: confirmation.key,
              }, {
                onSuccess: (result) => {
                  say(t('convoy.launched', { duration: duration(result.flightSeconds / 60) }));
                  onLaunched();
                },
                onError: (error) => {
                  if (error instanceof ApiError && error.code === 'CONVOY_QUOTE_CHANGED') {
                    say(t('convoy.quoteChanged'), 'error');
                  } else {
                    say(describe(error), 'error');
                  }
                  setConfirmation(null);
                },
              });
            }}
          >
            {launch.isPending ? t('convoy.sending') : t('convoy.commit')}
          </Button>
        </div>
      ) : (
        <Button
          testId="convoy-review"
          variant="commit"
          size="lg"
          full
          disabled={refusal !== null}
          onClick={() => {
            /*
              THE QUOTE IS STAMPED AT THE PRESS, NOT AT THE LAST TICK. D201.

              `now` comes from a five-second interval, so `new Date(now)` handed the
              server a quote that was already up to five seconds old before the
              confirmation sheet had even been drawn — five seconds spent out of the
              only budget the freshness guard has. The route is solved again at the
              same instant so the age and the figures on the sheet describe one
              moment rather than two.
            */
            const quotedAt = serverNow();
            const fresh = planIntergalacticConvoyRoute(
              planet.planet.position,
              event,
              (quotedAt - seasonStart.getTime()) / 60_000,
              fleet,
              planet.fleet,
              planet.ground,
              mods,
            );
            if (!fresh) return;
            setConfirmation({
              key: createIdempotencyKey(),
              quotedAt: new Date(quotedAt),
              route: fresh,
            });
          }}
        >
          {refusal ?? t('convoy.reviewing')}
        </Button>
      )}
    >
      <p className="text-caption leading-snug text-bone">{t('convoy.boundary')}</p>
      <p className="mt-1 text-caption text-dim">{t('convoy.engagement')}</p>
      <p className="mt-1 text-caption text-dim">{t('convoy.irreversible')}</p>

      <h3 className="legend mt-5">{t('convoy.fleetHeading')}</h3>
      <div className="mt-2 space-y-2">
        {owned.map((hull) => {
          const available = planet.fleet[hull] ?? 0;
          const art = HULL_ART[hull];
          return (
            <div key={hull} data-hull-row={hull} className="rounded-chip border border-line-soft px-3 py-2">
              <div className="flex items-center gap-2">
                <span data-art className="socket size-10 shrink-0 rounded-control">
                  {art ? (
                    <img src={art} alt="" aria-hidden className="size-9 object-contain" loading="lazy" />
                  ) : (
                    <HullMark hull={hull} className="size-6 text-dim" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="name block truncate text-bone">{hullLabel(hull)}</span>
                  <span className="num text-label text-dim">{t('convoy.atHome', { count: available })}</span>
                </span>
              </div>
              <div className="mt-2">
                <QuantityStepper
                  value={fleet[hull] ?? 0}
                  min={0}
                  max={available}
                  onChange={(value) => { setShip(hull, value); }}
                  decreaseLabel={t('convoy.fewer', { name: hullLabel(hull) })}
                  increaseLabel={t('convoy.more', { name: hullLabel(hull) })}
                  valueLabel={t('convoy.quantity', { name: hullLabel(hull) })}
                  editable
                  maxLabel={t('convoy.max', { name: hullLabel(hull) })}
                  maxText={t('convoy.maxShort')}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Reading label={t('convoy.firepower')} value={full(firepower)} />
        <Reading label={t('convoy.cargo')} value={full(cargo)} />
        <Reading
          label={t('convoy.resourceQuality')}
          value={`${String(Math.round((quote?.resourceQualityFactor ?? 0) * 100))}%`}
        />
        <Reading
          label={t('convoy.shipQuality')}
          value={`${String(Math.round((quote?.shipQualityFactor ?? 0) * 100))}%`}
        />
      </div>

      {/*
        THE COLUMNS ARE NAMED, BECAUSE A PHONE HAS NO HOVER. D124 · CLARITY.

        Three numbers a row — the world's hourly ceiling, what the wing's quality
        leaves of it, and what the hold actually brings home — carried their
        meaning in `title` attributes, which on the one device this game is built
        for do not exist. A number is not information until the player knows what
        it means, so the heading row states all three once and the rows stay as
        tight as they were.
      */}
      <h3 className="legend mt-5">{t('convoy.actual')}</h3>
      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
          <span />
          <span className="legend text-micro text-faint">{t('convoy.cap')}</span>
          <span className="legend text-micro text-faint">{t('convoy.raw')}</span>
          <span className="legend min-w-14 text-right text-micro text-faint">
            {t('convoy.landed')}
          </span>
        </div>
        {GOODS.map((good) => (
          <div key={good} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-caption">
            <img src={RESOURCE_ART[good]} alt={t(`trade.${good}`)} className="size-4 object-contain" />
            <span className="num text-faint">{full(productionCap[good])}</span>
            <span className="num text-dim">{full(quote?.rawResourceReward[good] ?? ZERO[good])}</span>
            <span className="num min-w-14 text-right text-bone">{full(quote?.resourceReward[good] ?? ZERO[good])}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Reading
          label={t('convoy.shipChance')}
          value={`${compact((quote?.shipDropChance ?? 0) * 100)}%`}
        />
        <Reading
          label={t('convoy.shipPrizeLabel')}
          value={quote
            ? t('convoy.shipPrize', {
                max: event.rewardPolicy.maxAwardedShips,
                tier: quote.maxTier,
              })
            : '—'}
        />
        <Reading label={t('convoy.outbound')} value={shownRoute ? duration(shownRoute.oneWayMinutes) : '—'} />
        <Reading label={t('convoy.home')} value={shownRoute ? duration(shownRoute.exposureMinutes) : '—'} />
        <Reading label={t('convoy.fuel')} value={full(fuel)} />
      </div>
    </Sheet>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="plate plate-inset rounded-chip px-3 py-2">
      <p className="legend text-micro text-faint">{label}</p>
      <p className="num mt-1 text-body text-bone">{value}</p>
    </div>
  );
}
