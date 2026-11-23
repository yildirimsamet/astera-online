import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FAULT,
  crackLimit,
  distance,
  effectiveCracks,
  fleetCargo,
  fleetCount,
  matchupsAgainst,
  partitionCombatFleet,
  type ClassReading,
  type CombatClass,
  type Fleet,
  type MoonRarity,
} from '@astera/rules';
import type { GalaxyPlanet, IntelView, PlanetView, Report } from '../../api/schemas.js';
import { useMoonT } from '../../i18n/moon.js';
import { MoonProbeSection } from '../../screens/MoonControls.js';
import { combatClassLabel } from '../../i18n/names.js';
import { rivalColour } from '../../galaxy/PlanetField.js';
import { dossier, sourceLabel } from '../../lib/dossier.js';
import { compact, percent } from '../../lib/format.js';
import { lootEstimate } from '../../lib/lootEstimate.js';
import { flightModifiers, reachMinutes } from '../../lib/navigation.js';
import { probeAxis } from '../../lib/probeScale.js';
import { duration } from '../../lib/time.js';
import { useTargetReading } from '../../lib/useTargetReading.js';
import { capabilities } from '../../platform/runtime.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
import { Glyph, SectionTag } from '../../game-ui/index.js';
import { haptic } from '../../lib/haptics.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { ClassEmblem } from '../kit/ClassEmblem.js';
import { AgeStamp } from '../kit/Freshness.js';
import { ForceRuler } from '../kit/ForceRuler.js';
import { MatchupLine } from '../kit/MatchupLine.js';
import { SignalBars } from '../kit/SignalBars.js';

export interface TargetDossierProps {
  target: GalaxyPlanet;
  /** The commander's active world: where the wing, the hold and the flight are measured from. */
  planet: PlanetView;
  intel: IntelView | undefined;
  reports: readonly Report[];
  /** Which of the commander's marks this world wears, or null (D183). */
  rivalSlot: number | null;
  /** Server time. */
  now: number;
  /**
   * The rival mark as a control in the header (the mock's chip): a press marks the world,
   * a second press clears it. Absent where a new mark cannot be drawn. An existing
   * mark remains removable when its commander joins the clan or the world leaves sight.
   */
  rival?: { pending: boolean; onToggle: () => void };
  /**
   * The caller's tallest Core across every world they hold (`lib/band.ts`), or null
   * while their worlds have not arrived. Feeds the development band chip (D168).
   */
  ownPeakCore?: number | null;
  /** Public moon data for this world when moons are active on the galaxy. */
  moon?: { cracks: number; lastHitAt: Date | null; rarity?: MoonRarity } | null;
}

/** The mark's own colour, on the chip that states or toggles it (D183). */
const marked = (slot: number): CSSProperties => ({ color: rivalColour(slot), borderColor: rivalColour(slot) });

/** The kit's answer to a press in the file's head: the tap, felt and heard. */
const answer = (): void => {
  playSound('tap');
  haptic('tap');
};

/**
 * THE TARGET DOSSIER. Spec E2 (docs/ui-v2/gozlemevi.md), the mock's "Hedef dosyası".
 *
 * Everything known about another world on one page, each figure against what gives it
 * meaning: its power beside the wing standing home (B5); the probe's class reading as one
 * bar with the counter cycle read against it (B6); the haul resource by resource, with
 * your hold on the same line; on a colony, the loyalty RULE — never the loyalty value,
 * which is theirs. Each is dated by the look that bought it, whose sharpness is in the
 * Telescope's bars. It says nothing it was not sold: where no probe has been there is no
 * enemy band, no composition and no haul, only the statement that nobody has looked.
 *
 * The readings come from the same hook the launch uses (`useTargetReading`), so what
 * this page promises and what the launch then draws cannot disagree.
 */
export function TargetDossier({ target, planet, intel, reports, rivalSlot, now, rival, ownPeakCore = null, moon = null }: TargetDossierProps) {
  const { t } = useTranslation();
  const tMoon = useMoonT();
  const [bandOpen, setBandOpen] = useState(false);
  const markPress = useOwnPress(() => { answer(); rival?.onToggle(); });
  const bandPress = useOwnPress(() => { answer(); setBandOpen((open) => !open); });
  const mods = flightModifiers(planet);
  const available = useMemo(() => partitionCombatFleet(planet.fleet, planet.fleetDamage), [planet.fleet, planet.fleetDamage]);
  const wing = available.eligible;
  const reading = useTargetReading({
    target: { kind: 'world', world: target },
    intel,
    reports,
    tech: mods.tech,
    wing,
    damage: available.damage,
    rulesetVersion: 0,
    aboard: planet.vessel !== undefined,
  });
  const read = dossier({ target, planet, intel, reports, ownPeakCore, now });
  /*
    THE BAND AT A GLANCE (D168, owner report 2026-10-01). The dossier's development row
    carries a note only when it is set against the caller's own tier — another
    commander's world, the caller's worlds loaded — and that row lives two taps deep in
    the "public" band. The comparison is what decides whether a launch is worth trying,
    so it rides the header; the rule behind it is one tap more.
  */
  const development = read.facts.find((fact) => fact.key === 'development');
  const tierBand = development?.note === undefined ? null : { value: development.value, note: development.note };
  const range = Math.round(distance(planet.planet.position, target.position));
  const reach = fleetCount(wing) > 0 ? reachMinutes(planet.planet.position, target.position, wing, mods, 'combat') : null;
  const loot = lootEstimate(reading.report, fleetCargo(wing, mods.tech));
  const band = (low: number, high: number): string =>
    low === high ? compact(low) : `${compact(low)}${t('units.rangeJoin')}${compact(high)}`;
  const report = reading.report;
  const probedAgo = report ? Math.max(0, (now - report.at.getTime()) / 60_000) : null;
  /*
    THE HAUL, RESOURCE BY RESOURCE (the mock's rows). A probe reads two piles — the whole
    haul and the deuterium in it — so alloy and crystal share a row; a report that never
    read the deuterium keeps the pile whole.
  */
  const lootRows: readonly LootLine[] = !loot
    ? []
    : loot.metal && loot.deuterium
      ? [
        { key: 'metal', art: ['alloy', 'crystal'], of: loot.metal, fill: 'metal' },
        { key: 'deuterium', art: ['deuterium'], of: loot.deuterium, fill: 'deuterium' },
      ]
      : [{ key: 'total', art: ['alloy', 'crystal', 'deuterium'], of: loot.decisive, fill: 'metal' }];
  // One line for every row, so the hold lands at the same place on each.
  const lootReach = Math.max(0, ...lootRows.map((row) => row.of.high));

  return (
    <div data-target-dossier className="gk gk-dossier">
      {/* THE FILE'S HEAD: the mark a thumb can set, then the facts that frame the rest. */}
      <div className="gk-dossier__chips">
        {rival ? (
          <button
            type="button"
            {...OWN_SOUND}
            className="gk-hit"
            aria-pressed={rivalSlot !== null}
            disabled={rival.pending}
            onPointerDown={markPress.onPointerDown}
            onClick={markPress.onClick}
          >
            <span className="gk-chip gk-dossier__chip" data-mark={rivalSlot === null ? 'none' : 'set'} {...(rivalSlot === null ? {} : { style: marked(rivalSlot) })}>
              <Glyph id={rivalSlot === null ? 'flag' : 'close'} />
              {rivalSlot === null ? t('focus.planet.markRival') : t('dossier.page.rival', { n: rivalSlot + 1 })}
            </span>
          </button>
        ) : rivalSlot !== null && (
          <span className="gk-chip gk-dossier__chip" style={marked(rivalSlot)}>
            {t('dossier.page.rival', { n: rivalSlot + 1 })}
          </span>
        )}
        <span className="gk-chip gk-dossier__chip gk-num">{t('dossier.page.range', { d: range })}</span>
        {/* No wing at home is all a null says here, and a ship can build one: not "out of reach". */}
        {(reach !== null || planet.vessel === undefined) && <span className="gk-chip gk-dossier__chip gk-num">{reach === null ? t('dossier.page.unreachable') : t('dossier.page.flight', { time: duration(reach) })}</span>}
        <span className="gk-chip gk-dossier__chip gk-num">{t('dossier.page.known', { have: read.facts.length, total: read.facts.length + read.gaps.length })}</span>
        {tierBand && (
          <button
            type="button"
            {...OWN_SOUND}
            data-dossier-band
            className="gk-hit"
            aria-expanded={bandOpen}
            onPointerDown={bandPress.onPointerDown}
            onClick={bandPress.onClick}
          >
            <span className="gk-chip gk-dossier__chip gk-dossier__fold">
              {tierBand.value}
              <Glyph id="down" />
            </span>
          </button>
        )}
      </div>
      {tierBand && bandOpen && (
        <p data-dossier-band-note className="gk-well gk-dossier__note">{tierBand.note}</p>
      )}

      {/* WHAT BOUGHT THE READING, HOW OLD IT IS AND HOW SHARP: most of the fact, in an information game. */}
      <div data-dossier-look className="gk-well gk-dossier__look" {...(report ? {} : { 'data-blind': '' })}>
        {report && probedAgo !== null ? (
          <>
            <Glyph id="eye" />
            <span className="gk-dossier__lookname">{t('dossier.page.lookProbe')}</span>
            <AgeStamp minutes={probedAgo} className="gk-num gk-dossier__age" />
            <span className="gk-dossier__bars">
              <SignalBars
                accuracy={report.accuracy}
                label={t(report.fleetHome ? 'intel.probes.accuracyHome' : 'intel.probes.accuracyOut', {
                  percent: percent(report.accuracy),
                })}
              />
            </span>
          </>
        ) : (
          <>
            <Glyph id="warn" />
            <span className="gk-dossier__lookname">{t('dossier.page.lookNone')}</span>
          </>
        )}
      </div>

      <div className="gk-dossier__part">
        <ForceRuler
          power={reading.power}
          theirs={reading.opposing}
          notes={reading.notes}
          yoursLabel={t('dossier.page.wing')}
          heading={t('dossier.page.power')}
        />
      </div>

      {moon && (
        <section data-dossier-moon className="gk-dossier__part">
          <div className="gk-well flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-alloy">
                <Glyph id="moon" className="size-3.5 shrink-0" />
                {tMoon('body.dossierMoonTitle')}
              </span>
              {moon.rarity ? (
                <span className="gk-num text-caption text-dim">
                  {tMoon(`rarity.${moon.rarity}`)} · {tMoon('status.cracks')}{' '}
                  {Math.max(0, crackLimit(moon.rarity) - effectiveCracks({ cracks: moon.cracks, lastHitAtMs: moon.lastHitAt?.getTime() ?? null }, now))}/
                  {crackLimit(moon.rarity)}
                </span>
              ) : (
                <span className="gk-num text-caption text-faint">
                  {tMoon('status.hitsTaken')}: {effectiveCracks({ cracks: moon.cracks, lastHitAtMs: moon.lastHitAt?.getTime() ?? null }, now)}
                </span>
              )}
            </div>
            {!moon.rarity && !report?.moon && (
              <p className="text-caption text-faint">{tMoon('body.dossierMoonUnknown')}</p>
            )}
            {report?.moon && <MoonProbeSection moon={report.moon} />}
          </div>
        </section>
      )}

      {reading.classReading && reading.classReading.kind !== 'NONE' && (
        <section data-dossier-shape className="gk-dossier__part">
          <SectionTag as="h3" aside={sourceLabel('probe')}>{t('dossier.page.shape')}</SectionTag>
          <ShareBar wing={wing} reading={reading.classReading} />
          <MatchupLine wing={wing} reading={reading.classReading} />
        </section>
      )}

      {loot && (
        <section data-dossier-loot className="gk-dossier__part">
          <SectionTag as="h3" aside={t('dossier.page.lootTag')}>{t('dossier.page.loot')}</SectionTag>
          <p className="gk-sub">{t('dossier.page.lootMeaning')}</p>
          <div className="gk-haul">
            {lootRows.map((row) => (
              <LootRow key={row.key} line={row} cargo={loot.cargo} reach={lootReach} />
            ))}
          </div>
          <p className="gk-sub gk-num">{`${t('dossier.page.lootPartial')} ${band(loot.partial.low, loot.partial.high)}`}</p>
          <p className="gk-haul__key" {...(loot.cargoShort ? { 'data-short': '' } : {})}>
            {/* The key to the teal tick on the lines above: that is this hold. */}
            <span aria-hidden="true" className="gk-haul__keytick" />
            {t(loot.cargoShort ? 'dossier.page.lootShort' : 'dossier.page.lootHold', { cargo: compact(loot.cargo) })}
          </p>
        </section>
      )}

      {report?.notificationCenter !== undefined && capabilities().notificationCenter && (
        <section data-dossier-center className="gk-dossier__part">
          <SectionTag as="h3" aside={sourceLabel('probe')}>{t('notificationCenter.title')}</SectionTag>
          <p className="gk-dossier__reading">
            <Glyph id="bell" />
            <span className="gk-num">{t(`notificationCenter.reading.${report.notificationCenter}`)}</span>
          </p>
          <p className="gk-dossier__text">{t(`notificationCenter.readingMeaning.${report.notificationCenter}`)}</p>
          <p className="gk-sub">{t('notificationCenter.readingRule')}</p>
        </section>
      )}

      {target.kind === 'COLONY' && (
        <section data-dossier-colony className="gk-dossier__part">
          <SectionTag as="h3">{t('dossier.page.colony')}</SectionTag>
          <p className="gk-dossier__text">
            {t('dossier.page.colonyRule', {
              decisive: FAULT.battleLoyaltyLoss.DECISIVE,
              partial: FAULT.battleLoyaltyLoss.PARTIAL,
            })}
          </p>
        </section>
      )}
    </div>
  );
}

type Resource = 'alloy' | 'crystal' | 'deuterium';

interface LootLine {
  key: string;
  art: readonly Resource[];
  of: { low: number; high: number };
  /** The band's paint: the two metals' blend, or deuterium's own green. */
  fill: 'metal' | 'deuterium';
}

/**
 * ONE RESOURCE'S HAUL ON A LINE FROM ZERO, WITH YOUR HOLD ON IT. The band is the probe's
 * estimate in the resource's own colour (K2: never without its icon), the teal tick is the
 * hold standing home. Every row runs to the same end, so a tick left of a band says the
 * hold, not the win, is the wall.
 */
function LootRow({ line, cargo, reach }: { line: LootLine; cargo: number; reach: number }) {
  const { t } = useTranslation();
  const { key, art, of, fill } = line;
  const { start, width, you } = probeAxis(of.low, of.high, cargo, reach);
  const label = art.map((resource) => t(`vocabulary.resource.${resource}`)).join(' + ');
  const figure = of.low === of.high ? compact(of.low) : `${compact(of.low)}${t('units.rangeJoin')}${compact(of.high)}`;
  return (
    <div data-loot-row={key} className="gk-haul__row">
      <span className="gk-haul__art">
        {art.map((resource) => (
          <img key={resource} src={RESOURCE_ART[resource]} alt="" draggable={false} />
        ))}
      </span>
      <span
        role="img"
        aria-label={t('dossier.page.lootRow', { label, band: figure, cargo: compact(cargo) })}
        className="gk-haul__line"
      >
        <span
          data-loot-band=""
          data-fill={fill}
          className="gk-haul__band"
          style={{ left: `${String(start)}%`, width: `${String(width)}%` }}
        />
        {you !== null && (
          <span data-cargo-mark="" className="gk-haul__hold" style={{ left: `${String(you)}%` }} />
        )}
      </span>
      <span className="gk-num gk-haul__figure">{figure}</span>
    </div>
  );
}

/**
 * THE PROBE'S CLASS READING AS ONE BAR (the mock's "Okunan dağılım"). A full split is
 * drawn to its shares; a majority is a floor, so its class gets the half it is known to
 * hold and the rest is hatched as unread; an even or unread wall draws no bar at all —
 * the sentence under it says why. The counter line below is its legend, in the same order.
 */
function ShareBar({ wing, reading }: { wing: Fleet; reading: ClassReading }) {
  const { t } = useTranslation();
  const matchups = matchupsAgainst(wing, reading);
  const shareTitle = (cls: CombatClass, share: number): string =>
    `${combatClassLabel(cls)} ${t('units.percent', { value: String(Math.round(share * 100)) })}`;
  if (!matchups || matchups.kind === 'MIXED' || matchups.wallShares.length === 0) return null;
  const width = (share: number): string => `${String(Math.round(share * 100))}%`;
  // A range reading draws each class's floor; what the ranges leave open is hatched.
  const parts: ReactNode[] = matchups.wallShares.filter((row) => row.share > 0).map((row, index) => (
    <span
      key={row.cls}
      data-share={row.cls}
      title={shareTitle(row.cls, row.share)}
      data-rank={Math.min(index, 2)}
      className="gk-share__part"
      style={{ width: width(row.share) }}
    >
      <ClassEmblem cls={row.cls} decorative className="gk-share__emblem" />
    </span>
  ));
  return (
    <div
      role="img"
      aria-label={matchups.wallShares.map((row) => shareTitle(row.cls, row.share)).join(t('counter.lineJoin'))}
      className="gk-share"
    >
      {parts}
      {matchups.unknownShare > 0 && (
        <span data-share-unread="" title={t('dossier.page.shareUnread')} className="gk-share__unread" />
      )}
    </div>
  );
}
