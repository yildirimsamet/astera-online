import { radarDetectsFleets, radarRange, telescopeSlots } from '@blindspace/rules';
import { useGalaxy, useIntel, usePlanet } from '../api/queries.js';
import { percent, range } from '../lib/format.js';
import { staleness, useNow } from '../lib/time.js';
import { instrumentArt } from '../ui/assets.js';
import { BattleReports } from './BattleReports.jsx';
import { Reading } from '../ui/Clarity.js';
import { Note, Panel, Section } from '../ui/primitives.js';

/**
 * WHAT YOU KNOW — and, more importantly, what you do not.
 *
 * The known product risk for this whole game is that the intel layer reads as a
 * boring list. The fix is not decoration: it is that the screen leads with
 * COVERAGE — how much of your neighbourhood you can actually see — so a player
 * with three telescopes and eleven blind neighbours feels the eleven.
 *
 * Empty states here are the most valuable real estate in the game, because for
 * the first hour they are the entire screen. Each one names the instrument that
 * would fill it and what that instrument would tell them.
 */
export function IntelScreen() {
  const intel = useIntel();
  const planet = usePlanet();
  const galaxy = useGalaxy();
  const now = useNow(30_000);

  if (intel.isPending || !intel.data) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="legend animate-pulse">Collecting</p>
      </div>
    );
  }

  const telescope = planet.data?.instruments.TELESCOPE ?? 0;
  const radar = planet.data?.instruments.RADAR ?? 0;
  const { watching, probeReports, radarLog } = intel.data;
  const neighbours = (galaxy.data?.planets ?? []).filter((p) => !p.isSelf).length;
  const seen = watching.length;

  return (
    <div className="px-4 pt-4">
      <Coverage
        seen={seen}
        slots={telescopeSlots(telescope)}
        neighbours={neighbours}
        telescope={telescope}
        radar={radar}
      />

      <Section
        label="Watching"
        aside={telescope > 0 ? `${String(seen)}/${String(telescope)} slots used` : undefined}
      >
        {watching.length === 0 ? (
          <Instrument
            art={instrumentArt('TELESCOPE', 1)}
            missing={telescope > 0 ? 'No slot is pointed at anything' : 'You have no Telescope'}
            gives="Tells you the moment a planet's fleet leaves — the one fact that decides every raid."
            cost={telescope > 0 ? 'Pick a planet in the galaxy and point a slot at it.' : 'Install one from your planet screen.'}
          />
        ) : (
          <Panel className="py-1">
            {watching.map((watch) => (
              <div key={watch.slot} className="border-b border-line-soft py-3 last:border-b-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[14px] uppercase tracking-wide text-bone">
                    {watch.targetName}
                  </span>
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
                {watch.reading.status === 'AWAY' && (
                  <p className="mt-1.5 text-[12px] text-opportunity">
                    Their planet is defended by whatever they left behind.
                  </p>
                )}
              </div>
            ))}
          </Panel>
        )}
        {watching.some((w) => w.reading.state === 'INTERMITTENT') && (
          <Note>
            An intermittent reading refreshes every twenty minutes at best. Checking again will not
            improve it — the answer is fixed until the window turns over.
          </Note>
        )}
      </Section>

      <Section label="Probe reports" aside={probeReports.length > 0 ? 'newest first' : undefined}>
        {probeReports.length === 0 ? (
          <Instrument
            art="/assets/images/ships/explorer_ship.png"
            missing="No probe has ever come back"
            gives="Real numbers — how much they hold and how hard they are to take — as a range."
            cost="220 alloy and a few minutes. Their radar may catch it."
          />
        ) : (
          <Panel className="py-1">
            {probeReports.map((report) => (
              <div
                key={`${report.targetPlanetId}-${String(report.at.getTime())}`}
                className="border-b border-line-soft py-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[14px] uppercase tracking-wide text-bone">
                    {report.targetName}
                  </span>
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
                  {percent(report.accuracy)} accuracy · fleet {report.fleetHome ? 'was home' : 'was out'}
                  {report.detected && <span className="text-threat"> · they caught it</span>}
                </p>
              </div>
            ))}
          </Panel>
        )}
      </Section>

      <BattleReports />

      <Section label="Who is looking at you" aside={radar > 0 ? `Radar L${String(radar)}` : undefined}>
        {radar < 1 ? (
          <Instrument
            art={instrumentArt('RADAR', 1)}
            missing="You have no Radar"
            gives="Catches probes aimed at you. From L3, it sweeps a circle around your world and warns you the moment a fleet crosses into it."
            cost="Someone can build a complete picture of this planet and you will never know."
          />
        ) : radarLog.length === 0 ? (
          <Panel>
            <p className="text-[13px] text-dim">
              Nothing has scanned you. Radar L{radar} is listening.
            </p>
          </Panel>
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
            {/*
              A REACH, NOT A COUNTDOWN. D49.
              How much WARNING it buys depends on what is flying at you, so a
              figure in minutes would be a different lie for every raid. The
              circle is the thing the player owns; the second sentence is the
              consequence, and it is the interesting half.
            */}
            {radarDetectsFleets(radar)
              ? `Radar L${String(radar)} catches a fleet ${String(radarRange(radar))} units out. A slow, heavy fleet is inside that circle for far longer than a fast one — so you get more warning about the raids that can actually hurt you.`
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
 * WHAT YOUR EYES ARE DOING, MEASURED AGAINST WHAT YOU OWN.
 *
 * REWRITTEN ON THE OWNER'S NOTE. It used to read "Watching 2 of 47" against every
 * other planet in the galaxy, and draw a 47-cell bar with two cells lit. That is
 * a progress bar toward a goal the game does not have and could not offer: a
 * telescope tops out at three slots (D18, and D36 caps it), so the number on the
 * right was permanently unreachable by a factor of fifteen. An interface that
 * shows a player a 4% score on a task that cannot be completed is telling them
 * they are failing at something nobody asked them to do.
 *
 * The real question is the one the design actually poses: OF THE EYES YOU HAVE,
 * how many are pointed at somebody — and is the next pair worth buying. So the
 * denominator is the slot count, the bar has one cell per slot, and the size of
 * the galaxy appears where it belongs: as the reason a slot is a decision.
 */
function Coverage({
  seen,
  slots,
  neighbours,
  telescope,
  radar,
}: {
  /** Slots currently pointed at a world. */
  seen: number;
  /** Slots this telescope has at all. */
  slots: number;
  /** How many other worlds are out there. Context, never a target. */
  neighbours: number;
  telescope: number;
  radar: number;
}) {
  const idle = Math.max(0, slots - seen);
  // Only where there is a slot to add ONE to. With no telescope at all the line
  // above is already selling the first one, and "would watch one more" against
  // zero is arithmetic nobody said out loud.
  const more = slots > 0 && telescopeSlots(telescope + 1) > slots;

  return (
    <div className="panel mb-6 px-3.5 py-3.5">
      <p className="legend">Coverage</p>
      <p className="mt-1.5 text-[17px] leading-tight text-bone">
        {slots === 0 ? (
          <>You cannot see into a single planet</>
        ) : idle > 0 ? (
          <>
            Watching {seen} of your {slots} {slots === 1 ? 'slot' : 'slots'}
          </>
        ) : (
          <>Every slot you have is watching someone</>
        )}
      </p>

      {slots > 0 && (
        <div className="mt-2.5 flex h-1.5 gap-1">
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`flex-1 rounded-[1px] ${i < seen ? 'bg-crystal' : 'bg-line'}`} />
          ))}
        </div>
      )}

      <p className="mt-2.5 text-[12px] leading-snug text-dim">
        {slots === 0
          ? 'A Telescope is the cheapest way to stop that.'
          : idle > 0
            ? `${String(idle)} ${idle === 1 ? 'slot is' : 'slots are'} idle. Pick a world in the galaxy and point one at it.`
            : /*
                THE SCARCITY IS THE PRODUCT, AND IT IS SAID AS SUCH.
                Nobody watches a galaxy; you watch the two or three worlds you
                have decided matter. Naming the size of the disc here is what
                makes moving a slot feel like a choice rather than a shortfall.
              */
              `${String(neighbours)} worlds out there and ${String(slots)} ${
                slots === 1 ? 'eye' : 'eyes'
              } to spend. Moving one costs a cooldown, so choose who.`}
      </p>

      {more && (
        <p className="mt-1.5 text-[12px] text-crystal">
          Telescope L{telescope + 1} would watch one more.
        </p>
      )}

      {radar === 0 && (
        <p className="mt-1.5 text-[12px] text-alloy">
          And with no Radar, you cannot tell when someone is doing the same to you.
        </p>
      )}
    </div>
  );
}

/**
 * An instrument you do not own, sold as a capability.
 *
 * Not a disabled row and not an apology: the art is at full strength, the line
 * says what it would tell you, and the cost is stated plainly. A player should
 * finish reading it wanting the thing.
 */
function Instrument({
  art,
  missing,
  gives,
  cost,
}: {
  /** null where an instrument has no render of its own — the well just stays empty. */
  art: string | null;
  missing: string;
  gives: string;
  cost: string;
}) {
  return (
    <div className="group flex items-start gap-3.5 p-3.5">
      <div className="art-well flex size-14 shrink-0 items-center justify-center rounded">
        {art && <img src={art} alt="" aria-hidden className="size-13 object-contain" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-alloy">{missing}</p>
        <p className="mt-1 text-[13px] leading-snug text-bone">{gives}</p>
        <p className="mt-1.5 text-[12px] leading-snug text-faint">{cost}</p>
      </div>
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
