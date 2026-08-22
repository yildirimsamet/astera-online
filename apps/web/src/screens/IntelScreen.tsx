import { PROBE, radarDetectsFleets, radarRange, telescopeSlots } from '@astera/rules';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxy, useIntel, usePlanet } from '../api/queries.js';
import { full, percent, range } from '../lib/format.js';
import { staleness, useNow } from '../lib/time.js';
import { instrumentArt } from '../ui/assets.js';
import { BattleReports } from './BattleReports.jsx';
import { Reading } from '../ui/Clarity.js';
import { Note, Panel, Section } from '../ui/primitives.js';
import { Unreachable, Waiting } from '../ui/kit/Surface.js';

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
  const { t } = useTranslation();
  const intel = useIntel();
  const planet = usePlanet();
  const galaxy = useGalaxy();
  const now = useNow(30_000);
  const [reportTab, setReportTab] = useState<'probes' | 'battles'>('probes');
  const probeTab = useRef<HTMLButtonElement>(null);
  const battleTab = useRef<HTMLButtonElement>(null);

  const onReportTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next: 'probes' | 'battles' | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      next = reportTab === 'probes' ? 'battles' : 'probes';
    }
    if (event.key === 'Home') next = 'probes';
    if (event.key === 'End') next = 'battles';
    if (next === null) return;
    event.preventDefault();
    setReportTab(next);
    (next === 'probes' ? probeTab : battleTab).current?.focus();
  };

  // Same distinction as the planet sheet: an error leaves `data` undefined but is
  // not a load in progress, and a pulse over a dead request is the interface lying.
  if (intel.isError) {
    return (
      <Unreachable
        what={t('surface.whatIntel')}
        onRetry={() => {
          void intel.refetch();
        }}
      />
    );
  }
  if (!intel.data) return <Waiting>{t('surface.waitingIntel')}</Waiting>;

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
        label={t('intel.watching.heading')}
        aside={
          telescope > 0
            ? t('intel.watching.slotsUsed', { used: seen, total: telescope })
            : undefined
        }
      >
        {watching.length === 0 ? (
          <Instrument
            art={instrumentArt('TELESCOPE', 1)}
            missing={t(
              telescope > 0
                ? 'intel.watching.missingNoSlot'
                : 'intel.watching.missingNoTelescope',
            )}
            gives={t('intel.watching.gives')}
            cost={t(
              telescope > 0 ? 'intel.watching.costPoint' : 'intel.watching.costInstall',
            )}
          />
        ) : (
          <Panel className="py-1">
            {watching.map((watch) => (
              <div key={watch.slot} className="border-b border-line-soft py-3 last:border-b-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[14px] uppercase tracking-wide text-bone">
                    {watch.ownerName}
                  </span>
                  <span className="text-[12px] text-faint">{watch.targetName}</span>
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
                    {t('intel.watching.away')}
                  </p>
                )}
              </div>
            ))}
          </Panel>
        )}
        {watching.some((w) => w.reading.state === 'INTERMITTENT') && (
          <Note>{t('intel.watching.intermittent')}</Note>
        )}
      </Section>

      <div
        role="tablist"
        aria-label={t('intel.tabs.label')}
        className="mx-0 mt-6 grid grid-cols-2 gap-1 rounded border border-line-soft bg-void/60 p-1"
      >
        <button
          ref={probeTab}
          id="intel-tab-probes"
          type="button"
          role="tab"
          aria-selected={reportTab === 'probes'}
          aria-controls="intel-panel-probes"
          tabIndex={reportTab === 'probes' ? 0 : -1}
          onClick={() => { setReportTab('probes'); }}
          onKeyDown={onReportTabKeyDown}
          className={`rounded px-2 py-2 font-display text-[11px] uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crystal ${reportTab === 'probes' ? 'bg-crystal/12 text-crystal' : 'text-faint'}`}
        >
          {t('intel.probes.heading')}
        </button>
        <button
          ref={battleTab}
          id="intel-tab-battles"
          type="button"
          role="tab"
          aria-selected={reportTab === 'battles'}
          aria-controls="intel-panel-battles"
          tabIndex={reportTab === 'battles' ? 0 : -1}
          onClick={() => { setReportTab('battles'); }}
          onKeyDown={onReportTabKeyDown}
          className={`rounded px-2 py-2 font-display text-[11px] uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crystal ${reportTab === 'battles' ? 'bg-crystal/12 text-crystal' : 'text-faint'}`}
        >
          {t('reports.heading')}
        </button>
      </div>

      <div
        id="intel-panel-probes"
        role="tabpanel"
        aria-labelledby="intel-tab-probes"
        hidden={reportTab !== 'probes'}
      >
        <Section
          label={t('intel.probes.heading')}
          aside={probeReports.length > 0 ? t('intel.probes.newest') : undefined}
        >
        {probeReports.length === 0 ? (
          <Instrument
            art="/assets/images/ships/explorer_ship.png"
            missing={t('intel.probes.missing')}
            gives={t('intel.probes.gives')}
            /*
              THE PRICE COMES FROM THE RULE, NOT FROM THE SENTENCE. D59.

              This line advertised 220 alloy while the game charged 50 alloy and
              50 crystal — a figure nothing in the code had ever used. It is the
              one card that has to persuade a commander to look instead of hit, so
              a wrong price here is not a typo, it is the argument failing.
            */
            cost={t('intel.probes.cost', {
              alloy: full(PROBE.alloy),
              crystal: full(PROBE.crystal),
            })}
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
                    {report.targetUsername}
                  </span>
                  <span className="truncate text-[12px] text-faint">{report.targetName}</span>
                  <span className="num text-[11px] text-faint">
                    {staleness((now - report.at.getTime()) / 60_000)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-3">
                  <Band
                    label={t('intel.probes.stock')}
                    value={range(report.stock.low, report.stock.high)}
                  />
                  <Band
                    label={t('intel.probes.defence')}
                    value={range(report.defence.low, report.defence.high)}
                  />
                  <Band
                    label={t('intel.probes.ships')}
                    value={range(report.fleetSize.low, report.fleetSize.high)}
                  />
                </dl>
                <p className="num mt-2 text-[11px] text-faint">
                  {t(
                    report.fleetHome ? 'intel.probes.accuracyHome' : 'intel.probes.accuracyOut',
                    { percent: percent(report.accuracy) },
                  )}
                  {report.detected && (
                    <span className="text-threat">{t('intel.probes.caught')}</span>
                  )}
                </p>
              </div>
            ))}
          </Panel>
        )}
        </Section>
      </div>

      <div
        id="intel-panel-battles"
        role="tabpanel"
        aria-labelledby="intel-tab-battles"
        hidden={reportTab !== 'battles'}
      >
        <BattleReports />
      </div>

      <Section
        label={t('intel.radar.heading')}
        aside={radar > 0 ? t('intel.radar.level', { level: radar }) : undefined}
      >
        {radar < 1 ? (
          <Instrument
            art={instrumentArt('RADAR', 1)}
            missing={t('intel.radar.missing')}
            gives={t('intel.radar.gives')}
            cost={t('intel.radar.cost')}
          />
        ) : radarLog.length === 0 ? (
          <Panel>
            <p className="text-[13px] text-dim">{t('intel.radar.quiet', { level: radar })}</p>
          </Panel>
        ) : (
          <Panel className="py-1">
            {radarLog.map((scan) => (
              <div
                key={scan.at.getTime()}
                className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2.5 last:border-b-0"
              >
                <span className="text-[13px] text-bone">
                  {t('intel.radar.scan')}
                  {scan.bearing && (
                    <span className="text-dim">
                      {t('intel.radar.bearing', { bearing: scan.bearing })}
                    </span>
                  )}
                  {scan.originPlanetName && (
                    <span className="text-alloy">
                      {t('intel.radar.origin', { planet: scan.originPlanetName })}
                    </span>
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
              ? t('intel.radar.noteFleets', { level: radar, range: radarRange(radar) })
              : t('intel.radar.noteProbes', { level: radar })}
            {radar < 2 && t('intel.radar.noteBearing')}
            {radar >= 2 && radar < 5 && t('intel.radar.noteOrigin')}
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
  const { t } = useTranslation();
  const idle = Math.max(0, slots - seen);
  // Only where there is a slot to add ONE to. With no telescope at all the line
  // above is already selling the first one, and "would watch one more" against
  // zero is arithmetic nobody said out loud.
  const more = slots > 0 && telescopeSlots(telescope + 1) > slots;

  return (
    <div className="panel mb-6 px-3.5 py-3.5">
      <p className="legend">{t('intel.coverage.label')}</p>
      <p className="mt-1.5 text-[17px] leading-tight text-bone">
        {slots === 0
          ? t('intel.coverage.blind')
          : idle > 0
            ? t('intel.coverage.partial', { seen, count: slots })
            : t('intel.coverage.full')}
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
          ? t('intel.coverage.blindHint')
          : idle > 0
            ? t('intel.coverage.idleHint', { count: idle })
            : /*
                THE SCARCITY IS THE PRODUCT, AND IT IS SAID AS SUCH.
                Nobody watches a galaxy; you watch the two or three worlds you
                have decided matter. Naming the size of the disc here is what
                makes moving a slot feel like a choice rather than a shortfall.
              */
              t('intel.coverage.scarcity', { neighbours, count: slots })}
      </p>

      {more && (
        <p className="mt-1.5 text-[12px] text-crystal">
          {t('intel.coverage.oneMore', { level: telescope + 1 })}
        </p>
      )}

      {radar === 0 && (
        <p className="mt-1.5 text-[12px] text-alloy">{t('intel.coverage.noRadar')}</p>
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
