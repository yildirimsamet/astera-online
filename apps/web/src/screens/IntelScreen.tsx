import { radarDetectsFleets, radarLeadMinutes } from '@blindspace/rules';
import { useIntel, usePlanet } from '../api/queries.js';
import { percent, range } from '../lib/format.js';
import { staleness, useNow } from '../lib/time.js';
import { Reading } from '../ui/Clarity.js';
import { Empty, Note, Panel, Section } from '../ui/primitives.js';

/**
 * The intel screen — the part of the game that is the game.
 *
 * Three tiers, in the order they cost: what your telescopes see for free, what
 * your probes bought, and what your radar caught looking back at you. The known
 * risk on this screen is that it reads as a boring list, so every row leads with
 * the thing that changes a decision — the reading and its age — and pushes the
 * mechanics behind it.
 */
export function IntelScreen() {
  const intel = useIntel();
  const planet = usePlanet();
  const now = useNow(30_000);

  if (intel.isPending || !intel.data) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="legend animate-pulse">Collecting</p>
      </div>
    );
  }

  const telescope = planet.data?.satellites.TELESCOPE ?? 0;
  const radar = planet.data?.satellites.RADAR ?? 0;
  const { watching, probeReports, radarLog } = intel.data;

  const blind =
    watching.length === 0 && probeReports.length === 0 && radarLog.length === 0 && radar < 1;

  return (
    <div className="px-4 pt-4">
      {blind && <LadderOfKnowing />}

      <Section
        label="Watching"
        aside={telescope > 0 ? `${String(watching.length)}/${String(telescope)} slots` : undefined}
      >
        {watching.length === 0 ? (
          <Empty>
            {telescope > 0
              ? 'Nothing assigned. Pick a planet in the galaxy and point a slot at it.'
              : 'No telescope. You cannot see whether anyone’s fleet is home.'}
          </Empty>
        ) : (
          <Panel className="py-1">
            {watching.map((watch) => (
              <div
                key={watch.slot}
                className="border-b border-line-soft py-3 last:border-b-0"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] text-bone">{watch.targetName}</span>
                  <span className="text-[12px] text-faint">{watch.ownerName}</span>
                </div>
                <div className="mt-1.5">
                  <Reading
                    status={watch.reading.status}
                    staleMinutes={watch.reading.staleMinutes}
                    etaMinutes={watch.reading.etaMinutes}
                    state={watch.reading.state}
                  />
                </div>
              </div>
            ))}
          </Panel>
        )}
        {watching.some((w) => w.reading.state === 'INTERMITTENT') && (
          <Note>
            An intermittent reading refreshes every twenty minutes at best. Checking again will
            not improve it — the answer is fixed until the window turns over.
          </Note>
        )}
      </Section>

      <Section label="Probe reports" aside={probeReports.length > 0 ? 'newest first' : undefined}>
        {probeReports.length === 0 ? (
          <Empty>
            No probe has come back yet. A probe costs alloy and minutes and returns real numbers —
            as a range.
          </Empty>
        ) : (
          <Panel className="py-1">
            {probeReports.map((report) => (
              <div
                key={`${report.targetPlanetId}-${String(report.at.getTime())}`}
                className="border-b border-line-soft py-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] text-bone">{report.targetName}</span>
                  <span className="num text-[11px] text-faint">
                    {staleness((now - report.at.getTime()) / 60_000)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-3">
                  <Band label="Stock" value={range(report.stock.low, report.stock.high)} />
                  <Band label="Defence" value={range(report.defence.low, report.defence.high)} />
                  <Band label="Ships" value={range(report.fleetSize.low, report.fleetSize.high)} />
                </dl>
                <p className="num mt-2 text-[11px] text-faint">
                  {percent(report.accuracy)} accuracy · fleet{' '}
                  {report.fleetHome ? 'was home' : 'was out'}
                  {report.detected && <span className="text-alert"> · they caught it</span>}
                </p>
              </div>
            ))}
          </Panel>
        )}
      </Section>

      <Section label="Radar" aside={radar > 0 ? `L${String(radar)}` : undefined}>
        {radar < 1 ? (
          <Empty>
            No radar. Someone can build a complete picture of this planet and you will never
            know they were here.
          </Empty>
        ) : radarLog.length === 0 ? (
          <Empty>Nothing has scanned you.</Empty>
        ) : (
          <Panel className="py-1">
            {radarLog.map((scan) => (
              <div
                key={scan.at.getTime()}
                className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2.5 last:border-b-0"
              >
                <span className="text-[13px] text-bone">
                  Scan detected
                  {scan.bearing && <span className="text-dim"> from the galactic {scan.bearing}</span>}
                  {scan.originPlanetName && (
                    <span className="text-alloy"> · {scan.originPlanetName}</span>
                  )}
                </span>
                <span className="num shrink-0 text-[11px] text-faint">
                  {staleness((now - scan.at.getTime()) / 60_000)}
                </span>
              </div>
            ))}
          </Panel>
        )}
        {radar > 0 && (
          <Note>
            {radarDetectsFleets(radar)
              ? `Radar L${String(radar)} warns you ${String(radarLeadMinutes(radar))} minutes before a fleet lands.`
              : `Radar L${String(radar)} catches probes. From L3 it also warns of inbound fleets.`}
            {radar < 2 && ' L2 adds the direction they came from.'}
            {radar >= 2 && radar < 5 && ' L5 names the planet.'}
          </Note>
        )}
      </Section>
    </div>
  );
}

/**
 * What a player sees before they own a single instrument.
 *
 * There is no tutorial in this game — each system is meant to be explained at the
 * moment its absence is felt, and this screen is that moment. Three empty boxes
 * would say "nothing here"; the ladder says "here is what knowing costs", which is
 * the only thing a blind commander actually needs.
 */
function LadderOfKnowing() {
  const rungs = [
    ['Public', 'Free · silent', 'Who owns what, where it is, roughly how developed'],
    ['Telescope', 'A satellite slot · silent', 'Whether their fleet is home — and how old that answer is'],
    ['Probe', 'Alloy and minutes · loud', 'Their stock and defence, as a range. Their radar may catch it'],
    ['Combat', 'Ships, permanently', 'The truth. The most accurate intel in the game'],
  ];

  return (
    <div className="panel mb-7 px-3.5 py-4">
      <p className="legend mb-3">What knowing costs</p>
      {rungs.map(([name, cost, gives], i) => (
        <div
          key={name}
          className={`flex gap-3 py-2 ${i > 0 ? 'border-t border-line-soft' : ''}`}
        >
          <span className="num w-5 shrink-0 pt-0.5 text-[11px] text-faint">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-[14px] text-bone">
              {name} <span className="text-[11px] text-faint">{cost}</span>
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-dim">{gives}</p>
          </div>
        </div>
      ))}
      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        Watching is silent. Probing is not — you are told when someone probes you, and so are
        they. The cost of knowing is being known.
      </p>
    </div>
  );
}

function Band({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="legend">{label}</dt>
      <dd className="num mt-0.5 text-[15px] text-bone">{value}</dd>
    </div>
  );
}
