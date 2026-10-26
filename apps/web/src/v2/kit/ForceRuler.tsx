import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ESCAPE, combatOutcomeTable, type EscapeVerdict, type PowerRange, type PowerSpan } from '@astera/rules';
import { compact, decimal } from '../../lib/format.js';
import { ratioAt, type ForceReading } from '../../lib/ruler.js';
import { staleness } from '../../lib/time.js';

const VERDICT = {
  RUN: 'counter.escapeRun',
  STAND: 'counter.escapeStand',
  UNSURE: 'counter.escapeUnsure',
} as const satisfies Record<EscapeVerdict, string>;

export interface ForceRulerProps {
  /**
   * `readPowerRange` for this wing against the reading: each side's power and their ratio.
   * Null while nothing is picked. Where nobody has looked it carries the wing alone.
   */
  power: PowerRange | null;
  /** Where their reading came from and how old it is; null when nothing was ever measured. */
  theirs: ForceReading | null;
  /** What the reading could not see — a phrase each. */
  notes?: readonly string[];
  /**
   * `escapeVerdict` on the ratio. Null wherever the rule does not apply: a pirate, a
   * caretaker world, a posture that holds, a season dealt before it (`fleetEscapeApplies`).
   */
  escape?: { verdict: EscapeVerdict | null; minimumCombatShips?: number } | null;
  /** Sends a probe; offered only where the defence was never measured. */
  onProbe?: () => void;
  /** The tank rides under the ruler on the launch sheet. */
  children?: ReactNode;
  /** What the wing is: the fleet being sent (the default) or, in the dossier, what stands home. */
  yoursLabel?: string;
  /**
   * The section's own heading, where the page names it (the dossier's "Power"). The ruler
   * then adds no second one, and its one-line meaning moves into the fold with the rule.
   */
  heading?: string;
}

/** One decimal under ten, whole above: a ratio is read at that grain and no finer. */
const times = (r: number): string => decimal(r, r >= 10 ? 0 : 1);
const tenths = (r: number): number => Math.round(r * 10) / 10;

/**
 * THE FORCE RULER, COMBAT v3. Spec B5 (docs/ui-v2/gozlemevi.md), owner 2026-10-25.
 *
 * Each side's matchup power against the other — firepower and durability, counters, research,
 * wounds and the Aegis in — as the range the probe allows, and their ratio as one band on a
 * strip from a quarter to four times, with even and the fleet escape marked. One sentence says
 * who is stronger and by how much. The rule, and the owner's table of what each side keeps at
 * a ratio, sit one tap deep: the inputs and the rule are given, the answer is withheld.
 *
 * WHAT IT REFUSES: a winner, a chance, an expected loss (owner K4). The reading is stale and
 * read in ranges and every battle rolls its shots; a screen that answered "will I win" would
 * end the bet the game is made of. A defence never measured draws no ratio — a gap stated as a
 * gap, beside the probe that closes it.
 */
export function ForceRuler({
  power,
  theirs,
  notes = [],
  escape = null,
  onProbe,
  children,
  yoursLabel,
  heading,
}: ForceRulerProps) {
  const { t } = useTranslation();
  const [explained, setExplained] = useState(false);
  const join = t('units.rangeJoin');
  const span = (s: PowerSpan): string =>
    compact(s.low) === compact(s.high) ? compact(s.high) : `${compact(s.low)}${join}${compact(s.high)}`;
  const band = (low: number, high: number): string =>
    times(low) === times(high) ? times(high) : `${times(low)}${join}${times(high)}`;
  const share = (s: { low: number; high: number }): string => t('units.percent', {
    value: Math.round(s.low * 100) === Math.round(s.high * 100)
      ? String(Math.round(s.high * 100))
      : `${String(Math.round(s.low * 100))}${join}${String(Math.round(s.high * 100))}`,
  });
  const ratio = (r: number): string => `1:${r.toLocaleString(t('units.numberLocale'), { maximumFractionDigits: 1 })}`;

  const weighed = power !== null && theirs !== null;
  const sentence = (() => {
    if (!weighed) return null;
    const { low, high } = power.ratio;
    if (power.mine.high <= 0) return t('counter.ratioUnarmed');
    if (power.theirs.high <= 0) return t('counter.ratioNoFire');
    if (tenths(low) >= 1 && tenths(high) <= 1) return t('counter.ratioEven');
    if (tenths(1 / low) <= 1) return t('counter.ratioYou', { band: band(Math.max(1, low), high) });
    if (tenths(high) <= 1) return t('counter.ratioThem', { band: band(Math.max(1, 1 / high), 1 / low) });
    return t('counter.ratioOpen', { them: times(1 / low), you: times(high) });
  })();

  const left = weighed ? ratioAt(power.ratio.low) : 0;
  const width = weighed ? ratioAt(power.ratio.high) - left : 0;
  const tone = !weighed ? '' : tenths(power.ratio.low) >= 1 ? 'bg-v2-self' : tenths(power.ratio.high) <= 1 ? 'bg-v2-hostile' : '';

  return (
    <section
      data-force-ruler=""
      aria-label={t('counter.compareLabel', {
        yours: power ? span(power.mine) : compact(0),
        theirs: weighed ? span(power.theirs) : t('counter.compareUnknown'),
      })}
      className="flex flex-col gap-2 font-v2-ui"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption font-semibold text-v2-ink">{heading ?? t('counter.compareHeading')}</p>
          <button
            type="button"
            aria-expanded={explained}
            onClick={() => { setExplained((open) => !open); }}
            className="shrink-0 py-1 text-caption text-v2-self underline decoration-dotted underline-offset-2"
          >
            {t('counter.compareRuleToggle')}
          </button>
        </div>
        {heading === undefined && <p data-testid="ruler-meaning" className="text-micro text-v2-ink-3">{t('counter.compareMeaning')}</p>}
        {explained && (
          <div data-testid="ruler-rule" className="mt-1 flex flex-col gap-1.5 text-caption leading-relaxed text-v2-ink-2">
            {heading !== undefined && <p>{t('counter.compareMeaning')}</p>}
            <p>{t('counter.compareRule')}</p>
            <div className="rounded-control border border-v2-line px-2 py-1.5">
              <p className="pb-1 text-micro font-semibold text-v2-ink">{t('counter.outcomeHeading')}</p>
              <div className="grid grid-cols-[3.25rem_1fr_1fr] gap-x-2 font-v2-mono text-micro">
                <span className="text-v2-ink-3">{t('counter.outcomeRatio')}</span>
                <span className="text-right text-v2-ink-3">{t('counter.outcomeWeak')}</span>
                <span className="text-right text-v2-ink-3">{t('counter.outcomeStrong')}</span>
                {combatOutcomeTable().map((row) => (
                  <div key={row.ratio} data-outcome-row="" className="contents">
                    <span className="text-v2-ink">{ratio(row.ratio)}</span>
                    <span className="text-right text-v2-ink-2">{share(row.weakKeeps)}</span>
                    <span className="text-right text-v2-ink-2">{share(row.strongLoses)}</span>
                  </div>
                ))}
              </div>
              <p className="pt-1 text-micro leading-snug text-v2-ink-3">{t('counter.outcomeNote')}</p>
            </div>
            {escape && <p>{t('counter.escapeRule', { distance: ESCAPE.fuelDistance, ratio: decimal(ESCAPE.ratio) })}
              {escape.minimumCombatShips ? ` ${t('counter.escapeMinimumRule', { count: escape.minimumCombatShips })}` : ''}</p>}
          </div>
        )}
      </div>

      {power === null ? (
        <p data-testid="ruler-pick" className="text-caption text-v2-ink-3">{t('counter.comparePick')}</p>
      ) : (
        <div className="flex flex-col gap-0.5 text-caption">
          {/* ── the wing: its own ships, read against what was read of theirs ── */}
          <div data-part="yours" className="flex items-baseline justify-between gap-2">
            <span className="text-v2-ink-2">{yoursLabel ?? t('counter.compareYours')}</span>
            <span data-testid="ruler-mine" className="shrink-0 font-v2-mono font-semibold text-v2-self">{span(power.mine)}</span>
          </div>
          {/* ── theirs: a reading, with its source and its age on it ── */}
          {theirs && (
            <div data-part="theirs" className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-v2-ink-2">
                {t('counter.compareTheirs')}
                <span className="ml-1 text-v2-ink-3">
                  {theirs.ageMinutes === null
                    ? t('counter.compareLive', { source: theirs.source })
                    : t('counter.compareRecord', { source: theirs.source, age: staleness(theirs.ageMinutes) })}
                </span>
              </span>
              <span data-testid="ruler-theirs" className="shrink-0 font-v2-mono font-semibold text-v2-ink">{span(power.theirs)}</span>
            </div>
          )}
        </div>
      )}

      {theirs === null && (
        <div
          data-part="unknown"
          className="flex items-center justify-between gap-2 rounded-control border border-dashed border-v2-line px-2 py-1.5"
        >
          <span className="text-caption text-v2-warn">{t('ruler.unknown')}</span>
          {onProbe && (
            <button
              type="button"
              onClick={onProbe}
              className="shrink-0 rounded-control border border-v2-self/60 bg-v2-self/10 px-2 py-1 text-caption font-semibold text-v2-ink"
            >
              {t('ruler.probe')}
            </button>
          )}
        </div>
      )}

      {weighed && (
        <div className="flex flex-col gap-1">
          {/*
            THE RATIO STRIP: a quarter to four times on a log scale, so "twice as strong" reads
            as far from even as "half". Their half is tinted theirs, yours yours; the band is the
            range the reading allows, and the ticks are even and the fleet escape.
          */}
          <div aria-hidden="true" className="relative mt-3 h-2.5">
            <span className="absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-v2-hostile/12" />
            <span className="absolute inset-y-0 right-0 w-1/2 rounded-r-full bg-v2-self/12" />
            <span
              data-part="ratio-band"
              className={`absolute inset-y-0 rounded-full ${tone} ${width < 1.5 ? '-translate-x-1/2' : ''}`}
              style={{
                left: `${String(width < 1.5 ? left + width / 2 : left)}%`,
                width: width < 1.5 ? '0.375rem' : `${String(width)}%`,
                ...(tone === '' ? { backgroundImage: 'linear-gradient(90deg, var(--color-v2-hostile), var(--color-v2-self))' } : {}),
              }}
            />
            <span data-part="even" className="absolute -inset-y-1 w-px -translate-x-1/2 bg-v2-ink-2" style={{ left: '50%' }} />
            {escape && (
              <span
                data-part="escape"
                className="absolute -inset-y-1 w-0 border-l border-dashed border-v2-warn"
                style={{ left: `${String(ratioAt(ESCAPE.ratio))}%` }}
              >
                <span className="absolute bottom-full left-0 -translate-x-1/2 pb-0.5 font-v2-mono text-micro leading-none text-v2-warn">
                  {`${decimal(ESCAPE.ratio)}×`}
                </span>
              </span>
            )}
          </div>
          <div aria-hidden="true" className="grid grid-cols-3 text-micro leading-none text-v2-ink-3">
            <span>{t('counter.axisTheirs')}</span>
            <span className="text-center">{t('counter.axisEven')}</span>
            <span className="text-right">{t('counter.axisYours')}</span>
          </div>
          <p data-testid="ruler-ratio" className="pt-0.5 text-caption font-semibold leading-snug text-v2-ink">{sentence}</p>
        </div>
      )}

      {escape?.verdict != null && (
        <p data-testid="ruler-verdict" className="text-caption leading-snug text-v2-ink-2">
          {t(VERDICT[escape.verdict], { ratio: decimal(ESCAPE.ratio) })}
        </p>
      )}

      {notes.length > 0 && <p data-testid="ruler-notes" className="text-micro text-v2-ink-3">{notes.join(t('counter.lineJoin'))}</p>}

      {children}
    </section>
  );
}
