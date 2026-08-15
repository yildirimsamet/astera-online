import { useState } from 'react';
import { HULLS, fleetCount, type Fleet, type MobileHullId } from '@blindspace/rules';
import { useLaunch } from '../api/queries.js';
import type { GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { compact } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { MOBILE, planRoute } from '../lib/navigation.js';
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
      eyebrow="Attack"
      title={target.name}
      onClose={onClose}
      footer={
        confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn flex-1"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-commit flex-[2]"
              disabled={launch.isPending}
              onClick={() => {
                launch.mutate(
                  { targetPlanetId: target.id, fleet: sending },
                  {
                    onSuccess: (result) => {
                      say(
                        `Launched. Exposed for ${duration(result.exposureMinutes)} · ${String(result.homeDefenceAfter)} units holding.`,
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
              {launch.isPending ? 'Launching' : 'Launch — no recall'}
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
            {total === 0 ? 'Choose a fleet' : `Send ${String(total)} ships`}
          </button>
        )
      }
    >
      {/* THE LINE. Everything else on this sheet is supporting detail. */}
      <div className="panel border-alert/25 bg-alert/5 px-3.5 py-3">
        <p className="legend text-[#e08a7c]">While this fleet is away</p>
        <p className="num mt-1.5 text-[19px] leading-tight text-bone">
          {String(route.homeDefenceAfter)} units defending home
        </p>
        <p className="num mt-1 text-[13px] text-[#e08a7c]">
          {total === 0 ? 'Nothing sent yet' : `Exposed for ${duration(route.exposureMinutes)}`}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Figure label="One way" value={route.oneWayMinutes > 0 ? duration(route.oneWayMinutes) : '—'} />
        <Figure label="Cargo" value={compact(route.cargo)} />
        <Figure label="Distance" value={route.distance.toFixed(0)} />
      </div>

      <div className="mt-6">
        <p className="legend mb-2">Fleet</p>
        {MOBILE.map((hull) => {
          const available = planet.fleet[hull] ?? 0;
          const chosen = sending[hull] ?? 0;
          if (available === 0) return null;
          return (
            <div key={hull} className="flex items-center gap-3 border-b border-line-soft py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-bone">{HULLS[hull].name}</p>
                <p className="num text-[11px] text-faint">
                  {String(available)} home · speed {String(HULLS[hull].speed)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <StepButton
                  label={`Fewer ${HULLS[hull].name}`}
                  onClick={() => {
                    set(hull, chosen - stepFor(available));
                  }}
                >
                  −
                </StepButton>
                <span className="num w-12 text-center text-[16px] text-bone">{String(chosen)}</span>
                <StepButton
                  label={`More ${HULLS[hull].name}`}
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
                  All
                </button>
              </div>
            </div>
          );
        })}
        {fleetCount(planet.fleet) === 0 && (
          <p className="text-[13px] text-dim">
            No ships at home. Build some in the shipyard, or wait for a fleet to come back.
          </p>
        )}
      </div>

      {confirming && (
        <p className="mt-5 text-[13px] leading-relaxed text-[#e08a7c]">
          This cannot be recalled. Once it leaves, the only way to find out what was down there
          is to watch it land — and your planet holds {String(route.homeDefenceAfter)} units until
          it comes back.
        </p>
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
