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
import { launchFault } from '../lib/faults.js';
import { hullLabel } from '../i18n/names.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const GOODS = ['alloy', 'crystal', 'deuterium'] as const;

/** Dedicated commitment surface: no defender forecast, casualties, or recall. Held commit (B9, K4). */
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
  const launchBlocked = launchFault(planet.faults, 'fleet') !== null;
  const now = useNow(5_000);
  const [fleet, setFleet] = useState<Fleet>({});
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
    HANGAR: planet.buildings.HANGAR ?? 0,
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
  const fuel = route?.fuel ?? 0;
  /*
    THE SPENT QUOTA IS ORDERED AHEAD OF THE FLEET STATE, because it is the one
    refusal no amount of choosing fixes: this world is finished with this convoy
    whatever is in the hangar. D124 — it is stated on the control, never only in
    the server's answer.
  */
  const refusal = launchBlocked
    ? t('faults.launchBlock.SHIPYARD_REVOLT')
    : planet.convoyOccurrenceSpent === true
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
    setFleet((current) => {
      // A removed hull must be absent: convoy quotes and launch accept positive counts only.
      const { [hull]: _removed, ...remaining } = current;
      const next: Fleet = remaining;
      const selected = Math.max(0, Math.min(available, count));
      if (selected > 0) next[hull] = selected;
      return next;
    });
  };

  /**
   * THE QUOTE IS STAMPED WHEN THE HOLD COMPLETES. D201.
   *
   * The server's freshness guard counts from `quotedAt`, and the route is solved again at that
   * same instant so the age and the figures describe one moment. The old review step stamped it
   * at the first press and flew it at the second; a held commit is one act, so it is one stamp,
   * and the budget is spent on nothing but the request.
   */
  const commit = (): void => {
    const quotedAt = serverNow();
    const fresh: IntergalacticConvoyRoute | null = planIntergalacticConvoyRoute(
      planet.planet.position,
      event,
      (quotedAt - seasonStart.getTime()) / 60_000,
      fleet,
      planet.fleet,
      planet.ground,
      mods,
    );
    if (!fresh) {
      say(t('convoy.cannotReach'), 'error');
      return;
    }
    launch.mutate({
      occurrenceId: event.id,
      fleet,
      quotedAt: new Date(quotedAt),
      quotedFlightSeconds: fresh.oneWayMinutes * 60,
      quotedArriveAt: new Date(quotedAt + fresh.oneWayMinutes * 60_000),
      idempotencyKey: createIdempotencyKey(),
    }, {
      onSuccess: (result) => {
        say(t('convoy.launched', { duration: duration(result.flightSeconds / 60) }));
        onLaunched();
      },
      onError: (error) => {
        say(error instanceof ApiError && error.code === 'CONVOY_QUOTE_CHANGED'
          ? t('convoy.quoteChanged')
          : describe(error), 'error');
      },
    });
  };

  return (
    <Sheet
      eyebrow={t('convoy.sheetEyebrow', { duration: duration(minutesLeft) })}
      title={t('convoy.sheetTitle')}
      onClose={onClose}
      detents={['full']}
      footer={
        <div data-testid="convoy-commit">
          <HoldButton
            label={t('convoy.commit')}
            disabledReason={launch.isPending ? t('convoy.sending') : refusal}
            onCommit={commit}
          />
        </div>
      }
    >
      <div className="mt-1 grid gap-1 rounded-control border border-v2-line bg-v2-panel px-3 py-2.5">
        <p className="text-caption leading-snug text-v2-ink">{t('convoy.boundary')}</p>
        <p className="text-micro leading-snug text-v2-ink-2">{t('convoy.engagement')}</p>
        <p className="text-micro leading-snug text-v2-ink-2">{t('convoy.irreversible')}</p>
      </div>

      <h3 className="mt-4 px-1 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('convoy.fleetHeading')}</h3>
      <div className="mt-1">
        {owned.map((hull) => {
          const available = planet.fleet[hull] ?? 0;
          const art = HULL_ART[hull];
          return (
            <div key={hull} data-hull-row={hull} className={`border-b border-v2-line/70 px-1 py-2 last:border-b-0 ${(fleet[hull] ?? 0) > 0 ? 'bg-v2-self/5' : ''}`}>
              <div className="flex items-center gap-2">
                <span data-art className="grid size-8 shrink-0 place-items-center">
                  {art ? (
                    <img src={art} alt="" aria-hidden className="size-8 object-contain" loading="lazy" />
                  ) : (
                    <HullMark hull={hull} className="size-6 text-v2-ink-3" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-semibold text-v2-ink">{hullLabel(hull)}</span>
                  <span className="font-v2-mono text-micro text-v2-ink-3">{t('convoy.atHome', { count: available })}</span>
                </span>
                <QuantityStepper
                  look="v2"
                  value={fleet[hull] ?? 0}
                  min={0}
                  max={available}
                  onChange={(value) => { setShip(hull, value); }}
                  decreaseLabel={t('convoy.fewer', { name: hullLabel(hull) })}
                  increaseLabel={t('convoy.more', { name: hullLabel(hull) })}
                  valueLabel={t('convoy.quantity', { name: hullLabel(hull) })}
                  maxLabel={t('convoy.max', { name: hullLabel(hull) })}
                  maxText={t('convoy.maxShort')}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-control border border-v2-line bg-v2-deep/40 px-3 py-2.5">
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
      <h3 className="mt-4 px-1 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('convoy.actual')}</h3>
      <div className="mt-1.5 grid gap-1.5 rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
          <span />
          <span className="text-micro uppercase tracking-wide text-v2-ink-3">{t('convoy.cap', { hours: event.rewardPolicy.resourceCapHours })}</span>
          <span className="text-micro uppercase tracking-wide text-v2-ink-3">{t('convoy.raw')}</span>
          <span className="min-w-14 text-right text-micro uppercase tracking-wide text-v2-ink-3">
            {t('convoy.landed')}
          </span>
        </div>
        {GOODS.map((good) => (
          <div key={good} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-caption">
            <img src={RESOURCE_ART[good]} alt={t(`trade.${good}`)} className="size-4 object-contain" />
            <span className="font-v2-mono text-v2-ink-3">{full(productionCap[good])}</span>
            <span className="font-v2-mono text-v2-ink-2">{full(quote?.rawResourceReward[good] ?? ZERO[good])}</span>
            <span className="min-w-14 text-right font-v2-mono text-v2-ink">{full(quote?.resourceReward[good] ?? ZERO[good])}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-control border border-v2-line bg-v2-deep/40 px-3 py-2.5">
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
        <Reading label={t('convoy.outbound')} value={route ? duration(route.oneWayMinutes) : '—'} />
        <Reading label={t('convoy.home')} value={route ? duration(route.exposureMinutes) : '—'} />
        <Reading label={t('convoy.fuel')} value={full(fuel)} />
      </div>
    </Sheet>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-micro text-v2-ink-3">{label}</p>
      <p className="mt-0.5 font-v2-mono text-caption font-semibold text-v2-ink">{value}</p>
    </div>
  );
}
