import { PROBE, distance, travelMinutes } from '@blindspace/rules';
import { useProbe, useWatch } from '../api/queries.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../api/schemas.js';
import { compact, percent, range } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { reachMinutes, waspMinutes } from '../lib/navigation.js';
import { Reading, Unwatched } from '../ui/Clarity.js';
import { Empty, Note } from '../ui/primitives.js';
import { Sheet } from '../ui/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * Everything you know about one planet, and the three things you can do about it.
 *
 * The order is deliberate: what you know first, what it would cost to know more
 * second, and only then the irreversible option. A player who attacks from here
 * has just read exactly how thin their information is.
 */
export function TargetSheet({
  target,
  planet,
  intel,
  onClose,
  onAttack,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  onClose: () => void;
  onAttack: () => void;
}) {
  const watch = useWatch();
  const probe = useProbe();
  const say = useToast();
  const now = useNow(30_000);

  const telescope = planet.satellites.TELESCOPE ?? 0;
  const dist = distance(planet.planet.position, target.position);
  const reach = reachMinutes(planet.planet.position, target.position, planet.fleet);
  const probeMinutes = travelMinutes(dist, PROBE.speed);
  const report = intel?.probeReports.find((r) => r.targetPlanetId === target.id);
  const affordProbe = planet.planet.alloy >= PROBE.alloy && planet.planet.crystal >= PROBE.crystal;

  return (
    <Sheet eyebrow={`Held by ${target.owner}`} title={target.name} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Development" value={`Tier ${String(target.coreTier)}`} />
        <Figure label="Distance" value={dist.toFixed(0)} />
        <Figure
          label="Your reach"
          value={reach === null ? `${duration(waspMinutes(planet.planet.position, target.position))}*` : duration(reach)}
        />
      </div>
      {reach === null && <Note>* at Wasp speed — you have no ships at home to send.</Note>}

      <section className="mt-6">
        <p className="legend mb-2">Telescope</p>
        {target.fleet ? (
          <Reading
            status={target.fleet.status}
            staleMinutes={target.fleet.staleMinutes}
            etaMinutes={target.fleet.etaMinutes}
            state={target.fleet.clarity}
          />
        ) : (
          <Unwatched />
        )}

        {telescope < 1 ? (
          <Note>Install a Telescope to watch a planet. Watching is silent — nobody is told.</Note>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: telescope }, (_, slot) => {
              const current = intel?.watching.find((w) => w.slot === slot);
              const isThis = current?.targetPlanetId === target.id;
              return (
                <button
                  key={slot}
                  type="button"
                  className={`btn ${isThis ? 'border-crystal/60 text-crystal' : ''}`}
                  disabled={isThis || watch.isPending}
                  onClick={() => {
                    watch.mutate(
                      { targetPlanetId: target.id, slot },
                      {
                        onSuccess: () => {
                          say(`Watching ${target.name}`);
                        },
                        onError: (err) => {
                          say(describe(err), 'error');
                        },
                      },
                    );
                  }}
                >
                  {isThis
                    ? `Slot ${String(slot + 1)} · watching`
                    : current
                      ? `Slot ${String(slot + 1)} · replace ${current.targetName}`
                      : `Watch · slot ${String(slot + 1)}`}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <p className="legend mb-2">Last probe</p>
        {report ? (
          <div className="panel px-3.5 py-3">
            <div className="grid grid-cols-3 gap-3">
              <Figure label="Stock" value={range(report.stock.low, report.stock.high)} />
              <Figure label="Defence" value={range(report.defence.low, report.defence.high)} />
              <Figure label="Ships" value={range(report.fleetSize.low, report.fleetSize.high)} />
            </div>
            <p className="num mt-3 text-[11px] text-faint">
              {staleness((now - report.at.getTime()) / 60_000)} · {percent(report.accuracy)} accuracy ·
              fleet {report.fleetHome ? 'was home' : 'was out'}
            </p>
            {report.detected && (
              <p className="num mt-1 text-[11px] text-alert">Their radar caught this probe.</p>
            )}
          </div>
        ) : (
          <Empty>Nothing has looked closely at this planet.</Empty>
        )}

        <button
          type="button"
          className="btn mt-3 w-full"
          disabled={!affordProbe || probe.isPending}
          onClick={() => {
            probe.mutate(target.id, {
              onSuccess: (r) => {
                say(`Probe away · reports back in ${duration(r.flightMinutes)}`);
              },
              onError: (err) => {
                say(describe(err), 'error');
              },
            });
          }}
        >
          Probe · {compact(PROBE.alloy)} alloy · {duration(probeMinutes)}
        </button>
        <Note>
          A probe returns real numbers, as a range. Their radar may catch it — the cost of
          knowing is being known.
        </Note>
      </section>

      <section className="mt-7 border-t border-line-soft pt-5">
        <button type="button" className="btn btn-commit w-full" onClick={onAttack}>
          Plan an attack
        </button>
      </section>
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className="num mt-0.5 text-[15px] text-bone">{value}</p>
    </div>
  );
}
