import { GameActions } from '../session/seasonLock.js';
import {
  GALAXY,
  PROBE,
  RIVAL,
  radarDetectsFleets,
  radarRange,
  sensorSphere,
  telescopeSlots,
} from '@astera/rules';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxy, useIntel, usePlanet } from '../api/queries.js';
import { probeAxis, yardstickOf, type Yardstick } from '../lib/probeScale.js';
import type { IntelView } from '../api/schemas.js';
import { rivalColour } from '../galaxy/PlanetField.js';
import { compact, full, percent } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { instrumentArt, planetArt } from '../ui/assets.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { Icon } from '../v2/icons.js';
import { AgeStamp, AgedThumb, ClarityMark } from '../v2/kit/Freshness.js';
import { Segmented } from '../v2/kit/Segmented.js';
import { SignalBars } from '../v2/kit/SignalBars.js';
import { BattleReports, type ReportDoors } from './BattleReports.jsx';

/**
 * WHAT YOU KNOW — AND, MORE IMPORTANTLY, WHAT YOU DO NOT. D4 (owner, 2026-09-24),
 * spec E7, B7, K11; the mock is `design-mocks/image copy 6.png`, right ("gözlem defteri").
 *
 * Three shelves, because a player comes here with three different questions:
 *
 *   · WATCH — who am I looking at, and what do I know about everyone. The Telescope
 *     rack as sockets, the rivals marked on the galaxy, then one list of every world
 *     known: a live reading wears its clarity (bars), a probe reading its age (grain,
 *     "4h ago") — the two never share a mark (K11). An away fleet is an opportunity,
 *     so it gets a window chip with the time it has.
 *   · REPORTS — the probe and battle lists this screen always had.
 *   · RADAR — who is looking at ME: the reach, the day's scans on a line, the log.
 *
 * Empty states stay the most valuable real estate in the game: each names the
 * instrument that would fill it and what it would tell the player.
 */

type Shelf = 'watch' | 'reports' | 'radar';
type Stop = 'probes' | 'battles';

/** A marked rival as the menu resolves it (`rivalMenuRows`): the commander, found on the disc. */
export interface RivalRow {
  planetId: string;
  slot: number;
  owner: string;
  name: string;
  /** None of that commander's worlds is on this disc: nowhere to take you. */
  lost: boolean;
}

type Watch = IntelView['watching'][number];
type Probe = IntelView['probeReports'][number];
type Scan = IntelView['radarLog'][number];

const HEADING = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';
const CARD = 'rounded-control border border-v2-line bg-v2-panel';
const HOUR = 60 * 60_000;

/** The reading as a word, one translated string per state (Turkish reads FİLO EVDE). */
const FLEET_WORD = {
  HOME: 'clarity.fleetHome',
  AWAY: 'clarity.fleetAway',
  UNKNOWN: 'clarity.unreadable',
} as const;

export function IntelScreen({
  onOpenOrbit,
  open,
  rivals = [],
  onFocusRival,
  onOpenDossier,
  ...doors
}: {
  onOpenOrbit?: () => void;
  /**
   * WHICH LIST TO LAND ON, WHEN SOMETHING ELSE ALREADY KNOWS. D121.
   *
   * A battle-report notification opens the Reports shelf on the battle list. `request`
   * is a counter rather than a boolean so a second notification still lands after the
   * reader has moved off the shelf the first one opened.
   */
  open?: { stop: Stop; request: number; reportMissionId?: string };
  /** The rivals marked on the galaxy, resolved against the disc. */
  rivals?: readonly RivalRow[];
  /** Takes the player to a marked rival on the galaxy. */
  onFocusRival?: (planetId: string) => void;
  /** Opens a world's dossier on the galaxy. */
  onOpenDossier?: (planetId: string) => void;
} & Omit<ReportDoors, 'onAttackAgain'>) {
  const { t } = useTranslation();
  const intel = useIntel();
  const planet = usePlanet();
  const galaxy = useGalaxy();
  const now = useNow(30_000);
  const [shelf, setShelf] = useState<Shelf>(open ? 'reports' : 'watch');
  const [stop, setStop] = useState<Stop>(open?.stop ?? 'probes');
  const requestedStop = open?.stop;
  const request = open?.request;
  useEffect(() => {
    if (!requestedStop) return;
    setShelf('reports');
    setStop(requestedStop);
  }, [requestedStop, request]);

  // An error leaves `data` undefined but is not a load in progress, and a pulse over a
  // dead request is the interface lying.
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
   * TWO SCOPES ON ONE SCREEN. D97/D134. A telescope SLOT belongs to a world — the
   * numbering restarts on each one — so the rack draws the active world's watches.
   * What you KNOW belongs to the commander, so the list below it is every watch.
   */
  const here = planet.data?.planet.id;
  const mine = watching.filter((w) => w.observerPlanetId === undefined || w.observerPlanetId === here);
  const slots = telescopeSlots(telescope);

  /**
   * THE RADAR ANSWERS FOR EVERY WORLD, because the log does: `detect` is published per
   * owned world and is above zero exactly when that world has a working radar.
   */
  const anyRadar = radar > 0 || (galaxy.data?.sensors ?? []).some((post) => post.detect > 0);

  return (
    <GameActions>
      <div className="flex flex-col gap-3 px-3 py-3 font-v2-ui">
        <Segmented
          label={t('intel.shelf.label')}
          options={[
            { id: 'watch', label: t('intel.shelf.watch') },
            { id: 'reports', label: t('intel.shelf.reports') },
            { id: 'radar', label: t('intel.shelf.radar') },
          ]}
          value={shelf}
          onChange={setShelf}
          tabId={(id) => `intel-shelf-${id}`}
        />

        {shelf === 'watch' && (
          <div role="tabpanel" aria-labelledby="intel-shelf-watch" className="flex flex-col gap-3">
            <TelescopeShelf
              telescope={telescope}
              slots={slots}
              mine={mine}
              neighbours={neighbours}
              radar={radar}
              {...(onOpenOrbit ? { onOpenOrbit } : {})}
            />
            <Rivals rivals={rivals} {...(onFocusRival ? { onFocusRival } : {})} />
            <Known watching={watching} probes={probeReports} now={now} />
            {anyRadar && (
              <RadarGlance
                scans={radarLog}
                now={now}
                onOpen={() => {
                  setShelf('radar');
                }}
              />
            )}
          </div>
        )}

        {shelf === 'reports' && (
          <div role="tabpanel" aria-labelledby="intel-shelf-reports" className="flex flex-col gap-3">
            <Segmented
              label={t('intel.tabs.label')}
              options={[
                { id: 'probes', label: t('intel.probes.heading') },
                { id: 'battles', label: t('reports.heading') },
              ]}
              value={stop}
              onChange={setStop}
              tabId={(id) => `intel-tab-${id}`}
            />
            <div role="tabpanel" aria-labelledby="intel-tab-probes" hidden={stop !== 'probes'}>
              <ProbeShelf
                probes={probeReports}
                now={now}
                yours={planet.data ? yardstickOf(planet.data) : null}
                {...(onOpenDossier ? { onOpenDossier } : {})}
              />
            </div>
            <div role="tabpanel" aria-labelledby="intel-tab-battles" hidden={stop !== 'battles'}>
              <BattleReports
                {...(open?.reportMissionId
                  ? { open: { missionId: open.reportMissionId, request: open.request } }
                  : {})}
                /* A report's "Attack again" is the raided world's dossier (E6), as from a notification. */
                {...(onOpenDossier ? { onAttackAgain: onOpenDossier } : {})}
                {...doors}
              />
            </div>
          </div>
        )}

        {shelf === 'radar' && (
          <div role="tabpanel" aria-labelledby="intel-shelf-radar" className="flex flex-col gap-3">
            <RadarShelf radar={radar} anyRadar={anyRadar} scans={radarLog} now={now} {...(onOpenOrbit ? { onOpenOrbit } : {})} />
          </div>
        )}
      </div>
    </GameActions>
  );
}

/** A heading with its rule and, on the right, a count or a door. */
function Band({ label, aside }: { label: string; aside?: ReactNode }) {
  return (
    <p className={`flex items-center gap-2 ${HEADING}`}>
      {label}
      <span aria-hidden="true" className="h-px flex-1 bg-v2-line" />
      {aside}
    </p>
  );
}

/* ── watch ───────────────────────────────────────────────────── */

/**
 * THE TELESCOPE AS SOCKETS, MEASURED AGAINST WHAT YOU OWN. Owner-reported: "Watching 2
 * of 47" was a progress bar toward a goal the game does not have. The denominator is
 * the slot count; the size of the galaxy is the reason a slot is a decision, said only
 * once every slot is spent. The next socket is drawn locked where the very next level
 * adds one (D18 slots at L1, L3, L5; D36: no unchanged before-and-after).
 */
function TelescopeShelf({
  telescope,
  slots,
  mine,
  neighbours,
  radar,
  onOpenOrbit,
}: {
  telescope: number;
  slots: number;
  mine: readonly Watch[];
  neighbours: number;
  radar: number;
  onOpenOrbit?: () => void;
}) {
  const { t } = useTranslation();
  const seen = mine.length;
  const idle = Math.max(0, slots - seen);
  const next = slots > 0 && telescopeSlots(telescope + 1) > slots ? telescope + 1 : null;

  return (
    <section className="flex flex-col gap-2">
      <Band
        label={t('intel.watching.heading')}
        aside={slots > 0 ? <span className="font-v2-mono normal-case tracking-normal">{`${String(seen)}/${String(slots)}`}</span> : undefined}
      />
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
        <div data-telescope-rack className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: slots }, (_, slot) => {
            const watch = mine.find((item) => item.slot === slot);
            const label = t('intel.watching.slotLabel', { slot: slot + 1 });
            return watch ? (
              <div
                key={slot}
                data-slot={slot + 1}
                title={label}
                className={`flex min-w-0 flex-col items-center gap-1 px-1 py-1.5 ${CARD}`}
              >
                <AgedThumb src={planetArt(watch.targetPlanetId)} alt="" clarity={watch.reading.state} className="size-8" />
                <span className="w-full truncate text-center text-micro text-v2-ink">{watch.targetName}</span>
              </div>
            ) : (
              <div
                key={slot}
                data-slot={slot + 1}
                title={label}
                className="flex min-w-0 flex-col items-center gap-1 rounded-control border border-dashed border-v2-line-hi px-1 py-1.5 text-v2-ink-3"
              >
                <span aria-hidden="true" className="grid size-8 place-items-center text-body">+</span>
                <span className="w-full truncate text-center text-micro">{t('intel.watching.slotEmpty')}</span>
              </div>
            );
          })}
          {next !== null && (
            <div
              data-slot-next
              title={t('intel.coverage.oneMore', { level: next })}
              className="flex min-w-0 flex-col items-center gap-1 rounded-control border border-v2-line px-1 py-1.5 text-v2-ink-3 opacity-70"
            >
              <span className="grid size-8 place-items-center"><Icon id="i-lock" className="size-4" /></span>
              <span className="w-full truncate text-center text-micro">{t('intel.watching.nextSlot', { level: next })}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <p className="text-caption text-v2-ink">
          {slots === 0
            ? t('intel.coverage.blind')
            : idle > 0
              ? t('intel.coverage.partial', { seen, count: slots })
              : t('intel.coverage.full')}
        </p>
        <p className="text-micro leading-snug text-v2-ink-3">
          {slots === 0
            ? t('intel.coverage.blindHint')
            : idle > 0
              ? t('intel.coverage.idleHint', { count: idle })
              : t('intel.coverage.scarcity', { neighbours, count: slots })}
        </p>
        {radar === 0 && <p className="text-micro leading-snug text-v2-warn">{t('intel.coverage.noRadar')}</p>}
        {mine.some((w) => w.reading.state === 'INTERMITTENT') && (
          <p className="text-micro leading-snug text-v2-ink-3">{t('intel.watching.intermittent')}</p>
        )}
      </div>
    </section>
  );
}

/**
 * THE RIVALS YOU MARKED ON THE GALAXY, by slot and in the slot's own colour — the same
 * colour the disc draws their reticle in. A chip takes you to them; a mark whose
 * commander is off the disc stays a name, because it has nowhere to go.
 */
function Rivals({ rivals, onFocusRival }: { rivals: readonly RivalRow[]; onFocusRival?: (planetId: string) => void }) {
  const { t } = useTranslation();
  return (
    <section data-rivals className="flex flex-col gap-2">
      <Band
        label={t('intel.rivals.heading')}
        aside={<span className="font-v2-mono normal-case tracking-normal">{`${String(rivals.length)} / ${String(RIVAL.max)}`}</span>}
      />
      {rivals.length === 0 ? (
        <p className="text-micro leading-snug text-v2-ink-3">{t('intel.rivals.none')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rivals.map((rival) => {
            const colour: CSSProperties = { color: rivalColour(rival.slot), borderColor: rivalColour(rival.slot) };
            const text = `${String(rival.slot + 1)} · ${rival.lost ? t('intel.rivals.lost') : rival.owner || rival.name}`;
            return rival.lost || !onFocusRival ? (
              <span key={rival.slot} className="rounded-chip border px-2 py-1 text-micro font-semibold opacity-60" style={colour}>
                {text}
              </span>
            ) : (
              <button
                key={rival.slot}
                type="button"
                onClick={() => { onFocusRival(rival.planetId); }}
                className="rounded-chip border px-2 py-1 text-micro font-semibold"
                style={colour}
              >
                {text}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * EVERYTHING YOU KNOW, ONE LIST. Live readings first (clarity bars), then what probes
 * brought back and no Telescope is watching (age as grain and "Xh ago") — K11: the two
 * reliabilities never share a mark. The rule is one tap deeper.
 */
function Known({ watching, probes, now }: { watching: readonly Watch[]; probes: readonly Probe[]; now: number }) {
  const { t } = useTranslation();
  const [legend, setLegend] = useState(false);
  const watched = new Set(watching.map((w) => w.targetPlanetId));
  const read = new Set<string>();
  const probed = probes.filter((report) => {
    if (watched.has(report.targetPlanetId) || read.has(report.targetPlanetId)) return false;
    read.add(report.targetPlanetId);
    return true;
  });

  return (
    <section className="flex flex-col gap-1.5">
      <Band
        label={t('intel.known.heading')}
        aside={(
          <button
            type="button"
            aria-expanded={legend}
            onClick={() => { setLegend((shown) => !shown); }}
            className="normal-case tracking-normal text-v2-self"
          >
            {t('intel.known.legendToggle')} ›
          </button>
        )}
      />
      {legend && <p data-known-legend className="text-micro leading-snug text-v2-ink-2">{t('intel.known.legend')}</p>}
      {watching.length === 0 && probed.length === 0 ? (
        <p className="text-micro leading-snug text-v2-ink-3">{t('intel.known.empty')}</p>
      ) : (
        <ul data-known-list className="divide-y divide-v2-line">
          {watching.map((watch) => <KnownWatch key={`${watch.observerPlanetId ?? ''}-${String(watch.slot)}`} watch={watch} />)}
          {probed.map((report) => (
            <KnownProbe key={report.targetPlanetId} report={report} minutes={(now - report.at.getTime()) / 60_000} />
          ))}
        </ul>
      )}
    </section>
  );
}

function KnownWatch({ watch }: { watch: Watch }) {
  const { t } = useTranslation();
  const { status, state, staleMinutes, etaMinutes } = watch.reading;
  // E7: an away fleet is the opportunity, and its window is timed only when the reading says so.
  const window = status === 'AWAY' && etaMinutes !== null;
  return (
    <li data-known="watch" className="flex items-center gap-2.5 py-2">
      <AgedThumb src={planetArt(watch.targetPlanetId)} alt="" clarity={state} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-caption font-semibold text-v2-ink">{watch.ownerName}</span>
          <span className={`shrink-0 text-micro uppercase tracking-wide ${status === 'AWAY' ? 'text-v2-self' : 'text-v2-ink-2'}`}>
            {t(FLEET_WORD[status])}
          </span>
        </p>
        <p className="truncate text-micro text-v2-ink-3">
          {watch.targetName} · {t('intel.known.telescope')} · {staleness(staleMinutes)}
        </p>
      </div>
      {window ? (
        <span data-window className="shrink-0 rounded-chip border border-v2-self/60 bg-v2-self/10 px-2 py-0.5 text-micro font-semibold text-v2-self">
          {t('intel.known.window', { duration: duration(etaMinutes) })}
        </span>
      ) : (
        <ClarityMark state={state} />
      )}
    </li>
  );
}

function KnownProbe({ report, minutes }: { report: Probe; minutes: number }) {
  const { t } = useTranslation();
  return (
    <li data-known="probe" className="flex items-center gap-2.5 py-2">
      <AgedThumb src={planetArt(report.targetPlanetId)} alt="" ageMinutes={minutes} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-semibold text-v2-ink">{report.targetUsername}</p>
        <p className="truncate text-micro text-v2-ink-3">
          {report.targetName} · {t('intel.known.probe')} · {t(report.fleetHome ? 'intel.probes.homeTag' : 'intel.probes.outTag')}
        </p>
      </div>
      <AgeStamp minutes={minutes} />
    </li>
  );
}

/** The radar, glanced from the watch shelf: the day's contacts on a line, one tap to the log. */
function RadarGlance({ scans, now, onOpen }: { scans: readonly Scan[]; now: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const today = scans.filter((scan) => now - scan.at.getTime() <= 24 * HOUR).length;
  return (
    <button type="button" data-radar-glance onClick={onOpen} className={`flex flex-col gap-1.5 px-3 py-2.5 text-left ${CARD}`}>
      <span className="flex items-center justify-between gap-2">
        <span className={HEADING}>{t('intel.radar.glance')}</span>
        <span className="text-micro text-v2-ink-2">{t('intel.radar.contacts', { count: today })} ›</span>
      </span>
      <DayLine scans={scans} now={now} />
    </button>
  );
}

/**
 * THE LAST TWENTY-FOUR HOURS AS A LINE, one tick per scan. A scan in the last six hours
 * is a live threat to you and is red (K2: red only for what can harm you); an older
 * one is history.
 */
function DayLine({ scans, now }: { scans: readonly Scan[]; now: number }) {
  const { t } = useTranslation();
  const start = now - 24 * HOUR;
  return (
    <span className="flex flex-col gap-0.5">
      <span aria-hidden="true" className="relative block h-5">
        <span className="absolute inset-x-0 top-1/2 h-px bg-v2-line-hi" />
        {scans
          .filter((scan) => scan.at.getTime() >= start && scan.at.getTime() <= now)
          .map((scan) => (
            <span
              key={`${scan.planetId ?? ''}-${String(scan.at.getTime())}`}
              data-scan-tick=""
              className={`absolute top-0.5 h-4 w-0.5 -translate-x-1/2 rounded-full ${fresh(scan, now) ? 'bg-v2-hostile' : 'bg-v2-ink-3'}`}
              style={{ left: `${String(((scan.at.getTime() - start) / (24 * HOUR)) * 100)}%` }}
            />
          ))}
      </span>
      <span className="flex justify-between font-v2-mono text-micro text-v2-ink-3">
        <span>{t('intel.radar.dayAgo')}</span>
        <span>{t('intel.radar.now')}</span>
      </span>
    </span>
  );
}

const fresh = (scan: Scan, now: number): boolean => now - scan.at.getTime() < 6 * HOUR;

/* ── reports ─────────────────────────────────────────────────── */

/**
 * WHAT A PROBE BROUGHT BACK. The doubt is the product, so the doubt is the picture
 * (D127): each reading is drawn as the span it is. Owner, round 2: no grey bars — a
 * reading taken with the fleet at home is sharp and wears the full colour; one taken
 * with the fleet out is lighter, because a fleet away is a fleet not counted.
 */
function ProbeShelf({ probes, now, yours, onOpenDossier }: {
  probes: readonly Probe[];
  now: number;
  /** Your active world, measured as a probe measures; null until it has loaded. */
  yours: Yardstick | null;
  onOpenDossier?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  if (probes.length === 0) {
    return (
      <Instrument
        kind="probe"
        art="/assets/images/ships/explorer_ship.png"
        missing={t('intel.probes.missing')}
        gives={t('intel.probes.gives')}
        // THE PRICE COMES FROM THE RULE, NOT FROM THE SENTENCE. D59.
        cost={t('intel.probes.cost', { alloy: full(PROBE.alloy), crystal: full(PROBE.crystal) })}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-micro leading-snug text-v2-ink-3">
        {t('intel.probes.estimateNote')} {yours !== null && t('intel.probes.scaleNote')}
      </p>
      {probes.map((report) => {
        const minutes = (now - report.at.getTime()) / 60_000;
        const accuracy = t(report.fleetHome ? 'intel.probes.accuracyHome' : 'intel.probes.accuracyOut', {
          percent: percent(report.accuracy),
        });
        return (
          <article key={`${report.targetPlanetId}-${String(report.at.getTime())}`} className={`flex flex-col gap-2 p-3 ${CARD}`}>
            <div className="flex items-center gap-2.5">
              <AgedThumb src={planetArt(report.targetPlanetId)} alt="" ageMinutes={minutes} />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate text-caption font-semibold text-v2-ink">{report.targetUsername}</span>
                  <span className="truncate text-micro text-v2-ink-3">{report.targetName}</span>
                </p>
                <p className="text-micro text-v2-ink-2">{accuracy}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <SignalBars accuracy={report.accuracy} label={accuracy} />
                <AgeStamp minutes={minutes} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <RangeRow label={t('intel.probes.stock')} low={report.stock.low} high={report.stock.high} sharp={report.fleetHome} mine={yours?.stock ?? null} />
              <RangeRow label={t('intel.probes.defence')} low={report.defence.low} high={report.defence.high} sharp={report.fleetHome} mine={yours?.defence ?? null} />
              <RangeRow label={t('intel.probes.ships')} low={report.fleetSize.low} high={report.fleetSize.high} sharp={report.fleetHome} mine={yours?.ships ?? null} />
            </div>
            {(report.detected || onOpenDossier) && (
              <div className="flex items-center justify-between gap-2">
                {/* Being caught is the cost of looking: a gap to plan around, said in warn. */}
                <span className="text-micro text-v2-warn">{report.detected ? t('intel.probes.caught') : ''}</span>
                {onOpenDossier && (
                  <button
                    type="button"
                    onClick={() => { onOpenDossier(report.targetPlanetId); }}
                    className="text-micro font-semibold text-v2-self"
                  >
                    {t('intel.probes.openDossier')} ›
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

const BLURRED: CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--color-v2-neutral) 45%, transparent)' };

/**
 * ONE READING ON A NUMBER LINE, WITH YOU ON IT. Owner, 2026-09-24: "neye göre sağa, neye
 * göre ortada, neye göre sola yaslanıyor anlaşılmıyor" — each row was scaled to its own
 * top, so every band touched the right edge and nothing on it was comparable.
 *
 * Now the line starts at zero and runs to the larger of the reading and YOUR world's same
 * measure (`probeAxis`, `yardstickOf`): the band is their estimate in the colour of a world
 * that is not yours, the teal line is you (K2). Left of the line is smaller than yours,
 * right of it bigger — the comparison a raid is decided on. A band keeps a floor, because a
 * perfect read is zero wide and a zero-width band is no picture.
 */
function RangeRow({ label, low, high, sharp, mine }: { label: string; low: number; high: number; sharp: boolean; mine: number | null }) {
  const { t } = useTranslation();
  const { start, width, you } = probeAxis(low, high, mine);
  const reading = t('rangeBand.reading', { label, low: compact(Math.max(0, low)), high: compact(high) });
  return (
    <div data-range-band className="grid grid-cols-[5rem_minmax(0,1fr)_4.75rem] items-center gap-2">
      <span className="truncate text-micro text-v2-ink-3">{label}</span>
      <span
        role="img"
        aria-label={mine === null ? reading : `${reading} · ${t('rangeBand.yours', { value: compact(mine) })}`}
        className="relative block h-2.5"
      >
        {/* The axis: a hairline from zero, not a grey bar. */}
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-v2-line-hi" />
        <span
          data-part="band"
          className={`absolute inset-y-0.5 rounded-full ${sharp ? 'bg-v2-neutral' : ''}`}
          style={{ left: `${String(start)}%`, width: `${String(width)}%`, ...(sharp ? {} : BLURRED) }}
        />
        {you !== null && (
          <span
            data-you=""
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-v2-self"
            style={{ left: `${String(you)}%` }}
          />
        )}
      </span>
      <span className="truncate text-right font-v2-mono text-micro text-v2-ink-2">{`${compact(Math.max(0, low))}–${compact(high)}`}</span>
    </div>
  );
}

/* ── radar ───────────────────────────────────────────────────── */

function RadarShelf({
  radar,
  anyRadar,
  scans,
  now,
  onOpenOrbit,
}: {
  radar: number;
  anyRadar: boolean;
  scans: readonly Scan[];
  now: number;
  onOpenOrbit?: () => void;
}) {
  const { t } = useTranslation();
  if (!anyRadar) {
    return (
      <Instrument
        kind="radar"
        art={instrumentArt('RADAR', 1)}
        missing={t('intel.radar.missing')}
        gives={t('intel.radar.gives')}
        cost={t('intel.radar.cost')}
        {...(onOpenOrbit ? { onAct: onOpenOrbit, action: t('intel.openOrbit') } : {})}
      />
    );
  }
  const today = scans.filter((scan) => now - scan.at.getTime() <= 24 * HOUR).length;
  return (
    <>
      {/*
        A REACH, NOT A COUNTDOWN — AND A REACH YOU CAN SEE. D49, D126: the rings at their
        true fraction of the disc; the half no picture can draw (a slow fleet is seen for
        longer) stays a sentence.
      */}
      {radarDetectsFleets(radar) && (
        <RadarReach
          sense={sensorSphere({ x: 0, y: 0, z: 0 }, 0, radar).detect}
          warn={radarRange(radar)}
          level={radar}
        />
      )}
      {radar > 0 && (
        <p className="text-micro leading-snug text-v2-ink-2">
          {radarDetectsFleets(radar) && t('intel.radar.noteSlow')}
          {radar < 2 && t('intel.radar.noteBearing')}
          {radar >= 2 && radar < 5 && t('intel.radar.noteOrigin')}
        </p>
      )}
      <section className={`flex flex-col gap-1.5 px-3 py-2.5 ${CARD}`}>
        <p className="flex items-center justify-between gap-2">
          <span className={HEADING}>{t('intel.radar.day')}</span>
          <span className="text-micro text-v2-ink-2">{t('intel.radar.contacts', { count: today })}</span>
        </p>
        <DayLine scans={scans} now={now} />
      </section>
      {scans.length === 0 ? (
        <p className="text-caption text-v2-ink-2">{t('intel.radar.quiet', { level: radar })}</p>
      ) : (
        <ul className="divide-y divide-v2-line">
          {scans.map((scan) => (
            <li key={`${scan.planetId ?? ''}-${String(scan.at.getTime())}`} data-scan className="flex items-center gap-2.5 py-2">
              <span
                data-scan-dot=""
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${fresh(scan, now) ? 'bg-v2-hostile' : 'bg-v2-ink-3'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption text-v2-ink">
                  {t('intel.radar.scan')}
                  {/* WHICH WORLD: the log covers every world a commander holds. */}
                  {scan.planetName !== undefined && (
                    <span className="text-v2-self">{t('intel.radar.onWorld', { planet: scan.planetName })}</span>
                  )}
                </p>
                {(scan.bearing !== null || scan.originPlanetName !== null) && (
                  <p className="truncate text-micro text-v2-ink-3">
                    {scan.bearing && t('intel.radar.bearing', { bearing: scan.bearing })}
                    {scan.originPlanetName && (
                      <span className="text-v2-ink">{t('intel.radar.origin', { planet: scan.originPlanetName })}</span>
                    )}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">
                {staleness((now - scan.at.getTime()) / 60_000)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * THE RADAR VOLUME, AT ITS TRUE SIZE AGAINST THE DISC. D126. Scaled against the
 * galaxy's radius, which is what makes it worth drawing at all; one ring while
 * detection and timed warning are one number, two the day the tables split.
 */
function RadarReach({ sense, warn, level }: { sense: number; warn: number; level: number }) {
  const { t } = useTranslation();
  const reach = (value: number): number => Math.max(4, Math.min(100, (value / GALAXY.radius) * 100));
  const senseSize = reach(sense);
  const warnSize = reach(warn);
  const merged = sense === warn;

  return (
    <div className={`flex items-center gap-3 p-3 ${CARD}`}>
      <div
        data-radar-reach
        className="relative grid size-[104px] shrink-0 place-items-center rounded-full bg-v2-deep"
        role="img"
        aria-label={t(merged ? 'intel.radar.noteFleetsOne' : 'intel.radar.noteFleets', { level, sense, warn })}
      >
        {/* THE RIM OF THE GALAXY. Everything else is measured against it. */}
        <span className="absolute inset-0 rounded-full border border-dashed border-v2-line-hi" />
        {!merged && (
          <span
            data-ring="sense"
            className="absolute rounded-full border border-dashed border-v2-self/45"
            style={{ width: `${String(senseSize)}%`, height: `${String(senseSize)}%` }}
          />
        )}
        <span
          data-ring="warn"
          className="absolute rounded-full border border-v2-self bg-v2-self/10"
          style={{ width: `${String(warnSize)}%`, height: `${String(warnSize)}%` }}
        />
        {/* YOU, at the centre of both. */}
        <span className="absolute size-1.5 rounded-full bg-v2-self" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className={HEADING}>{t('intel.radar.level', { level })}</p>
      <dl className="flex flex-col gap-1.5">
        {!merged && (
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-dashed border-v2-self/45" />
            <dt className="min-w-0 flex-1 truncate text-micro text-v2-ink-2">{t('intel.radar.ringSense')}</dt>
            <dd className="shrink-0 font-v2-mono text-micro text-v2-ink-3">{sense}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-v2-self bg-v2-self/20" />
          <dt className="min-w-0 flex-1 truncate text-micro text-v2-ink">
            {t(merged ? 'intel.radar.ringOne' : 'intel.radar.ringWarn')}
          </dt>
          <dd className="shrink-0 font-v2-mono text-micro text-v2-self">{warn}</dd>
        </div>
      </dl>
      </div>
    </div>
  );
}

/* ── an instrument you do not own ────────────────────────────── */

/**
 * An instrument you do not own, sold as a capability: the art at full strength, the
 * line says what it would tell you, and the cost is stated plainly. A player should
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
  art: string | null;
  missing: string;
  gives: string;
  cost: string;
  action?: string;
  onAct?: () => void;
}) {
  return (
    <div className={`grid grid-cols-[72px_1fr] items-center gap-3 p-3 ${CARD}`}>
      <div data-instrument-diagram={kind} className="grid size-[72px] place-items-center overflow-hidden rounded-control bg-v2-deep" aria-hidden>
        {art && <img src={art} alt="" className="size-16 object-contain" />}
      </div>
      <div className="min-w-0">
        <p className="text-micro font-semibold text-v2-warn">{missing}</p>
        <p className="mt-0.5 text-caption leading-snug text-v2-ink">{gives}</p>
        <p className="mt-1 text-micro leading-snug text-v2-ink-3">{cost}</p>
        {onAct && action && (
          <button
            type="button"
            onClick={onAct}
            className="mt-2 min-h-9 w-full rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink"
          >
            {action}
            <span aria-hidden> →</span>
          </button>
        )}
      </div>
    </div>
  );
}
