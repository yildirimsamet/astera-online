import { GameActions } from '../session/seasonLock.js';
import {
  GALAXY,
  PROBE,
  radarDetectsFleets,
  radarRange,
  sensorSphere,
  telescopeSlots,
} from '@astera/rules';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxy, useIntel, usePlanet } from '../api/queries.js';
import { full, percent } from '../lib/format.js';
import { staleness, useNow } from '../lib/time.js';
import { instrumentArt } from '../ui/assets.js';
import { BattleReports } from './BattleReports.jsx';
import { Reading } from '../ui/Clarity.js';
import { RangeBand } from '../ui/RangeBand.js';
import { Tally } from '../ui/Tally.js';
import { Bars, Note, Plate, Section, Segmented, Unreachable, Waiting } from '../ui/kit/index.js';
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
  open?: { stop: 'probes' | 'battles'; request: number; reportMissionId?: string };
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

  /**
   * TWO SCOPES ON ONE SCREEN, AND THEY USED TO BE MIXED. D97/D134.
   *
   * Telescope slots belong to a WORLD — the numbering restarts on each one — while
   * the watch list, the radar log and the probe history belong to the COMMANDER.
   * This screen read `planet.data` for the levels and the commander payload for
   * the lists, and then compared them:
   *
   *   · the rack drew `telescopeSlots(active)` rows and filled them by slot NUMBER,
   *     so a colony's slot 0 and the capital's slot 0 collided and one of the two
   *     watches was simply not on screen;
   *   · the tally read "3 of 1", because the numerator counted every world's
   *     watches and the denominator counted one world's sockets;
   *   · and coverage then called that "full", because `slots - seen` went negative.
   *
   * The active world's watches are what the rack draws, because a slot is a socket
   * on a world and the rack is a picture of sockets. Everything else on this screen
   * stays commander-wide, which is what it has always been.
   */
  const here = planet.data?.planet.id;
  const mine = watching.filter((w) => w.observerPlanetId === undefined || w.observerPlanetId === here);
  const seen = mine.length;
  const slots = telescopeSlots(telescope);

  /**
   * AND THE RADAR SECTION ANSWERS FOR EVERY WORLD, because the log now does.
   *
   * It was gated on the ACTIVE world's radar level while showing the CAPITAL's
   * log, so a Radar 5 capital's history could sit behind a "you have no Radar"
   * card belonging to a colony. `detect` is published per owned world on the
   * galaxy payload and is above zero exactly when that world has a working radar.
   */
  const anyRadar = radar > 0 || (galaxy.data?.sensors ?? []).some((post) => post.detect > 0);

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
            ? (
              <Tally
                used={seen}
                total={slots}
                size="sm"
                label={t('intel.watching.slotsUsed', { used: seen, total: slots })}
              />
            )
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
          <TelescopeRack slots={slots} watching={mine} />
        )}
        {telescope > 0 && mine.length === 0 && <Note>{t('intel.watching.costPoint')}</Note>}
        {mine.some((w) => w.reading.state === 'INTERMITTENT') && (
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
                {/*
                  THE DOUBT IS THE PRODUCT, SO THE DOUBT IS THE PICTURE. D127,
                  and the owner's instruction.

                  These were three `1.2k–3.4k` strings under three grey labels —
                  the intel layer's entire output, printed as six figures the
                  reader has to pair up, subtract and then weigh. `RangeBand` draws
                  each reading as the span it actually is, so a clean probe of a
                  world with its fleet at home is three narrow blocks and a poor
                  one smears across the card. That comparison is what the whole
                  Telescope ladder is being sold on, and it was nowhere on screen.
                */}
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <RangeBand
                    label={t('intel.probes.stock')}
                    low={report.stock.low}
                    high={report.stock.high}
                    tone="alloy"
                  />
                  <RangeBand
                    label={t('intel.probes.defence')}
                    low={report.defence.low}
                    high={report.defence.high}
                    tone="threat"
                  />
                  <RangeBand
                    label={t('intel.probes.ships')}
                    low={report.fleetSize.low}
                    high={report.fleetSize.high}
                  />
                </div>
                {/*
                  HOW GOOD THE READ WAS, IN THE SAME BARS THE TELESCOPE USES.

                  A percentage is a figure about a figure. Signal bars are already
                  this game's word for "how much is this reading worth" — the
                  clarity strip on every watched world — so the probe borrows them
                  rather than inventing a second vocabulary for the same idea. The
                  percentage stays as the accessible name, where a number is the
                  only thing that can be said.
                */}
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={report.fleetHome ? 'text-crystal' : 'text-alloy'}
                    role="img"
                    aria-label={t(
                      report.fleetHome ? 'intel.probes.accuracyHome' : 'intel.probes.accuracyOut',
                      { percent: percent(report.accuracy) },
                    )}
                  >
                    <Bars lit={Math.max(1, Math.round(report.accuracy * 5))} />
                  </span>
                  <span className="text-label text-faint">
                    {t(report.fleetHome ? 'intel.probes.homeTag' : 'intel.probes.outTag')}
                  </span>
                  {report.detected && (
                    <span className="ml-auto text-label text-threat">
                      {t('intel.probes.caught')}
                    </span>
                  )}
                </div>
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
        <BattleReports
          {...(open?.reportMissionId
            ? { open: { missionId: open.reportMissionId, request: open.request } }
            : {})}
        />
      </div>

      <Section
        label={t('intel.radar.heading')}
        aside={radar > 0 ? t('intel.radar.level', { level: radar }) : undefined}
      >
        {!anyRadar ? (
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
                key={`${scan.planetId ?? ''}-${String(scan.at.getTime())}`}
                className="flex items-baseline justify-between gap-3 border-b border-line-soft py-3 last:border-b-0"
              >
                <span className="text-body text-bone">
                  {t('intel.radar.scan')}
                  {/*
                    WHICH WORLD WAS SCANNED. The log covers every world a commander
                    holds now, and "somebody scanned you" without saying WHERE is
                    unusable the moment there is more than one.
                  */}
                  {scan.planetName !== undefined && (
                    <span className="text-crystal">
                      {t('intel.radar.onWorld', { planet: scan.planetName })}
                    </span>
                  )}
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
        {/*
          A REACH, NOT A COUNTDOWN — AND NOW A REACH YOU CAN SEE. D49, D126, and
          principle 10: a rule the player cannot SEE is not a rule.

          This was two sentences carrying three raw figures — "level 4 · senses at
          1500 · warns at 360" — against a galaxy whose radius is 2000 and appears
          nowhere. Nobody can turn that into a picture of their own neighbourhood,
          which is the only form in which those numbers mean anything.

          `RadarReach` derives detection through the authoritative sensor sphere
          and draws it against the timed-warning radius. They are one circle while
          D126's provisional merge holds; the component exposes the gap again if
          the tables are deliberately split.
        */}
        {radarDetectsFleets(radar) && (
          <RadarReach
            sense={sensorSphere({ x: 0, y: 0, z: 0 }, 0, radar).detect}
            warn={radarRange(radar)}
            level={radar}
          />
        )}
        {radar > 0 && (
          <Note>
            {radarDetectsFleets(radar) && t('intel.radar.noteSlow')}
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

      {/*
        THE SAME RACK THE REST OF THE GAME DRAWS. This was a hand-rolled row of
        cells that happened to look like `Tally` and could drift from it; a
        telescope's slots, a world's flight bays and a Core's orbit sockets are
        one fact — places, some of them taken — and they are now one component.
      */}
      {slots > 0 && (
        <div className="mt-3">
          <Tally
            used={seen}
            total={slots}
            label={t('intel.watching.slotsUsed', { used: seen, total: slots })}
          />
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
 * THE RADAR VOLUME, AT ITS TRUE SIZE AGAINST THE DISC. D126.
 *
 * Detection and timed warning are provisionally one circle. The code still reads
 * both authoritative products and will draw the detection ring separately if
 * D126 is deliberately split again.
 *
 * SCALED AGAINST THE GALAXY'S RADIUS, which is what makes it worth drawing at
 * all. Radar 5 reaches 2,200 against a radius-2,000 disc; drawing it against the
 * rim makes the current full-neighbourhood warning cost visible instead of hiding
 * it in a sentence.
 *
 * THE FIGURES STAY, SMALL AND BESIDE THEIR OWN RING. A player planning a defence
 * eventually wants the number; they never want it first.
 */
function RadarReach({ sense, warn, level }: { sense: number; warn: number; level: number }) {
  const { t } = useTranslation();
  /*
    THE DISC'S RADIUS IS THE DENOMINATOR, not the widest crossing. A commander
    sits somewhere in the disc and looks outward from there, so the honest
    comparison for "how far can I see" is the radius.
  */
  const reach = (value: number): number =>
    Math.max(4, Math.min(100, (value / GALAXY.radius) * 100));
  const senseSize = reach(sense);
  const warnSize = reach(warn);
  /**
   * ONE CIRCLE OR TWO, DECIDED BY THE TABLES RATHER THAN BY A FLAG.
   *
   * The two radar circles are temporarily one number, and drawing two identical
   * rings on top of each other with two captions describing different things
   * would be the interface inventing a distinction the rules no longer make.
   * Reading it off the figures means this surface is already correct on the day
   * they are split again — no second edit, no chance of forgetting.
   */
  const merged = sense === warn;

  return (
    <div className="plate flex items-center gap-4 p-4">
      <div
        data-radar-reach
        className="socket relative size-[112px] shrink-0 rounded-control"
        role="img"
        aria-label={t(
          merged ? 'intel.radar.noteFleetsOne' : 'intel.radar.noteFleets',
          { level, sense, warn },
        )}
      >
        {/* THE RIM OF THE GALAXY. Everything else is measured against it. */}
        <span className="absolute inset-1 rounded-full border border-line" />
        {!merged && (
          <span
            data-ring="sense"
            className="absolute rounded-full border border-dashed border-crystal/45"
            style={{ width: `${String(senseSize)}%`, height: `${String(senseSize)}%` }}
          />
        )}
        <span
          data-ring="warn"
          className="absolute rounded-full border border-crystal bg-crystal/[0.07] shadow-[0_0_10px_var(--color-crystal-glow)]"
          style={{ width: `${String(warnSize)}%`, height: `${String(warnSize)}%` }}
        />
        {/* YOU, at the centre of both. */}
        <span className="absolute size-1.5 rounded-full bg-bone shadow-[0_0_6px_var(--color-bone)]" />
      </div>

      {/*
        TWO LINES, EACH TIED TO ITS OWN RING BY THE SAME MARK THE RING WEARS.
        The dashed swatch is the dashed circle; the solid one with the clock is
        the circle with the clock. Nothing here needs the paragraph it replaced.
      */}
      <dl className="flex min-w-0 flex-1 flex-col gap-3">
        {!merged && (
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-3 shrink-0 rounded-full border border-dashed border-crystal/45" />
          <dt className="min-w-0 flex-1 truncate text-caption text-dim">
            {t('intel.radar.ringSense')}
          </dt>
          <dd className="num shrink-0 text-label text-faint">{sense}</dd>
        </div>
        )}
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-3 shrink-0 rounded-full border border-crystal bg-crystal/20" />
          <dt className="min-w-0 flex-1 truncate text-caption text-bone">
            {t(merged ? 'intel.radar.ringOne' : 'intel.radar.ringWarn')}
          </dt>
          <dd className="num shrink-0 text-label text-crystal">{warn}</dd>
        </div>
      </dl>
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
