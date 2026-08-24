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
import { Sheet } from '../ui/Sheet.js';
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
            <button
              type="button"
              className="btn flex-1 text-[9px]"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('launch.back')}
            </button>
            <button
              type="button"
              className="btn btn-commit flex-[2] text-[9px]"
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
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-commit w-full"
            disabled={!canSend}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {total === 0 ? t('launch.chooseFleet') : t('launch.send', { count: total })}
          </button>
        )
      }
    >
      {/* THE LINE. Everything else on this sheet is supporting detail. */}
      <div className="panel border-alert/25 bg-alert/5 px-3.5 py-3 mt-1">
        <p className="legend text-[#e08a7c]">{t('launch.whileAway')}</p>
        <p className="num mt-1.5 text-[19px] leading-tight text-bone">
          {t('launch.defending', { count: route.homeDefenceAfter })}
        </p>
        <p className="num mt-1 text-[13px] text-[#e08a7c]">
          {total === 0
            ? t('launch.nothingSent')
            : t('launch.exposedFor', { duration: duration(route.exposureMinutes) })}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
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
              className={`border-b border-line-soft py-2.5 px-1 ${chosen > 0 ? 'bg-crystal/[0.05]' : ''}`}
            >
              {/*
                THE SHIP, NOT ITS NAME.
                This picker used to be a name and a speed, which is the one place
                in the game a player is actually choosing between hulls and the one
                place they were given nothing to choose WITH. The counter cycle is
                the whole of combat, and it is decided by these four numbers.
              */}
              <div className="flex items-center gap-3">
                <div className="art-well flex size-12 shrink-0 items-center justify-center rounded">
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
                    <p className="font-display text-[14px] uppercase tracking-wide text-bone">
                      {hullLabel(hull)}
                    </p>
                    <span className="num text-[11px] text-faint">
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

              <div className="mt-2 flex items-center justify-end gap-1">
                <StepButton
                  label={t('launch.fewer', { name: hullLabel(hull) })}
                  onClick={() => {
                    set(hull, chosen - stepFor(available));
                  }}
                >
                  −
                </StepButton>
                <span className="num w-12 text-center text-[16px] text-bone">{String(chosen)}</span>
                <StepButton
                  label={t('launch.more', { name: hullLabel(hull) })}
                  onClick={() => {
                    set(hull, chosen + stepFor(available));
                  }}
                >
                  +
                </StepButton>
                <button
                  type="button"
                  className="btn ml-1 px-2.5"
                  onClick={() => {
                    set(hull, chosen === available ? 0 : available);
                  }}
                >
                  {t('launch.all')}
                </button>
              </div>
            </div>
          );
        })}
        {fleetCount(planet.fleet) === 0 && (
          <p className="text-[13px] text-dim">{t('launch.noShips')}</p>
        )}
      </div>

      {confirming && (
        <>
          <p className="mt-5 text-[13px] leading-relaxed text-[#e08a7c]">
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
          <p className="mt-2 text-[13px] leading-relaxed text-dim">{t('launch.fleetsave')}</p>
        </>
      )}
    </Sheet>
  );
}

/** Big fleets need big steps; ten taps to send 200 Wasps is a design failure. */
const stepFor = (available: number): number =>
  available >= 200 ? 25 : available >= 50 ? 10 : available >= 20 ? 5 : 1;

function StepButton({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} className="btn px-3 py-1.5 text-[16px]" onClick={onClick}>
      {children}
    </button>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className="num mt-0.5 text-[16px] text-bone">{value}</p>
    </div>
  );
}
