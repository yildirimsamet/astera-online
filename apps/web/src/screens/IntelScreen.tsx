import { GameActions } from '../session/seasonLock.js';
import { PROBE, radarDetectsFleets, radarRange, telescopeSlots } from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxy, useIntel, usePlanet } from '../api/queries.js';
import { full, percent, range } from '../lib/format.js';
import { staleness, useNow } from '../lib/time.js';
import { instrumentArt } from '../ui/assets.js';
import { BattleReports } from './BattleReports.jsx';
import { Reading } from '../ui/Clarity.js';
import { Note, Plate, Section, Segmented, Unreachable, Waiting } from '../ui/kit/index.js';
import type { IntelView } from '../api/schemas.js';

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
export function IntelScreen({
  onOpenOrbit,
  open,
}: {
  onOpenOrbit?: () => void;
  /**
   * WHICH LIST TO LAND ON, WHEN SOMETHING ELSE ALREADY KNOWS. D121.
   *
   * A battle-report notification used to open this screen on the PROBE list and
   * leave the reader to find the tab — the interface pointing at the right room
   * and then at the wrong shelf in it. `request` is a counter rather than a
   * boolean so a second notification still lands after the reader has moved off
   * the tab the first one opened.
   */
  open?: { stop: 'probes' | 'battles'; request: number };
}) {
  const { t } = useTranslation();
  const intel = useIntel();
  const planet = usePlanet();
  const galaxy = useGalaxy();
  const now = useNow(30_000);
  const [reportTab, setReportTab] = useState<'probes' | 'battles'>(open?.stop ?? 'probes');
  const requestedStop = open?.stop;
  const request = open?.request;
  useEffect(() => {
    if (requestedStop) setReportTab(requestedStop);
  }, [requestedStop, request]);


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
  const slots = telescopeSlots(telescope);

  return (
    <GameActions>
      <div className="flex flex-col gap-6 px-4 py-4">
      <Coverage
        seen={seen}
        slots={slots}
        neighbours={neighbours}
        telescope={telescope}
        radar={radar}
      />

      <Section
        label={t('intel.watching.heading')}
        aside={
          telescope > 0
            ? t('intel.watching.slotsUsed', { used: seen, total: slots })
            : undefined
        }
      >
        {telescope === 0 ? (
          <Instrument
            kind="telescope"
            art={instrumentArt('TELESCOPE', 1)}
            missing={t('intel.watching.missingNoTelescope')}
            gives={t('intel.watching.gives')}
            cost={t('intel.watching.costInstall')}
            {...(onOpenOrbit ? { onAct: onOpenOrbit, action: t('intel.openOrbit') } : {})}
          />
        ) : (
          <TelescopeRack slots={slots} watching={watching} />
        )}
        {telescope > 0 && watching.length === 0 && <Note>{t('intel.watching.costPoint')}</Note>}
        {watching.some((w) => w.reading.state === 'INTERMITTENT') && (
          <Note>{t('intel.watching.intermittent')}</Note>
        )}
      </Section>

      <Segmented
        role="tablist"
        label={t('intel.tabs.label')}
        segments={[
          { id: 'probes', label: t('intel.probes.heading') },
          { id: 'battles', label: t('reports.heading') },
        ]}
        value={reportTab}
        onSelect={setReportTab}
        tabId={(id) => `intel-tab-${id}`}
        panelId={(id) => `intel-panel-${id}`}
      />

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
            kind="probe"
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
          <Plate className="px-3 py-1">
            {probeReports.map((report) => (
              <div
                key={`${report.targetPlanetId}-${String(report.at.getTime())}`}
                className="border-b border-line-soft py-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="name text-bone">
                    {report.targetUsername}
                  </span>
                  <span className="truncate text-caption text-faint">{report.targetName}</span>
                  <span className="num text-label text-faint">
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
                <p className="num mt-2 text-label text-faint">
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
          </Plate>
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
            kind="radar"
            art={instrumentArt('RADAR', 1)}
            missing={t('intel.radar.missing')}
            gives={t('intel.radar.gives')}
            cost={t('intel.radar.cost')}
            {...(onOpenOrbit ? { onAct: onOpenOrbit, action: t('intel.openOrbit') } : {})}
          />
        ) : radarLog.length === 0 ? (
          <Plate className="p-3">
            <p className="text-body text-dim">{t('intel.radar.quiet', { level: radar })}</p>
          </Plate>
        ) : (
          <Plate className="px-3 py-1">
            {radarLog.map((scan) => (
              <div
                key={scan.at.getTime()}
                className="flex items-baseline justify-between gap-3 border-b border-line-soft py-3 last:border-b-0"
              >
                <span className="text-body text-bone">
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
                <span className="num shrink-0 text-label text-faint">
                  {staleness((now - scan.at.getTime()) / 60_000)}
                </span>
              </div>
            ))}
          </Plate>
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
    </GameActions>
  );
}

function TelescopeRack({
  slots,
  watching,
}: {
  slots: number;
  watching: IntelView['watching'];
}) {
  const { t } = useTranslation();
  return (
    <Plate className="grid gap-2 p-2">
      {Array.from({ length: slots }, (_, slot) => {
        const watch = watching.find((item) => item.slot === slot);
        return (
          <div
            key={slot}
            className={`relative min-h-16 rounded-chip border px-3 py-3 ${ watch ? 'border-crystal/25 bg-crystal/[0.04]' : 'border-dashed border-line bg-void/30' }`}
          >
            <span className="num absolute right-2.5 top-2 text-micro text-faint">
              {t('intel.watching.slotLabel', { slot: slot + 1 })}
            </span>
            {watch ? (
              <>
                <div className="flex items-baseline gap-2 pr-14">
                  <span className="name truncate text-bone">
                    {watch.ownerName}
                  </span>
                  <span className="truncate text-label text-faint">{watch.targetName}</span>
                </div>
                <div className="mt-2">
                  <Reading
                    status={watch.reading.status}
                    staleMinutes={watch.reading.staleMinutes}
                    etaMinutes={watch.reading.etaMinutes}
                    state={watch.reading.state}
                  />
                </div>
                {watch.reading.status === 'AWAY' && (
                  <p className="mt-1 text-label text-opportunity">{t('intel.watching.away')}</p>
                )}
              </>
            ) : (
              <div className="flex min-h-11 items-center gap-2 text-faint">
                <span aria-hidden className="grid size-7 place-items-center rounded-full border border-dashed border-line text-title">+</span>
                <span className="text-caption">{t('intel.watching.slotEmpty')}</span>
              </div>
            )}
          </div>
        );
      })}
    </Plate>
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
    <div className="plate mb-6 px-4 py-4">
      <p className="legend">{t('intel.coverage.label')}</p>
      <p className="mt-2 text-title leading-tight text-bone">
        {slots === 0
          ? t('intel.coverage.blind')
          : idle > 0
            ? t('intel.coverage.partial', { seen, count: slots })
            : t('intel.coverage.full')}
      </p>

      {slots > 0 && (
        <div className="mt-3 flex h-1.5 gap-1">
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`flex-1 rounded-cell ${i < seen ? 'bg-crystal' : 'bg-line'}`} />
          ))}
        </div>
      )}

      <p className="mt-3 text-caption leading-snug text-dim">
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
        <p className="mt-2 text-caption text-crystal">
          {t('intel.coverage.oneMore', { level: telescope + 1 })}
        </p>
      )}

      {radar === 0 && (
        <p className="mt-2 text-caption text-alloy">{t('intel.coverage.noRadar')}</p>
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
  kind,
  art,
  missing,
  gives,
  cost,
  action,
  onAct,
}: {
  kind: 'telescope' | 'radar' | 'probe';
  /** null where an instrument has no render of its own — the well just stays empty. */
  art: string | null;
  missing: string;
  gives: string;
  cost: string;
  action?: string;
  onAct?: () => void;
}) {
  return (
    <div className="plate group grid grid-cols-[104px_1fr] items-center gap-4 p-4">
      <InstrumentDiagram kind={kind} art={art} />
      <div className="min-w-0 flex-1">
        <p className="text-body text-alloy">{missing}</p>
        <p className="mt-1 text-body leading-snug text-bone">{gives}</p>
        <p className="mt-2 text-caption leading-relaxed text-dim">{cost}</p>
        {onAct && action && (
          <button type="button" className="slab slab-ghost mt-3 w-full" onClick={onAct}>
            {action}
            <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

function InstrumentDiagram({
  kind,
  art,
}: {
  kind: 'telescope' | 'radar' | 'probe';
  art: string | null;
}) {
  return (
    <div
      data-instrument-diagram={kind}
      data-art
      className="socket relative size-[104px] shrink-0 overflow-hidden rounded-control"
      aria-hidden
    >
      {kind === 'radar' && (
        <>
          <span className="absolute size-[88px] rounded-full border border-crystal/20" />
          <span className="absolute size-[62px] rounded-full border border-crystal/35" />
          <span className="absolute right-2 top-5 size-2 rotate-45 border border-alloy bg-alloy/35 shadow-[0_0_6px_var(--color-alloy)]" />
        </>
      )}
      {kind === 'telescope' && (
        <>
          <span className="absolute left-[54px] top-[18px] h-px w-11 -rotate-[28deg] bg-gradient-to-r from-crystal/70 to-transparent" />
          <span className="absolute right-2 top-2 size-3 rounded-full border border-crystal/60" />
          <span className="absolute bottom-2 right-2 flex gap-1">
            <i className="size-1.5 rounded-full bg-crystal" />
            <i className="size-1.5 rounded-full border border-crystal/50" />
            <i className="size-1.5 rounded-full border border-crystal/50" />
          </span>
        </>
      )}
      {kind === 'probe' && (
        <>
          <span className="absolute inset-x-3 top-1/2 border-t border-dashed border-opportunity/40" />
          <span className="absolute right-2 top-[47px] size-2 rotate-45 border-r border-t border-opportunity" />
        </>
      )}
      {art && <img src={art} alt="" className="relative z-[1] size-[88px] object-contain" />}
    </div>
  );
}

function Band({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="legend">{label}</dt>
      <dd className="num mt-1 text-body text-bone">{value}</dd>
    </div>
  );
}
