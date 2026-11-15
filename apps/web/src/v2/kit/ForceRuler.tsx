import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ESCAPE, type EscapeVerdict, type PowerRange, type PowerSpan } from '@astera/rules';
import { GameButton, Glyph } from '../../game-ui/index.js';
import { compact, decimal } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { OWN_SOUND, playSound } from '../../lib/sound.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';
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
 * who is stronger and by how much. The rule sits one tap deep; the internal outcome table
 * stays private. The inputs and the rule are given, the answer is withheld.
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
  const why = useOwnPress(() => { playSound('tap'); haptic('tap'); setExplained((open) => !open); });
  const join = t('units.rangeJoin');
  const span = (s: PowerSpan): string =>
    compact(s.low) === compact(s.high) ? compact(s.high) : `${compact(s.low)}${join}${compact(s.high)}`;
  const band = (low: number, high: number): string =>
    times(low) === times(high) ? times(high) : `${times(low)}${join}${times(high)}`;

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
  const tone = !weighed ? 'open' : tenths(power.ratio.low) >= 1 ? 'self' : tenths(power.ratio.high) <= 1 ? 'hostile' : 'open';
  const dot = width < 1.5;

  return (
    <section
      data-force-ruler=""
      aria-label={t('counter.compareLabel', {
        yours: power ? span(power.mine) : compact(0),
        theirs: weighed ? span(power.theirs) : t('counter.compareUnknown'),
      })}
      className="gk-ruler"
    >
      <div>
        <div className="gk-ruler__head">
          <span className="gk-ruler__title">{heading ?? t('counter.compareHeading')}</span>
          <button
            type="button"
            {...OWN_SOUND}
            className="gk-round gk-round--small"
            aria-label={t('counter.compareRuleToggle')}
            aria-expanded={explained}
            onPointerDown={why.onPointerDown}
            onClick={why.onClick}
          >
            <span className="gk-round__face"><Glyph id="help" /></span>
          </button>
        </div>
        {heading === undefined && <p data-testid="ruler-meaning" className="gk-sub">{t('counter.compareMeaning')}</p>}
        {explained && (
          <div data-testid="ruler-rule" className="gk-well gk-ruler__rule">
            {heading !== undefined && <p>{t('counter.compareMeaning')}</p>}
            <p>{t('counter.compareRule')}</p>
            {escape && <p>{t('counter.escapeRule', { distance: ESCAPE.fuelDistance, ratio: decimal(ESCAPE.ratio) })}
              {escape.minimumCombatShips ? ` ${t('counter.escapeMinimumRule', { count: escape.minimumCombatShips })}` : ''}</p>}
          </div>
        )}
      </div>

      {power === null ? (
        <p data-testid="ruler-pick" className="gk-sub">{t('counter.comparePick')}</p>
      ) : (
        <div className="gk-ruler__sides">
          {/* ── the wing: its own ships, read against what was read of theirs ── */}
          <div data-part="yours" className="gk-ruler__side">
            <span className="gk-ruler__who">{yoursLabel ?? t('counter.compareYours')}</span>
            <span data-testid="ruler-mine" className="gk-num gk-ruler__power" data-tone="self">{span(power.mine)}</span>
          </div>
          {/* ── theirs: a reading, with its source and its age on it ── */}
          {theirs && (
            <div data-part="theirs" className="gk-ruler__side">
              <span className="gk-ruler__who">
                {t('counter.compareTheirs')}
                <span className="gk-ruler__src">
                  {theirs.ageMinutes === null
                    ? t('counter.compareLive', { source: theirs.source })
                    : t('counter.compareRecord', { source: theirs.source, age: staleness(theirs.ageMinutes) })}
                </span>
              </span>
              <span data-testid="ruler-theirs" className="gk-num gk-ruler__power">{span(power.theirs)}</span>
            </div>
          )}
        </div>
      )}

      {theirs === null && (
        <div data-part="unknown" className="gk-ruler__unknown">
          <span className="gk-ruler__gap"><Glyph id="warn" />{t('ruler.unknown')}</span>
          {onProbe && (
            <GameButton size="sm" glyph="eye" onPress={onProbe}>{t('ruler.probe')}</GameButton>
          )}
        </div>
      )}

      {weighed && (
        <div className="gk-ruler__weigh">
          {/*
            THE RATIO STRIP: a quarter to four times on a log scale, so "twice as strong" reads
            as far from even as "half". Their half is tinted theirs, yours yours; the band is the
            range the reading allows, and the ticks are even and the fleet escape.
          */}
          <div aria-hidden="true" className="gk-ruler__strip">
            <span className="gk-ruler__half" data-side="theirs" />
            <span className="gk-ruler__half" data-side="yours" />
            <span
              data-part="ratio-band"
              data-tone={tone}
              className={`gk-ruler__band${dot ? ' gk-ruler__band--dot' : ''}`}
              style={{
                left: `${String(dot ? left + width / 2 : left)}%`,
                ...(dot ? {} : { width: `${String(width)}%` }),
              }}
            />
            <span data-part="even" className="gk-ruler__tick" style={{ left: '50%' }} />
            {escape && (
              <span
                data-part="escape"
                className="gk-ruler__escape"
                style={{ left: `${String(ratioAt(ESCAPE.ratio))}%` }}
              >
                <span className="gk-num gk-ruler__escapeat">{`${decimal(ESCAPE.ratio)}×`}</span>
              </span>
            )}
          </div>
          <div aria-hidden="true" className="gk-ruler__axis">
            <span>{t('counter.axisTheirs')}</span>
            <span>{t('counter.axisEven')}</span>
            <span>{t('counter.axisYours')}</span>
          </div>
          <p data-testid="ruler-ratio" className="gk-ruler__ratio">{sentence}</p>
        </div>
      )}

      {escape?.verdict != null && (
        <p data-testid="ruler-verdict" className="gk-ruler__verdict">
          {t(VERDICT[escape.verdict], { ratio: decimal(ESCAPE.ratio) })}
        </p>
      )}

      {notes.length > 0 && <p data-testid="ruler-notes" className="gk-sub">{notes.join(t('counter.lineJoin'))}</p>}

      {children}
    </section>
  );
}
