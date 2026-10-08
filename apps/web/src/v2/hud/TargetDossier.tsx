import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FAULT,
  combatValue,
  distance,
  fleetCargo,
  fleetCount,
  matchupsAgainst,
  type ClassReading,
  type CombatClass,
  type Fleet,
} from '@astera/rules';
import type { GalaxyPlanet, IntelView, PlanetView, Report } from '../../api/schemas.js';
import { combatClassLabel } from '../../i18n/names.js';
import { rivalColour } from '../../galaxy/PlanetField.js';
import { dossier, sourceLabel } from '../../lib/dossier.js';
import { compact, percent } from '../../lib/format.js';
import { lootEstimate } from '../../lib/lootEstimate.js';
import { flightModifiers, reachMinutes } from '../../lib/navigation.js';
import { probeAxis } from '../../lib/probeScale.js';
import { duration } from '../../lib/time.js';
import { useTargetReading } from '../../lib/useTargetReading.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { Icon } from '../icons.js';
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
}

const SECTION = 'flex flex-col gap-1.5 border-t border-v2-line pt-3';
const HEADING = 'flex items-center gap-1.5 text-caption font-semibold text-v2-ink';
const TAG = 'rounded-chip border border-v2-line px-1 text-micro font-normal text-v2-ink-3';
const CHIP = 'inline-flex items-center gap-1 rounded-chip border border-v2-line bg-v2-raise px-1.5 py-0.5 text-micro tabular-nums text-v2-ink-2';

/** The mark's own colour, on the chip that states or toggles it (D183). */
const marked = (slot: number): CSSProperties => ({ color: rivalColour(slot), borderColor: rivalColour(slot) });

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
export function TargetDossier({ target, planet, intel, reports, rivalSlot, now, rival, ownPeakCore = null }: TargetDossierProps) {
  const { t } = useTranslation();
  const [bandOpen, setBandOpen] = useState(false);
  const mods = flightModifiers(planet);
  const wing = planet.fleet;
  const reading = useTargetReading({
    target: { kind: 'world', world: target },
    intel,
    reports,
    tech: mods.tech,
    wing,
    rulesetVersion: 0,
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
        { key: 'metal', art: ['alloy', 'crystal'], of: loot.metal, fill: METAL },
        { key: 'deuterium', art: ['deuterium'], of: loot.deuterium, fill: DEUT },
      ]
      : [{ key: 'total', art: ['alloy', 'crystal', 'deuterium'], of: loot.decisive, fill: METAL }];
  // One line for every row, so the hold lands at the same place on each.
  const lootReach = Math.max(0, ...lootRows.map((row) => row.of.high));

  return (
    <div data-target-dossier className="flex flex-col gap-3 font-v2-ui">
      <div className="flex flex-wrap gap-1.5">
        {rival ? (
          <button
            type="button"
            aria-pressed={rivalSlot !== null}
            disabled={rival.pending}
            onClick={rival.onToggle}
            className={`${CHIP} ${rivalSlot === null ? 'text-v2-ink-3' : ''} disabled:opacity-60`}
            {...(rivalSlot === null ? {} : { style: marked(rivalSlot) })}
          >
            <Icon id={rivalSlot === null ? 'i-mark' : 'i-close'} className="size-3 shrink-0" />
            {rivalSlot === null ? t('focus.planet.markRival') : t('dossier.page.rival', { n: rivalSlot + 1 })}
          </button>
        ) : rivalSlot !== null && (
          <span className={CHIP} style={marked(rivalSlot)}>
            {t('dossier.page.rival', { n: rivalSlot + 1 })}
          </span>
        )}
        <span className={CHIP}>{t('dossier.page.range', { d: range })}</span>
        <span className={CHIP}>{reach === null ? t('dossier.page.unreachable') : t('dossier.page.flight', { time: duration(reach) })}</span>
        <span className={CHIP}>{t('dossier.page.known', { have: read.facts.length, total: read.facts.length + read.gaps.length })}</span>
        {tierBand && (
          <button
            type="button"
            data-dossier-band
            aria-expanded={bandOpen}
            onClick={() => { setBandOpen((open) => !open); }}
            className={CHIP}
          >
            {tierBand.value}
            <Icon id="i-chev" className={`size-3 shrink-0 transition-transform ${bandOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        )}
      </div>
      {tierBand && bandOpen && (
        <p data-dossier-band-note className="-mt-1.5 text-micro leading-snug text-v2-ink-3">{tierBand.note}</p>
      )}

      {/* WHAT BOUGHT THE READING, HOW OLD IT IS AND HOW SHARP: most of the fact, in an information game. */}
      <div data-dossier-look className="flex items-center gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2">
        {report && probedAgo !== null ? (
          <>
            <Icon id="i-probe" className="size-3.5 shrink-0 text-v2-ink-2" />
            <span className="text-caption font-semibold text-v2-ink">{t('dossier.page.lookProbe')}</span>
            <AgeStamp minutes={probedAgo} />
            <span className="ml-auto shrink-0">
              <SignalBars
                accuracy={report.accuracy}
                label={t(report.fleetHome ? 'intel.probes.accuracyHome' : 'intel.probes.accuracyOut', {
                  percent: percent(report.accuracy),
                })}
              />
            </span>
          </>
        ) : (
          <span className="text-caption text-v2-warn">{t('dossier.page.lookNone')}</span>
        )}
      </div>

      <div className={SECTION}>
        <ForceRuler
          yours={combatValue(wing)}
          theirs={reading.opposing}
          lines={reading.lines}
          notes={reading.notes}
          yoursLabel={t('dossier.page.wing')}
          heading={t('dossier.page.power')}
        />
      </div>

      {reading.classReading && reading.classReading.kind !== 'NONE' && (
        <section data-dossier-shape className={SECTION}>
          <h3 className={HEADING}>
            {t('dossier.page.shape')}
            <span className={TAG}>{sourceLabel('probe')}</span>
          </h3>
          <ShareBar wing={wing} reading={reading.classReading} />
          <MatchupLine wing={wing} reading={reading.classReading} />
        </section>
      )}

      {loot && (
        <section data-dossier-loot className={SECTION}>
          <h3 className={HEADING}>
            {t('dossier.page.loot')}
            <span className={TAG}>{t('dossier.page.lootTag')}</span>
          </h3>
          <p className="text-micro leading-snug text-v2-ink-3">{t('dossier.page.lootMeaning')}</p>
          <div className="flex flex-col gap-1">
            {lootRows.map((row) => (
              <LootRow key={row.key} line={row} cargo={loot.cargo} reach={lootReach} />
            ))}
          </div>
          <p className="text-micro text-v2-ink-3">{`${t('dossier.page.lootPartial')} ${band(loot.partial.low, loot.partial.high)}`}</p>
          <p className={`flex items-center gap-1.5 text-caption leading-snug ${loot.cargoShort ? 'text-v2-warn' : 'text-v2-ink-2'}`}>
            {/* The key to the teal tick on the lines above: that is this hold. */}
            <span aria-hidden className="h-3 w-0.5 shrink-0 rounded-full bg-v2-self" />
            {t(loot.cargoShort ? 'dossier.page.lootShort' : 'dossier.page.lootHold', { cargo: compact(loot.cargo) })}
          </p>
        </section>
      )}

      {target.kind === 'COLONY' && (
        <section data-dossier-colony className={SECTION}>
          <h3 className={HEADING}>{t('dossier.page.colony')}</h3>
          <p className="text-caption leading-snug text-v2-ink-2">
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
  fill: CSSProperties;
}

const METAL: CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, var(--color-v2-alloy), var(--color-v2-crystal))',
};
const DEUT: CSSProperties = { backgroundColor: 'var(--color-v2-deut)' };

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
    <div data-loot-row={key} className="grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] items-center gap-2">
      <span className="flex items-center -space-x-1">
        {art.map((resource) => (
          <img key={resource} src={RESOURCE_ART[resource]} alt="" draggable={false} className="size-4 shrink-0 object-contain" />
        ))}
      </span>
      <span
        role="img"
        aria-label={t('dossier.page.lootRow', { label, band: figure, cargo: compact(cargo) })}
        className="relative block h-2.5"
      >
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-v2-line-hi" />
        <span
          data-loot-band=""
          className="absolute inset-y-0.5 rounded-full"
          style={{ left: `${String(start)}%`, width: `${String(width)}%`, ...fill }}
        />
        {you !== null && (
          <span
            data-cargo-mark=""
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-v2-self"
            style={{ left: `${String(you)}%` }}
          />
        )}
      </span>
      <span className="truncate text-right font-v2-mono text-caption font-semibold text-v2-ink">{figure}</span>
    </div>
  );
}

/** Lightest first: the largest share reads brightest, as on the mock. */
const SHARE_TONE = ['bg-v2-ink', 'bg-v2-ink-2', 'bg-v2-ink-3'] as const;

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
  const parts: ReactNode[] = matchups.wallShares.map((row, index) => (
    <span
      key={row.cls}
      data-share={row.cls}
      title={shareTitle(row.cls, row.share)}
      className={`flex h-full items-center justify-center ${SHARE_TONE[Math.min(index, SHARE_TONE.length - 1)]}`}
      style={{ width: width(row.share) }}
    >
      <ClassEmblem cls={row.cls} decorative className="size-2.5 text-v2-void" />
    </span>
  ));
  return (
    <div
      role="img"
      aria-label={matchups.wallShares.map((row) => shareTitle(row.cls, row.share)).join(t('counter.lineJoin'))}
      className="flex h-3 w-full gap-px overflow-hidden rounded-cell bg-v2-line"
    >
      {parts}
      {matchups.unknownShare > 0 && (
        <span data-share-unread="" title={t('dossier.page.shareUnread')} className="v2-hatch h-full flex-1" />
      )}
    </div>
  );
}
