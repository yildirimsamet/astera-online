import { useTranslation } from 'react-i18next';
import { FAULT, combatValue, distance, fleetCargo, fleetCount } from '@astera/rules';
import type { GalaxyPlanet, IntelView, PlanetView, Report } from '../../api/schemas.js';
import { rivalColour } from '../../galaxy/PlanetField.js';
import { dossier, sourceLabel } from '../../lib/dossier.js';
import { compact } from '../../lib/format.js';
import { lootEstimate } from '../../lib/lootEstimate.js';
import { flightModifiers, reachMinutes } from '../../lib/navigation.js';
import { duration } from '../../lib/time.js';
import { useTargetReading } from '../../lib/useTargetReading.js';
import { AgeStamp } from '../kit/Freshness.js';
import { ForceRuler } from '../kit/ForceRuler.js';
import { MatchupLine } from '../kit/MatchupLine.js';

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
}

const HEADING = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';
const CHIP = 'rounded-chip border border-v2-line bg-v2-raise px-1.5 py-0.5 font-v2-mono text-micro text-v2-ink-2';

/**
 * THE TARGET DOSSIER. Spec E2 (docs/ui-v2/gozlemevi.md), the mock's "Hedef dosyası".
 *
 * Everything known about another world on one page, each figure against what gives it
 * meaning: its power beside the wing standing home (B5) with the counter cycle read
 * against it (B6), dated by the look that bought the reading; the haul beside the hold;
 * on a colony, the loyalty RULE — never the loyalty value, which is theirs. It says
 * nothing it was not sold: where no probe has been there is no enemy band and no haul,
 * only the statement that nobody has looked inside, beside the probe that would.
 *
 * The readings come from the same hook the launch uses (`useTargetReading`), so what
 * this page promises and what the launch then draws cannot disagree.
 */
export function TargetDossier({ target, planet, intel, reports, rivalSlot, now }: TargetDossierProps) {
  const { t } = useTranslation();
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
  const read = dossier({ target, planet, intel, reports, now });
  const range = Math.round(distance(planet.planet.position, target.position));
  const reach = fleetCount(wing) > 0 ? reachMinutes(planet.planet.position, target.position, wing, mods) : null;
  const loot = lootEstimate(reading.report, fleetCargo(wing, mods.tech));
  const band = (low: number, high: number): string =>
    low === high ? compact(low) : `${compact(low)}${t('units.rangeJoin')}${compact(high)}`;
  const probedAgo = reading.report ? Math.max(0, (now - reading.report.at.getTime()) / 60_000) : null;

  return (
    <div data-target-dossier className="flex flex-col gap-3 font-v2-ui">
      <div className="flex flex-wrap gap-1.5">
        {rivalSlot !== null && (
          <span className={CHIP} style={{ color: rivalColour(rivalSlot), borderColor: rivalColour(rivalSlot) }}>
            {t('dossier.page.rival', { n: rivalSlot + 1 })}
          </span>
        )}
        <span className={CHIP}>{t('dossier.page.range', { d: range })}</span>
        <span className={CHIP}>{reach === null ? t('dossier.page.unreachable') : t('dossier.page.flight', { time: duration(reach) })}</span>
        <span className={CHIP}>{t('dossier.page.known', { have: read.facts.length, total: read.facts.length + read.gaps.length })}</span>
      </div>

      {/* WHAT BOUGHT THE READING, AND HOW OLD IT IS: most of the fact, in an information game. */}
      <div data-dossier-look className="flex items-center justify-between gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2">
        {probedAgo === null ? (
          <span className="text-caption text-v2-warn">{t('dossier.page.lookNone')}</span>
        ) : (
          <>
            <span className="text-caption font-medium text-v2-ink">{sourceLabel('probe')}</span>
            <AgeStamp minutes={probedAgo} />
          </>
        )}
      </div>

      <section className="flex flex-col gap-1.5">
        <h3 className={HEADING}>{t('dossier.page.power')}</h3>
        <ForceRuler
          yours={combatValue(wing)}
          theirs={reading.opposing}
          lines={reading.lines}
          notes={reading.notes}
          yoursLabel={t('dossier.page.wing')}
        >
          {reading.classReading && <MatchupLine wing={wing} reading={reading.classReading} />}
        </ForceRuler>
      </section>

      {loot && (
        <section data-dossier-loot className="flex flex-col gap-1.5">
          <h3 className={`${HEADING} flex items-center gap-1.5`}>
            {t('dossier.page.loot')}
            <span className="rounded-chip border border-v2-line px-1 normal-case tracking-normal text-v2-ink-3">{t('dossier.page.lootTag')}</span>
          </h3>
          <p className="text-micro leading-snug text-v2-ink-3">{t('dossier.page.lootMeaning')}</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-control border border-v2-line bg-v2-deep/40 px-3 py-2">
            <div>
              <dt className="text-micro text-v2-ink-3">{t('dossier.page.lootDecisive')}</dt>
              <dd className="font-v2-mono text-caption font-semibold text-v2-ink">{band(loot.decisive.low, loot.decisive.high)}</dd>
            </div>
            <div>
              <dt className="text-micro text-v2-ink-3">{t('dossier.page.lootPartial')}</dt>
              <dd className="font-v2-mono text-caption font-semibold text-v2-ink">{band(loot.partial.low, loot.partial.high)}</dd>
            </div>
          </dl>
          {loot.deuterium && (
            <p className="text-micro text-v2-ink-3">{t('dossier.page.lootDeuterium', { band: band(loot.deuterium.low, loot.deuterium.high) })}</p>
          )}
          <p className={`text-caption leading-snug ${loot.cargoShort ? 'text-v2-warn' : 'text-v2-ink-2'}`}>
            {t(loot.cargoShort ? 'dossier.page.lootShort' : 'dossier.page.lootHold', { cargo: compact(loot.cargo) })}
          </p>
        </section>
      )}

      {target.kind === 'COLONY' && (
        <section data-dossier-colony className="flex flex-col gap-1.5">
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
