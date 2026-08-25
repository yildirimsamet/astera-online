import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HULLS, fleetCount, type Fleet, type MobileHullId } from '@astera/rules';
import { useLaunch } from '../api/queries.js';
import type { GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { hullLabel } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { MOBILE, planRoute } from '../lib/navigation.js';
import { StatStrip } from '../ui/Action.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * The commitment.
 *
 * This screen is built around one line — home defence after launch, and for how
 * long — because that is the actual bet. A fleet in flight is a fleet that is not
 * defending you, and the player must feel that before pressing the button, not
 * discover it when someone else's fleet lands.
 *
 * There is no recall endpoint and there is not going to be one.
 */
export function LaunchSheet({
  target,
  planet,
  onClose,
  onLaunched,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const { t } = useTranslation();
  const launch = useLaunch();
  const say = useToast();
  const [sending, setSending] = useState<Fleet>({});
  const [confirming, setConfirming] = useState(false);

  const route = planRoute(planet.planet.position, target.position, sending, planet.fleet, planet.ground);
  const total = fleetCount(sending);
  const canSend = total > 0 && route.oneWayMinutes > 0;

  const set = (hull: MobileHullId, value: number): void => {
    const available = planet.fleet[hull] ?? 0;
    setSending((current) => ({ ...current, [hull]: Math.max(0, Math.min(available, value)) }));
  };

  return (
    <Sheet
      eyebrow={t('launch.eyebrow')}
      title={target.name}
      onClose={onClose}
      footer={
        confirming ? (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('launch.back')}
            </Button>
            <Button
              variant="commit"
              size="lg"
              className="flex-[2]"
              disabled={launch.isPending}
              onClick={() => {
                launch.mutate(
                  { targetPlanetId: target.id, fleet: sending },
                  {
                    onSuccess: (result) => {
                      say(
                        t('launch.launched', {
                          duration: duration(result.exposureMinutes),
                          count: result.homeDefenceAfter,
                        }),
                      );
                      onLaunched();
                    },
                    onError: (err) => {
                      say(describe(err), 'error');
                      setConfirming(false);
                    },
                  },
                );
              }}
            >
              {launch.isPending ? t('launch.launching') : t('launch.commit')}
            </Button>
          </div>
        ) : (
          <Button
            variant="commit"
            size="lg"
            full
            disabled={!canSend}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {total === 0 ? t('launch.chooseFleet') : t('launch.send', { count: total })}
          </Button>
        )
      }
    >
      {/* THE LINE. Everything else on this sheet is supporting detail. */}
      <div className="plate plate-threat mt-1 px-3 py-3">
        <p className="legend text-threat-ink">{t('launch.whileAway')}</p>
        <p className="num mt-2 text-figure leading-tight text-bone">
          {t('launch.defending', { count: route.homeDefenceAfter })}
        </p>
        <p className="num mt-1 text-body text-threat-ink">
          {total === 0
            ? t('launch.nothingSent')
            : t('launch.exposedFor', { duration: duration(route.exposureMinutes) })}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Figure
          label={t('launch.oneWay')}
          value={
            route.oneWayMinutes > 0 ? duration(route.oneWayMinutes) : t('launch.oneWayUnknown')
          }
        />
        <Figure label={t('launch.cargo')} value={compact(route.cargo)} />
        <Figure label={t('launch.distance')} value={route.distance.toFixed(0)} />
      </div>

      <div className="mt-6">
        <p className="legend mb-2">{t('launch.fleetHeading')}</p>
        {MOBILE.map((hull) => {
          const available = planet.fleet[hull] ?? 0;
          const chosen = sending[hull] ?? 0;
          if (available === 0) return null;
          return (
            <div
              key={hull}
              className={`border-b border-line-soft py-3 px-1 ${chosen > 0 ? 'bg-crystal/[0.05]' : ''}`}
            >
              {/*
                THE SHIP, NOT ITS NAME.
                This picker used to be a name and a speed, which is the one place
                in the game a player is actually choosing between hulls and the one
                place they were given nothing to choose WITH. The counter cycle is
                the whole of combat, and it is decided by these four numbers.
              */}
              <div className="flex items-center gap-3">
                <div data-art className="socket size-12 shrink-0 rounded-control">
                  {HULL_ART[hull] ? (
                    <img
                      src={HULL_ART[hull]}
                      alt=""
                      aria-hidden
                      className="size-11 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <HullMark hull={hull} className="size-7 text-dim" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="name text-bone">
                      {hullLabel(hull)}
                    </p>
                    <span className="num text-label text-faint">
                      {t('launch.atHome', { count: available })}
                    </span>
                  </div>
                  <div className="mt-1">
                    <StatStrip
                      atk={HULLS[hull].atk}
                      hp={HULLS[hull].hp}
                      speed={HULLS[hull].speed}
                      cargo={HULLS[hull].cargo}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <QuantityStepper
                  value={chosen}
                  min={0}
                  max={available}
                  onChange={(value) => { set(hull, value); }}
                  decreaseLabel={t('launch.fewer', { name: hullLabel(hull) })}
                  increaseLabel={t('launch.more', { name: hullLabel(hull) })}
                  valueLabel={t('launch.quantity', { name: hullLabel(hull) })}
                  maxLabel={t('launch.max', { name: hullLabel(hull) })}
                  maxText={t('launch.maxShort')}
                />
              </div>
            </div>
          );
        })}
        {fleetCount(planet.fleet) === 0 && (
          <p className="text-body text-dim">{t('launch.noShips')}</p>
        )}
      </div>

      {confirming && (
        <>
          <p className="mt-6 text-body leading-relaxed text-threat-ink">
            {t('launch.warning', { count: route.homeDefenceAfter })}
          </p>
          {/*
            THE CHEAPEST DEPTH IN THE GAME. D28.

            A fleet in flight is already untouchable — nothing can be raided that is
            not on the ground — and the player was never told. In OGame this same
            rule is called fleetsave and it took their players years to discover on
            their own; it is the single most important behaviour in that game and
            nobody designed it.

            Saying it out loud turns an existing rule into a strategy, and it makes
            the sentence above cut both ways: a launch is a risk to your planet AND
            the only way to make your fleet safe. That is a real decision, and it
            costs one line of text.
          */}
          <p className="mt-2 text-body leading-relaxed text-dim">{t('launch.fleetsave')}</p>
        </>
      )}
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className="num mt-1 text-title text-bone">{value}</p>
    </div>
  );
}
