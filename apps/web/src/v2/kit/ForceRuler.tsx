import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ESCAPE, type EscapeVerdict } from '@astera/rules';
import { compact, decimal } from '../../lib/format.js';
import { rulerTop, type ForceLines, type ForceReading } from '../../lib/ruler.js';
import { staleness } from '../../lib/time.js';

const VERDICT = {
  RUN: 'counter.escapeRun',
  STAND: 'counter.escapeStand',
  UNSURE: 'counter.escapeUnsure',
} as const satisfies Record<EscapeVerdict, string>;

export interface ForceRulerProps {
  /** `combatValue` of the wing being sent. */
  yours: number;
  /** The last reading of their defence; null when nothing was ever measured. */
  theirs: ForceReading | null;
  /** `forecastLines` for this wing. Null while nothing is picked. */
  lines?: ForceLines | null;
  /** The share of the wing the fight is expected to cost against the reading. */
  loss?: { low: number; high: number } | null;
  /** What the lines could not see — a phrase each. */
  notes?: readonly string[];
  /**
   * Where their ships lift off (`escapeLine`) and `escapeVerdict` on the reading.
   * Null wherever the rule does not apply: a pirate, a caretaker world, a season
   * dealt before it (`fleetEscapeApplies`).
   */
  escape?: { at: number; verdict: EscapeVerdict | null; minimumCombatShips?: number } | null;
  /** Sends a probe; offered only where the defence was never measured. */
  onProbe?: () => void;
  /** The matchup line (B6) rides under the ruler. */
  children?: ReactNode;
  /** What the wing is: the fleet being sent (the default) or, in the dossier, what stands home. */
  yoursLabel?: string;
  /**
   * The section's own heading, where the page names it (the dossier's "Power"). The ruler
   * then adds no second one, and its one-line meaning moves into the fold with the rule.
   */
  heading?: string;
}

/**
 * THE FORCE RULER. Spec B5 (docs/ui-v2/gozlemevi.md) — `ui/ForceCompare.tsx`, redrawn.
 *
 * Two strips on one axis: the wing, solid teal, and the probe's defence band —
 * solid to its floor, hatched across the stretch nobody measured. Three marks sit
 * on the defence strip, each the rules' own figure: the dashed warn line where
 * their ships run, the teal-edged range this wing surely clears, the pale-edged
 * range it at least breaks. Where the band ends against them is the expectation;
 * the commander forms it.
 *
 * WHAT IT REFUSES: a winner, a win percentage, a green tick. The reading is stale
 * and fuzzed and the ±8% roll is left out, and a screen that answered "will I win"
 * would end the bet the game is made of. A defence never measured draws no strip
 * at all — a gap stated as a gap, beside the probe that closes it.
 */
export function ForceRuler({
  yours,
  theirs,
  lines = null,
  loss = null,
  notes = [],
  escape = null,
  onProbe,
  children,
  yoursLabel,
  heading,
}: ForceRulerProps) {
  const { t } = useTranslation();
  const [explained, setExplained] = useState(false);

  const top = rulerTop(yours, theirs?.high ?? 0, lines?.breaks.high ?? 0);
  const share = (value: number): number => (top > 0 ? Math.max(0, Math.min(100, (value / top) * 100)) : 0);
  const pct = (value: number): string => `${String(value)}%`;
  const range = (s: { low: number; high: number }): string =>
    s.low === s.high ? compact(s.low) : `${compact(s.low)}${t('units.rangeJoin')}${compact(s.high)}`;
  const lossShare = loss === null
    ? null
    : t('units.percent', {
      value: Math.round(loss.low * 100) === Math.round(loss.high * 100)
        ? String(Math.round(loss.high * 100))
        : `${String(Math.round(loss.low * 100))}${t('units.rangeJoin')}${String(Math.round(loss.high * 100))}`,
    });

  const mark = (part: string, s: { low: number; high: number }, edge: string) => {
    const left = share(s.low);
    const width = share(s.high) - left;
    return (
      <span
        data-part={part}
        aria-hidden="true"
        className={`absolute -inset-y-1 rounded-cell border ${edge} ${width > 0 ? 'v2-hatch' : ''}`}
        style={{ left: pct(left), width: pct(width) }}
      />
    );
  };

  return (
    <section
      data-force-ruler=""
      aria-label={t('counter.compareLabel', {
        yours: compact(yours),
        theirs: theirs ? range(theirs) : t('counter.compareUnknown'),
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
        {heading === undefined && <p className="text-micro text-v2-ink-3">{t('counter.compareMeaning')}</p>}
        {explained && (
          <div data-testid="ruler-rule" className="mt-1 flex flex-col gap-1 text-caption leading-relaxed text-v2-ink-2">
            {heading !== undefined && <p>{t('counter.compareMeaning')}</p>}
            <p>{t('counter.compareRule')}</p>
            {escape && <p>{t('counter.escapeRule', { distance: ESCAPE.fuelDistance, ratio: decimal(ESCAPE.ratio) })}
              {escape.minimumCombatShips ? ` ${t('counter.escapeMinimumRule', { count: escape.minimumCombatShips })}` : ''}</p>}
          </div>
        )}
      </div>

      {/* ── the wing: counted, exact, no doubt to draw ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2 text-caption">
          <span className="text-v2-ink-2">{yoursLabel ?? t('counter.compareYours')}</span>
          <span className="font-v2-mono text-v2-self">{compact(yours)}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-v2-line">
          <span
            data-part="yours"
            className="absolute inset-y-0 left-0 rounded-full bg-v2-self transition-[width] duration-200"
            style={{ width: pct(share(yours)) }}
          />
        </div>
      </div>

      {/* ── their defence: a reading, with its width and its age on it ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2 text-caption">
          <span className="min-w-0 text-v2-ink-2">
            {t('counter.compareTheirs')}
            {theirs && (
              <span className="ml-1 text-v2-ink-3">
                {theirs.ageMinutes === null
                  ? t('counter.compareLive', { source: theirs.source })
                  : t('counter.compareRecord', { source: theirs.source, age: staleness(theirs.ageMinutes) })}
              </span>
            )}
          </span>
          {theirs && <span className="shrink-0 font-v2-mono text-v2-ink">{range(theirs)}</span>}
        </div>
        {theirs ? (
          <div className="relative my-1 h-1.5 rounded-full bg-v2-line">
            <span
              data-part="band-floor"
              className="absolute inset-y-0 left-0 rounded-l-full bg-v2-hostile/45"
              style={{ width: pct(share(theirs.low)) }}
            />
            <span
              data-part="band"
              className="v2-hatch absolute inset-y-0"
              style={{ left: pct(share(theirs.low)), width: pct(share(theirs.high) - share(theirs.low)) }}
            />
            {lines && mark('clears', lines.clears, 'border-v2-self')}
            {lines && mark('breaks', lines.breaks, 'border-v2-ink-2')}
            {escape && (
              <span
                data-part="escape-line"
                aria-hidden="true"
                className="absolute -inset-y-1.5 w-0 border-l border-dashed border-v2-warn"
                style={{ left: pct(share(escape.at)) }}
              />
            )}
          </div>
        ) : (
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
      </div>

      {(escape ?? lines) && (
        /*
          ONE LINE PER CONDITION (2026-10-06): each now states its condition and its outcome, which
          is too long to share a row at 350 px — wrapped side by side, the second ran off the edge.
        */
        <ul data-testid="ruler-lines" className="flex flex-col gap-0.5 font-v2-mono text-micro text-v2-ink-2">
          {escape && (
            <li className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-0 shrink-0 border-l border-dashed border-v2-warn" />
              {t('counter.escapeAt', { at: compact(escape.at) })}
            </li>
          )}
          {lines && (
            <li className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-1.5 shrink-0 rounded-cell border border-v2-self" />
              {t('counter.linesClears', { at: range(lines.clears) })}
            </li>
          )}
          {lines && (
            <li className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-1.5 shrink-0 rounded-cell border border-v2-ink-2" />
              {t('counter.linesBreaks', { at: range(lines.breaks) })}
            </li>
          )}
        </ul>
      )}

      {escape?.verdict != null && (
        <p data-testid="ruler-verdict" className="text-caption leading-snug text-v2-ink">
          {t(VERDICT[escape.verdict], { ratio: decimal(ESCAPE.ratio) })}
        </p>
      )}

      {lossShare !== null && (
        <div data-testid="ruler-loss" className="border-t border-v2-line pt-1.5">
          <p className="text-caption font-semibold text-v2-ink">{t('counter.lossLabel', { share: lossShare })}</p>
          <p className="text-micro text-v2-ink-3">{t('counter.lossUncertainty')}</p>
        </div>
      )}

      {notes.length > 0 && <p data-testid="ruler-notes" className="text-micro text-v2-ink-3">{notes.join(t('counter.lineJoin'))}</p>}

      {children}
    </section>
  );
}
