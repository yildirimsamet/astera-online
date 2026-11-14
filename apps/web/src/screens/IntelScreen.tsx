import { useReadReportSignals } from '../session/useReadReportSignals.js';
import { GameActions } from '../session/seasonLock.js';
import {
  GALAXY,
  PROBE,
  dominantClass,
  fleetCargo,
  RIVAL,
  radarDetectsFleets,
  radarRange,
  sensorSphere,
  STARTER,
  vesselSphere,
  telescopeSlots,
  vesselHull,
  type HullClass,
} from '@astera/rules';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGalaxy, useIntel, usePlanet } from '../api/queries.js';
import { probeAxis, yardstickOf, type Yardstick } from '../lib/probeScale.js';
import type { IntelView } from '../api/schemas.js';
import { rivalColour } from '../galaxy/PlanetField.js';
import { compact, full, percent } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { flightModifiers } from '../lib/navigation.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { OutpostReading, sealedVictoryCrate } from '../starter/OutpostReading.js';
import { heroArt } from '../starter/shipScreen.js';
import { GameTabs, Glyph, SectionTag, type TabItem } from '../game-ui/index.js';
import { instrumentArt, planetArt } from '../ui/assets.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { AgeStamp, AgedThumb, ClarityMark } from '../v2/kit/Freshness.js';
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
 *   · PROBES and BATTLES — the two report lists this screen always had.
 *   · RADAR — who is looking at ME: the reach, the day's scans on a line, the log.
 *
 * ONE ROW OF FOUR (C7, 2026-11-14): the two report lists were a second tab bar inside a
 * "Reports" shelf; they are shelves of their own now, on the kit's stacked tabs, so every
 * list is one tap from any other.
 *
 * Empty states stay the most valuable real estate in the game: each names the
 * instrument that would fill it and what it would tell the player.
 */

type Shelf = 'watch' | 'probes' | 'battles' | 'radar';

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

/** A neighbour aboard is a ship. Its id gives its hull; its state is a matter for the report's bands. */
const targetArt = (id: string, aboard: boolean): string => aboard ? heroArt(vesselHull(id), 'WRECKED') : planetArt(id);

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
  open?: { stop: Shelf; request: number; reportMissionId?: string };
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
  const [shelf, setShelf] = useState<Shelf>(open?.stop ?? 'watch');
  const requestedStop = open?.stop;
  const request = open?.request;
  useReadReportSignals(shelf === 'probes' && !intel.isError && intel.data !== undefined,
    (intel.data?.probeReports ?? []).flatMap(report => report.missionId ? [report.missionId] : []));
  useEffect(() => {
    if (!requestedStop) return;
    setShelf(requestedStop);
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

  const aboard = planet.data?.vessel !== undefined;
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

  const shelves: readonly TabItem<Shelf>[] = [
    { id: 'watch', label: t('intel.shelf.watch'), glyph: { id: 'eye' } },
    { id: 'probes', label: t('intel.shelf.probes'), spoken: t('intel.probes.heading'), glyph: { id: 'zoom' } },
    { id: 'battles', label: t('intel.shelf.battles'), spoken: t('reports.heading'), glyph: { id: 'attack' } },
    { id: 'radar', label: t('intel.shelf.radar'), glyph: { id: 'siren' } },
  ];

  return (
    <GameActions>
      <div className="gk gk-intel">
        <GameTabs
          stacked
          label={t('intel.shelf.label')}
          tabs={shelves}
          value={shelf}
          onChange={setShelf}
          ids={{ tab: (id) => `intel-shelf-${id}`, panel: (id) => `intel-panel-${id}` }}
        />

        {shelf === 'watch' && (
          <div role="tabpanel" id="intel-panel-watch" aria-labelledby="intel-shelf-watch" className="gk-intel__shelf">
            <TelescopeShelf
              telescope={telescope}
              slots={slots}
              mine={mine}
              neighbours={neighbours}
              radar={radar}
              aboard={aboard}
              {...(onOpenOrbit ? { onOpenOrbit } : {})}
            />
            {!aboard && <Rivals rivals={rivals} {...(onFocusRival ? { onFocusRival } : {})} />}
            <Known watching={watching} probes={probeReports} now={now} aboard={aboard} onFocusPlanet={onOpenDossier} />
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

        {shelf === 'probes' && (
          <div role="tabpanel" id="intel-panel-probes" aria-labelledby="intel-shelf-probes" className="gk-intel__shelf">
            <ProbeShelf
              probes={probeReports}
              now={now}
              yours={planet.data ? yardstickOf(planet.data) : null}
              aboard={aboard}
              hunt={aboard && planet.data ? {
                carry: fleetCargo(planet.data.fleet, flightModifiers(planet.data).tech),
                own: dominantClass(planet.data.fleet),
                crate: planet.data.vessel ? sealedVictoryCrate(planet.data.vessel) : null,
              } : null}
              {...(onOpenDossier ? { onOpenDossier } : {})}
            />
          </div>
        )}

        {shelf === 'battles' && (
          <div role="tabpanel" id="intel-panel-battles" aria-labelledby="intel-shelf-battles" className="gk-intel__shelf">
            <BattleReports
              visible
              {...(open?.reportMissionId
                ? { open: { missionId: open.reportMissionId, request: open.request } }
                : {})}
              /* A report's "Attack again" is the raided world's dossier (E6), as from a notification. */
              {...(onOpenDossier ? { onAttackAgain: onOpenDossier } : {})}
              {...doors}
            />
          </div>
        )}

        {shelf === 'radar' && (
          <div role="tabpanel" id="intel-panel-radar" aria-labelledby="intel-shelf-radar" className="gk-intel__shelf">
            <RadarShelf aboard={aboard} radar={radar} anyRadar={anyRadar} scans={radarLog} now={now} {...(onOpenOrbit ? { onOpenOrbit } : {})} {...(onOpenDossier ? { onFocusPlanet: onOpenDossier } : {})} />
          </div>
        )}
      </div>
    </GameActions>
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
  aboard,
  telescope,
  slots,
  mine,
  neighbours,
  radar,
  onOpenOrbit,
}: {
  aboard: boolean;
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
    <section className="gk-intel__part">
      <SectionTag aside={slots > 0 ? <span className="gk-num">{`${String(seen)}/${String(slots)}`}</span> : undefined}>
        {t('intel.watching.heading')}
      </SectionTag>
      {telescope === 0 ? (
        <Instrument
          kind="telescope"
          art={instrumentArt('TELESCOPE', 1)}
          missing={t('intel.watching.missingNoTelescope')}
          gives={t(aboard ? 'starter.intel.telescopeGives' : 'intel.watching.gives')}
          cost={t(aboard ? 'starter.intel.telescopeCost' : 'intel.watching.costInstall')}
          {...(onOpenOrbit ? { onAct: onOpenOrbit, action: t(aboard ? 'starter.intel.openShip' : 'intel.openOrbit') } : {})}
        />
      ) : (
        <div data-telescope-rack className="gk-lenses">
          {Array.from({ length: slots }, (_, slot) => {
            const watch = mine.find((item) => item.slot === slot);
            const label = t('intel.watching.slotLabel', { slot: slot + 1 });
            return watch ? (
              <div key={slot} data-slot={slot + 1} data-filled="" title={label} className="gk-lens">
                <AgedThumb src={planetArt(watch.targetPlanetId)} alt="" clarity={watch.reading.state} className="size-9" />
                <span className="gk-lens__name">{watch.targetName}</span>
              </div>
            ) : (
              <div key={slot} data-slot={slot + 1} data-idle="" title={label} className="gk-lens">
                <span aria-hidden="true" className="gk-lens__mark"><Glyph id="plus" /></span>
                <span className="gk-lens__name">{t('intel.watching.slotEmpty')}</span>
              </div>
            );
          })}
          {next !== null && (
            <div data-slot-next data-locked="" title={t(aboard ? 'starter.intel.oneMore' : 'intel.coverage.oneMore', { level: next })} className="gk-lens">
              <span aria-hidden="true" className="gk-lens__mark"><Glyph id="lock" /></span>
              <span className="gk-lens__name">{t(aboard ? 'starter.intel.nextSlot' : 'intel.watching.nextSlot', { level: next })}</span>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-1">
        <p className="gk-intel__lead">
          {slots === 0
            ? t(aboard ? 'starter.intel.blind' : 'intel.coverage.blind')
            : idle > 0
              ? t('intel.coverage.partial', { seen, count: slots })
              : t('intel.coverage.full')}
        </p>
        <p className="gk-note">
          {slots === 0
            ? t('intel.coverage.blindHint')
            : idle > 0
              ? t(aboard ? 'starter.intel.idleHint' : 'intel.coverage.idleHint', { count: idle })
              : t(aboard ? 'starter.intel.scarcity' : 'intel.coverage.scarcity', { neighbours, count: slots })}
        </p>
        {radar === 0 && <p className="gk-intel__warn">{t('intel.coverage.noRadar')}</p>}
        {mine.some((w) => w.reading.state === 'INTERMITTENT') && (
          <p className="gk-note">{t('intel.watching.intermittent')}</p>
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
    <section data-rivals className="gk-intel__part">
      <SectionTag aside={<span className="gk-num">{`${String(rivals.length)} / ${String(RIVAL.max)}`}</span>}>
        {t('intel.rivals.heading')}
      </SectionTag>
      {rivals.length === 0 ? (
        <p className="gk-note">{t('intel.rivals.none')}</p>
      ) : (
        <div className="gk-rivals">
          {rivals.map((rival) => (
            <RivalMark
              key={rival.slot}
              rival={rival}
              text={`${String(rival.slot + 1)} · ${rival.lost ? t('intel.rivals.lost') : rival.owner || rival.name}`}
              {...(rival.lost || !onFocusRival ? {} : { onPress: () => { onFocusRival(rival.planetId); } })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One mark on the menu's own rival chip (G1-f2), so a rival looks the same in both places:
 * a door to them, or just a name when there is nowhere to go.
 */
function RivalMark({ rival, text, onPress }: { rival: RivalRow; text: string; onPress?: () => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress?.(); });
  const chip = (
    <span className="gk-chip gk-rival" {...(onPress ? {} : { 'data-lost': '' })}>
      <span aria-hidden="true" className="gk-rival__dot" style={{ backgroundColor: rivalColour(rival.slot) }} />
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
  return onPress ? (
    <button type="button" className="gk-hit max-w-full" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>{chip}</button>
  ) : chip;
}

/**
 * EVERYTHING YOU KNOW, ONE LIST. Live readings first (clarity bars), then what probes
 * brought back and no Telescope is watching (age as grain and "Xh ago") — K11: the two
 * reliabilities never share a mark. The rule is one tap deeper.
 */
function Known({ watching, probes, now, aboard, onFocusPlanet }: {
  watching: readonly Watch[]; probes: readonly Probe[]; now: number; aboard: boolean;
  onFocusPlanet?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const [legend, setLegend] = useState(false);
  const how = useOwnPress(() => { playSound('tap'); haptic('tap'); setLegend((shown) => !shown); });
  const watched = new Set(watching.map((w) => w.targetPlanetId));
  const read = new Set<string>();
  const probed = probes.filter((report) => {
    if (watched.has(report.targetPlanetId) || read.has(report.targetPlanetId)) return false;
    read.add(report.targetPlanetId);
    return true;
  });

  return (
    <section className="gk-intel__part">
      <SectionTag
        aside={(
          <button type="button" aria-expanded={legend} className="gk-intel__how" {...OWN_SOUND} onPointerDown={how.onPointerDown} onClick={how.onClick}>
            <Glyph id="help" />
            {t('intel.known.legendToggle')}
          </button>
        )}
      >
        {t('intel.known.heading')}
      </SectionTag>
      {legend && <p data-known-legend className="gk-well gk-intel__legend">{t('intel.known.legend')}</p>}
      {watching.length === 0 && probed.length === 0 ? (
        <p className="gk-note">{t('intel.known.empty')}</p>
      ) : (
        <ul data-known-list className="gk-ledger">
          {watching.map((watch) => <KnownWatch aboard={aboard} key={`${watch.observerPlanetId ?? ''}-${String(watch.slot)}`} watch={watch} onFocusPlanet={onFocusPlanet} />)}
          {probed.map((report) => (
            <KnownProbe aboard={aboard} key={report.targetPlanetId} report={report} minutes={(now - report.at.getTime()) / 60_000} onFocusPlanet={onFocusPlanet} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** A known world's row: the whole row opens its dossier on the galaxy. */
function KnownRow({ planetId, onFocusPlanet, children }: { planetId: string; onFocusPlanet?: (planetId: string) => void; children: ReactNode }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onFocusPlanet?.(planetId); });
  return (
    <button type="button" disabled={!onFocusPlanet} className="gk-ledger__row" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      {children}
    </button>
  );
}

function KnownWatch({ watch, aboard, onFocusPlanet }: { watch: Watch; aboard: boolean; onFocusPlanet?: (planetId: string) => void }) {
  const { t } = useTranslation();
  const { status, state, staleMinutes, etaMinutes } = watch.reading;
  // E7: an away fleet is the opportunity, and its window is timed only when the reading says so.
  const window = status === 'AWAY' && etaMinutes !== null;
  return (
    <li data-known="watch">
      <KnownRow planetId={watch.targetPlanetId} {...(onFocusPlanet ? { onFocusPlanet } : {})}>
        <AgedThumb src={targetArt(watch.targetPlanetId, aboard)} alt="" clarity={state} />
        <span className="gk-ledger__words">
          <span className="gk-ledger__title">
            {watch.ownerName}
            <span className="gk-intel__fleet" {...(status === 'AWAY' ? { 'data-away': '' } : {})}>{t(FLEET_WORD[status])}</span>
          </span>
          <span className="gk-ledger__sub">{watch.targetName} · {t('intel.known.telescope')} · {staleness(staleMinutes)}</span>
        </span>
        <span className="gk-ledger__side">
          {window ? (
            <span data-window className="gk-intel__window">{t('intel.known.window', { duration: duration(etaMinutes) })}</span>
          ) : (
            <ClarityMark state={state} />
          )}
        </span>
      </KnownRow>
    </li>
  );
}

function KnownProbe({ report, minutes, aboard, onFocusPlanet }: { report: Probe; minutes: number; aboard: boolean; onFocusPlanet?: (planetId: string) => void }) {
  const { t } = useTranslation();
  return (
    <li data-known="probe">
      <KnownRow planetId={report.targetPlanetId} {...(onFocusPlanet ? { onFocusPlanet } : {})}>
        <AgedThumb src={targetArt(report.targetPlanetId, aboard)} alt="" ageMinutes={minutes} />
        <span className="gk-ledger__words">
          <span className="gk-ledger__title">{report.targetUsername}</span>
          <span className="gk-ledger__sub">
            {report.targetName !== report.targetUsername && `${report.targetName} · `}{t('intel.known.probe')} · {t(report.fleetHome ? 'intel.probes.homeTag' : 'intel.probes.outTag')}
          </span>
        </span>
        <span className="gk-ledger__side"><AgeStamp minutes={minutes} /></span>
      </KnownRow>
    </li>
  );
}

/** The radar, glanced from the watch shelf: the day's contacts on a line, one tap to the log. */
function RadarGlance({ scans, now, onOpen }: { scans: readonly Scan[]; now: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  const today = scans.filter((scan) => now - scan.at.getTime() <= 24 * HOUR).length;
  return (
    <button type="button" data-radar-glance className="gk-glance" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-glance__head">
        <span className="gk-glance__title">{t('intel.radar.glance')}</span>
        <span className="gk-glance__count">{t('intel.radar.contacts', { count: today })}<Glyph id="next" /></span>
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
    <span className="gk-dayline">
      <span aria-hidden="true" className="gk-dayline__track">
        {scans
          .filter((scan) => scan.at.getTime() >= start && scan.at.getTime() <= now)
          .map((scan) => (
            <span
              key={`${scan.planetId ?? ''}-${String(scan.at.getTime())}`}
              data-scan-tick=""
              {...(fresh(scan, now) ? { 'data-fresh': '' } : {})}
              className="gk-dayline__tick"
              style={{ left: `${String(((scan.at.getTime() - start) / (24 * HOUR)) * 100)}%` }}
            />
          ))}
      </span>
      <span className="gk-dayline__ends gk-num">
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
function ProbeShelf({ probes, now, yours, aboard, hunt, onOpenDossier }: {
  probes: readonly Probe[];
  now: number;
  /** Your active world, measured as a probe measures; null until it has loaded. */
  yours: Yardstick | null;
  aboard: boolean;
  /** Aboard, what an outpost's report is read against (plan F4): the holds at home and the sealed victory crate. */
  hunt: { carry: number; own: HullClass | null; crate: { alloy: number; crystal: number } | null } | null;
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
    <div className="gk-intel__part">
      {/* The key to every row below: a range is theirs, the teal line is you. */}
      <p className="gk-probes__key">
        {yours !== null && <span aria-hidden="true" className="gk-probes__you" />}
        <span>{t('intel.probes.estimateNote')} {yours !== null && t(aboard ? 'starter.intel.scaleNote' : 'intel.probes.scaleNote')}</span>
      </p>
      {hunt?.crate && probes.some(report => report.outpost === true) && <HuntHowTo />}
      {probes.map((report) => (
        <ProbeReport
          key={`${report.targetPlanetId}-${String(report.at.getTime())}`}
          report={report}
          minutes={(now - report.at.getTime()) / 60_000}
          yours={yours}
          aboard={aboard}
          hunt={hunt}
          {...(onOpenDossier ? { onOpenDossier } : {})}
        />
      ))}
    </div>
  );
}

/**
 * ONE PROBE REPORT ON THE KIT (C8): the head names who was read and how well — a door to
 * their dossier — the three readings sit in a glass well against your own mark, and the
 * foot says whether they caught it and where to go next.
 */
function ProbeReport({ report, minutes, yours, aboard, hunt, onOpenDossier }: {
  report: Probe;
  minutes: number;
  yours: Yardstick | null;
  aboard: boolean;
  hunt: { carry: number; own: HullClass | null; crate: { alloy: number; crystal: number } | null } | null;
  onOpenDossier?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const open = (): void => { playSound('tap'); haptic('tap'); onOpenDossier?.(report.targetPlanetId); };
  const head = useOwnPress(open);
  const door = useOwnPress(open);
  const accuracy = t(report.fleetHome ? 'intel.probes.accuracyHome' : 'intel.probes.accuracyOut', {
    percent: percent(report.accuracy),
  });
  const outpost = hunt !== null && report.outpost === true;
  const face = (
    <>
      {/* An outpost is drawn as a world on the map, and here as there. */}
      <AgedThumb src={targetArt(report.targetPlanetId, aboard && report.outpost !== true)} alt="" ageMinutes={minutes} className="size-11" />
      <span className="gk-probe__who">
        <span className="gk-probe__name">
          {report.targetUsername}
          {report.targetName !== report.targetUsername && <span className="gk-probe__world">{report.targetName}</span>}
        </span>
        <span className="gk-probe__accuracy">{accuracy}</span>
      </span>
      <span className="gk-probe__read">
        <SignalBars accuracy={report.accuracy} label={accuracy} />
        <AgeStamp minutes={minutes} />
      </span>
    </>
  );
  return (
    <article className="gk-probe">
      {onOpenDossier
        ? <button type="button" className="gk-probe__head" {...OWN_SOUND} onPointerDown={head.onPointerDown} onClick={head.onClick}>{face}</button>
        : <div className="gk-probe__head">{face}</div>}
      <div className="gk-well gk-readings">
        <RangeRow label={t('intel.probes.stock')} low={report.stock.low} high={report.stock.high} sharp={report.fleetHome} mine={yours?.stock ?? null} />
        <RangeRow label={t('intel.probes.defence')} low={report.defence.low} high={report.defence.high} sharp={report.fleetHome} mine={yours?.defence ?? null} />
        <RangeRow label={t('intel.probes.ships')} low={report.fleetSize.low} high={report.fleetSize.high} sharp={report.fleetHome} mine={yours?.ships ?? null} />
        {report.repair && <RangeRow label={t('starter.reading.repairLabel')} low={report.repair.low} high={report.repair.high} sharp={report.fleetHome} mine={null} />}
      </div>
      {outpost && <OutpostReading reading={report.classReading} carry={hunt.carry} stock={report.stock} crate={hunt.crate} own={hunt.own} />}
      {/* An outpost is decided here: the door goes straight to its attack (owner playtest 2026-11-08). */}
      {outpost && onOpenDossier && (
        <button type="button" data-report-open="" className="gk-btn gk-btn--danger gk-btn--wide" {...OWN_SOUND} onPointerDown={door.onPointerDown} onClick={door.onClick}>
          <Glyph id="attack" />
          {t('starter.intel.attack')}
        </button>
      )}
      {(report.detected || (onOpenDossier && !outpost)) && (
        <div className="gk-probe__foot">
          {/* Being caught is the cost of looking: a gap to plan around, said in warn. */}
          {report.detected ? <span className="gk-probe__caught"><Glyph id="eye" />{t('intel.probes.caught')}</span> : <span />}
          {onOpenDossier && !outpost && (
            <button type="button" data-report-open="" className="gk-btn gk-btn--sm" {...OWN_SOUND} onPointerDown={door.onPointerDown} onClick={door.onClick}>
              {t('intel.probes.openDossier')}
              <Glyph id="next" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** How two outposts are weighed, said where they are weighed: the inputs and the rule, never the pick. */
function HuntHowTo() {
  const { t } = useTranslation();
  return (
    <section data-testid="hunt-howto" className="gk-howto">
      <h3 className="gk-howto__title"><Glyph id="target" />{t('starter.intel.howTo.title')}</h3>
      <p>{t('starter.intel.howTo.guard')}</p>
      <p>{t('starter.intel.howTo.bars')}</p>
      <p>{t('starter.intel.howTo.carry')}</p>
      <p className="gk-howto__go">{t('starter.intel.howTo.go', { attack: t('starter.intel.attack') })}</p>
    </section>
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
    <div data-range-band className="gk-reading">
      <span className="gk-reading__label">{label}</span>
      <span
        role="img"
        aria-label={mine === null ? reading : `${reading} · ${t('rangeBand.yours', { value: compact(mine) })}`}
        className="gk-reading__track"
      >
        <span
          data-part="band"
          className={`gk-reading__band ${sharp ? 'bg-v2-neutral' : ''}`}
          style={{ left: `${String(start)}%`, width: `${String(width)}%`, ...(sharp ? {} : BLURRED) }}
        />
        {you !== null && (
          <span
            data-you=""
            className="gk-reading__you bg-v2-self"
            style={{ left: `${String(you)}%` }}
          />
        )}
      </span>
      <span className="gk-reading__value gk-num">{`${compact(Math.max(0, low))}–${compact(high)}`}</span>
    </div>
  );
}

/* ── radar ───────────────────────────────────────────────────── */

function RadarShelf({
  aboard,
  radar,
  anyRadar,
  scans,
  now,
  onOpenOrbit,
  onFocusPlanet,
}: {
  aboard: boolean;
  radar: number;
  anyRadar: boolean;
  scans: readonly Scan[];
  now: number;
  onOpenOrbit?: () => void;
  onFocusPlanet?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  if (!anyRadar) {
    return (
      <Instrument
        kind="radar"
        art={instrumentArt('RADAR', 1)}
        missing={t('intel.radar.missing')}
        gives={t(aboard ? 'starter.intel.radarGives' : 'intel.radar.gives')}
        cost={t(aboard ? 'starter.intel.radarCost' : 'intel.radar.cost')}
        {...(onOpenOrbit ? { onAct: onOpenOrbit, action: t(aboard ? 'starter.intel.openShip' : 'intel.openOrbit') } : {})}
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
          // A ship warns at the edge of what it detects, and its galaxy is its own size.
          sense={aboard ? vesselSphere({ x: 0, y: 0, z: 0 }, 0, radar).detect : sensorSphere({ x: 0, y: 0, z: 0 }, 0, radar).detect}
          warn={aboard ? vesselSphere({ x: 0, y: 0, z: 0 }, 0, radar).detect : radarRange(radar)}
          level={radar}
          aboard={aboard}
        />
      )}
      {radar > 0 && (
        <p className="text-micro leading-snug text-v2-ink-2">
          {radarDetectsFleets(radar) && t('intel.radar.noteSlow')}
          {radar < 2 && t(aboard ? 'starter.intel.radarBearing' : 'intel.radar.noteBearing')}
          {!aboard && radar >= 2 && radar < 5 && t('intel.radar.noteOrigin')}
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
        <p className="text-caption text-v2-ink-2">{aboard ? t('starter.intel.radarQuiet') : t('intel.radar.quiet', { level: radar })}</p>
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
                  {scan.planetName !== undefined && (scan.planetId && onFocusPlanet ? (
                    <button type="button" onClick={() => { if (scan.planetId) onFocusPlanet(scan.planetId); }} className="text-v2-self underline decoration-v2-self/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-v2-self">
                      {t('intel.radar.onWorld', { planet: scan.planetName })}
                    </button>
                  ) : <span className="text-v2-self">{t('intel.radar.onWorld', { planet: scan.planetName })}</span>)}
                </p>
                {(scan.bearing !== null || scan.originPlanetName !== null) && (
                  <p className="truncate text-micro text-v2-ink-3">
                    {scan.bearing && t('intel.radar.bearing', { bearing: scan.bearing })}
                    {scan.originPlanetName && (
                      scan.originPlanetId && onFocusPlanet ? (
                        <button type="button" onClick={() => { if (scan.originPlanetId) onFocusPlanet(scan.originPlanetId); }} className="text-v2-self underline decoration-v2-self/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-v2-self">
                          {t('intel.radar.origin', { planet: scan.originPlanetName })}
                        </button>
                      ) : <span className="text-v2-ink">{t('intel.radar.origin', { planet: scan.originPlanetName })}</span>
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
function RadarReach({ sense, warn, level, aboard }: { sense: number; warn: number; level: number; aboard: boolean }) {
  const { t } = useTranslation();
  const reach = (value: number): number => Math.max(4, Math.min(100, (value / (aboard ? STARTER.radius : GALAXY.radius)) * 100));
  const senseSize = reach(sense);
  const warnSize = reach(warn);
  const merged = sense === warn;

  return (
    <div className={`flex items-center gap-3 p-3 ${CARD}`}>
      <div
        data-radar-reach
        className="relative grid size-[104px] shrink-0 place-items-center rounded-full bg-v2-deep"
        role="img"
        aria-label={aboard
          ? t(merged ? 'starter.intel.radarFleetsOne' : 'starter.intel.radarFleets', { level, sense, warn })
          : t(merged ? 'intel.radar.noteFleetsOne' : 'intel.radar.noteFleets', { level, sense, warn })}
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
      <p className={HEADING}>{t(aboard ? 'starter.intel.radarLevel' : 'intel.radar.level', { level })}</p>
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
