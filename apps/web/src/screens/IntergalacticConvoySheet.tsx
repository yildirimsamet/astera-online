import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MOBILE_HULLS,
  combatValue,
  convoyProductionCap,
  fleetCargo,
  fleetCount,
  partitionCombatFleet,
  splitHealthFleet,
  quoteIntergalacticConvoyReward,
  honorConvoyResources,
  type BuildingLevels,
  type Fleet,
  type HullId,
  type Resources,
} from '@astera/rules';
import { ApiError, createIdempotencyKey } from '../api/client.js';
import { useGalaxy, useLaunchIntergalacticConvoy } from '../api/queries.js';
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
import { RadiationPreview } from '../ui/RadiationPreview.js';
import { HonorEffectQuote } from '../ui/HonorBenefits.js';
import { lethalAfterRefusal, radiationRefusalCount, routeHpRadiation, toHpRadiationSources, type RadiationRefusal } from '../lib/radiation.js';
import { GameHold, Glyph, SectionTag } from '../game-ui/index.js';
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
  const launchBlock = launchFault(planet.faults, 'fleet', planet.silentSpace === true);
  const now = useNow(5_000);
  const [fleet, setFleet] = useState<Fleet>({});
  const combatReady = useMemo(() => planet.fleetCombatReady ?? partitionCombatFleet(planet.fleet, planet.fleetDamage).eligible,
    [planet.fleet, planet.fleetDamage, planet.fleetCombatReady]);
  const selectedHealth = useMemo(() => {
    try { return splitHealthFleet(planet.fleet, planet.fleetDamage, fleet, true); }
    catch (error) { if (!(error instanceof RangeError)) throw error; return null; }
  }, [planet.fleet, planet.fleetDamage, fleet]);
  const mods = flightModifiers(planet);
  const nowMinutes = (now - seasonStart.getTime()) / 60_000;
  const firepower = combatValue(fleet);
  const cargo = fleetCargo(fleet, mods.tech);
  const route = planIntergalacticConvoyRoute(
    planet.planet.position,
    event,
    nowMinutes,
    fleet,
    combatReady,
    planet.ground,
    mods,
  );
  const galaxy = useGalaxy();
  const hpViews = galaxy.data?.hpRadiation;
  const hpSources = useMemo(() => toHpRadiationSources(hpViews ?? []), [hpViews]);
  const [radiationRefused, setRadiationRefused] = useState<RadiationRefusal | null>(null);
  const arrival = now + (route?.oneWayMinutes ?? 0) * 60_000;
  const engagementEnd = seasonStart.getTime() + (route?.engagementEndsAtMinute ?? 0) * 60_000;
  const home = seasonStart.getTime() + (route?.homeAtMinute ?? 0) * 60_000;
  const hpQuote = route?.rendezvous && selectedHealth ? routeHpRadiation({ fleet, tech: mods.tech,
    damage: selectedHealth.selectedDamage,
    path: [{ from: planet.planet.position, to: route.rendezvous, startMs: now, endMs: arrival },
      { from: route.rendezvous, to: route.engagementEnd, startMs: arrival, endMs: engagementEnd },
      { from: route.engagementEnd, to: planet.planet.position, startMs: engagementEnd, endMs: home }] }, hpSources) : null;
  const radiation = lethalAfterRefusal(hpQuote, radiationRefused, fleet);
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
  const baseReward = quote?.resourceReward ?? ZERO;
  const reward = planet.honorBenefits && quote ? honorConvoyResources(baseReward, quote.cargo, planet.honorBenefits) : baseReward;

  useEffect(() => {
    onAim?.(route?.rendezvous ?? null);
    return () => { onAim?.(null); };
  }, [onAim, route?.rendezvous?.x, route?.rendezvous?.y, route?.rendezvous?.z]);

  const owned = useMemo(
    () => MOBILE_HULLS.filter((hull) => (combatReady[hull] ?? 0) > 0),
    [combatReady],
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
  const refusal = launchBlock !== null
    ? t(`faults.launchBlock.${launchBlock}`)
    : planet.convoyOccurrenceSpent === true
      ? t('convoy.alreadyStruck')
    : selectedHealth === null ? t('repairStation.maintenance.stale')
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
    const available = combatReady[hull] ?? 0;
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
      combatReady,
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
      ...(planet.honorBenefits ? { expectedHonorTier: planet.honorBenefits.tier } : {}),
      ...(radiation && radiation.destroyed > 0 ? { acknowledgeRadiationLoss: true } : {}),
    }, {
      onSuccess: (result) => {
        say(t('convoy.launched', { duration: duration(result.flightSeconds / 60) }));
        onLaunched();
      },
      onError: (error) => {
        const count = radiationRefusalCount(error);
        if (count !== null) setRadiationRefused({ count, fleet });
        say(error instanceof ApiError && error.code === 'CONVOY_QUOTE_CHANGED'
          ? t('convoy.quoteChanged')
          : describe(error), 'error');
      },
    });
  };

  return (
    <Sheet
      kit={{ tone: 'hostile' }}
      eyebrow={t('convoy.sheetEyebrow', { duration: duration(minutesLeft) })}
      title={t('convoy.sheetTitle')}
      onClose={onClose}
      detents={['full']}
      footer={
        <div data-testid="convoy-commit" className="gk gk-launch__commit">
          <RadiationPreview radiation={radiation} />
          {/* A strike spends both legs' fuel and cannot be called back: the kit's spend weight, one second. */}
          <GameHold
            weight="spends"
            glyph="attack"
            commitSound="impact"
            label={t('convoy.commit')}
            disabledReason={launch.isPending ? t('convoy.sending') : refusal}
            onCommit={commit}
          />
        </div>
      }
    >
      <div className="gk-trade">
      {/* The rules before the wing: it does not shoot back, it fires for five seconds, and it is one-way. */}
      <section data-convoy-rules className="gk-well gk-convoy__rules">
        <p className="gk-convoy__lead">{t('convoy.boundary')}</p>
        <p className="gk-inote"><Glyph id="timed" />{t('convoy.engagement')}</p>
        <p className="gk-inote" data-tone="warn"><Glyph id="lock" />{t('convoy.irreversible')}</p>
      </section>

      <section className="gk-launch__fleet">
        <SectionTag as="h3">{t('convoy.fleetHeading')}</SectionTag>
        <div className="gk-ledger gk-launch__rows">
          {owned.map((hull) => {
            const available = combatReady[hull] ?? 0;
            const chosen = fleet[hull] ?? 0;
            const art = HULL_ART[hull];
            return (
              <div key={hull} data-hull-row={hull} className="gk-lrow gk-lrow--tight" {...(chosen > 0 ? { 'data-chosen': '' } : {})}>
                <span data-art className="gk-lrow__art">
                  {art ? <img src={art} alt="" aria-hidden width={36} height={36} loading="lazy" /> : <HullMark hull={hull} className="gk-lrow__mark" />}
                </span>
                <span className="gk-lrow__name">{hullLabel(hull)}</span>
                <span className="gk-sub gk-num gk-lrow__info" aria-label={t('convoy.atHome', { count: available })}>
                  {chosen}<span className="gk-lrow__of">/{available}</span>
                </span>
                <QuantityStepper
                  value={chosen}
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
            );
          })}
        </div>
      </section>

      <HonorEffectQuote kind="convoy" value={planet.honorBenefits} base={baseReward} net={reward} />
      <dl className="gk-well gk-figures gk-figures--well gk-figures--two">
        <Reading label={t('convoy.firepower')} value={full(firepower)} />
        <Reading label={t('convoy.cargo')} value={full(cargo)} />
        <Reading label={t('convoy.resourceQuality')} value={`${String(Math.round((quote?.resourceQualityFactor ?? 0) * 100))}%`} />
        <Reading label={t('convoy.shipQuality')} value={`${String(Math.round((quote?.shipQualityFactor ?? 0) * 100))}%`} />
      </dl>

      {/*
        THE COLUMNS ARE NAMED, BECAUSE A PHONE HAS NO HOVER. D124 · CLARITY.
        Three numbers a row — the world's hourly ceiling, what the wing's quality leaves of it,
        and what the hold actually brings home — so the head row states all three once, as a
        real table's column headers, and the rows stay tight.
      */}
      <section className="gk-launch__fleet">
        <SectionTag as="h3">{t('convoy.actual')}</SectionTag>
        <div className="gk-well gk-convoy__haul">
          <table className="gk-convoy__table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{t('convoy.cargo')}</span></th>
                <th scope="col" className="gk-label">{t('convoy.cap', { hours: event.rewardPolicy.resourceCapHours })}</th>
                <th scope="col" className="gk-label">{t('convoy.raw')}</th>
                <th scope="col" className="gk-label">{t('convoy.landed')}</th>
              </tr>
            </thead>
            <tbody>
              {GOODS.map((good) => (
                <tr key={good}>
                  <th scope="row"><img src={RESOURCE_ART[good]} alt={t(`trade.${good}`)} /></th>
                  <td className="gk-num" data-col="cap">{full(productionCap[good])}</td>
                  <td className="gk-num" data-col="raw">{full(quote?.rawResourceReward[good] ?? ZERO[good])}</td>
                  <td className="gk-num" data-col="landed">{full(reward[good])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="gk-well gk-figures gk-figures--well gk-figures--two">
        <Reading label={t('convoy.shipChance')} value={`${compact((quote?.shipDropChance ?? 0) * 100)}%`} />
        <Reading
          label={t('convoy.shipPrizeLabel')}
          value={quote ? t('convoy.shipPrize', { max: event.rewardPolicy.maxAwardedShips, tier: quote.maxTier }) : '—'}
        />
        <Reading label={t('convoy.outbound')} value={route ? duration(route.oneWayMinutes) : '—'} />
        <Reading label={t('convoy.home')} value={route ? duration(route.exposureMinutes) : '—'} />
        <Reading label={t('convoy.fuel')} value={full(fuel)} />
      </dl>
      </div>
    </Sheet>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="gk-figure">
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num gk-figure__value">{value}</dd>
    </div>
  );
}
