import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';
import { staleness } from '../lib/time.js';

/**
 * YOUR FLEET AND THEIRS, ON ONE AXIS — AND WHERE THIS WING STOPS WINNING ON IT.
 *
 * *"Savunma gücü yazıyor ama bunun neye karşılık geldiğini bilmiyorum."* The first
 * answer was the shared axis: a probe's band is `combatValue` of what stood there,
 * and nothing in the game had put the commander's own wing on that scale, so the
 * band was a figure with no second figure beside it.
 *
 * D199 — *"ne işe yarıyor, neye göre hesaplanıyor"* — found the second half missing:
 * two bars in one currency still left "is this fight my size" to be answered by
 * losing it. An equal wing only BREAKS a wall and loses two thirds of itself doing
 * it; a clean sweep wants half as much again; research, a charged Aegis, ground
 * guns and the counter cycle move that from a tenth to three times. So the enemy
 * axis now carries two LINES from the battle engine itself (`forecastLines`): below
 * the first, this wing clears the wall; below the second, it breaks it. Where the
 * enemy band ends against them is the expectation — the commander forms it.
 *
 * THE SHARED SCALE IS THE WHOLE COMPONENT, and it is the one legitimate exception
 * to `RangeBand`'s rule that "two bands on one card share no scale". That guards
 * against comparing stock with ship count; here both bars measure the resource
 * cost of armed units, not damage or hit points.
 *
 * WHAT IT REFUSES TO DO:
 *
 *   · NAME A WINNER. No verdict, no percentage of winning, no green tick. The
 *     reading is stale and fuzzed and the ±8% roll is left out; the lines are the
 *     rule applied to the inputs, and `interface.md` §2 withholds the answer.
 *   · DRAW A ZERO FOR AN ABSENCE. Never-looked renders no enemy bar at all.
 *   · HIDE THE DOUBT. The band's unmeasured stretch is hatched, and so is the part
 *     of a line the reading leaves open (an unread wall, an unknown shield).
 * Basic units are stated before the sticky comparison. The detailed rule folds,
 * while the figures, estimate and fuel stay together as the fleet is adjusted.
 */

export interface ForceReading {
  low: number;
  high: number;
  /** Where it came from, already worded: `sourceLabel` from the dossier. */
  source: string;
  /**
   * MINUTES SINCE IT WAS TRUE — NULL MEANS LIVE, and that is not zero.
   *
   * A world's defence is a frozen record and a pirate in a Telescope circle is
   * being looked at right now. Printing "0m old" over a live reading would demote
   * current sight to a very fresh memory.
   */
  ageMinutes: number | null;
}

/** `forecastLines`: armed-unit resource value at each limit, least to most favourable. */
export interface ForceLines {
  clears: { low: number; high: number };
  breaks: { low: number; high: number };
}

const HATCH = 'repeating-linear-gradient(45deg, rgb(255 255 255 / 22%) 0 3px, transparent 3px 6px)';

export function ForceCompare({
  yours,
  theirs,
  lines = null,
  loss = null,
  notes = [],
  children,
}: {
  yours: number;
  theirs: ForceReading | null;
  /** Where this wing stops clearing and breaking a wall. Null while nothing is picked. */
  lines?: ForceLines | null;
  /** The share of the wing the fight is expected to cost against the reading. */
  loss?: { low: number; high: number } | null;
  /** What the lines could not see, and what else is known about the reading — a phrase each. */
  notes?: readonly string[];
  /**
   * WHAT THE LAUNCH COSTS, INSIDE THIS BOX RATHER THAN UNDER IT. D183, owner
   * correction: *"aynı kutunun içinde altında olsun. güç gösteren kutu sticky,
   * sheet'te scroll yapınca yakıt gösteren alan sayfanın üstünde kalıyor."*
   *
   * This plate is `sticky`, so a sibling placed below it scrolls out from under a
   * box that stays pinned — and the two figures a commander adjusts a wing against,
   * the force it represents and the fuel it burns, come apart the moment the sheet
   * moves. They have to travel together.
   */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [explained, setExplained] = useState(false);

  /*
    THE CEILING IS WHICHEVER SIDE IS BIGGER, including the unmeasured top of the
    enemy band. With no enemy band the wing's own lines join it, so "what can this
    wing take" is still drawn against something. A line past the ceiling is clipped:
    stretching the axis to it would shrink the band the decision is actually about.
  */
  const top = Math.max(yours, theirs?.high ?? 0, theirs ? 0 : lines?.breaks.low ?? 0);
  const share = (value: number): number =>
    top <= 0 ? 0 : Math.max(0, Math.min(100, (value / top) * 100));
  const span = (s: { low: number; high: number }): string =>
    s.low === s.high ? compact(s.low) : `${compact(s.low)}${t('units.rangeJoin')}${compact(s.high)}`;
  const lossShare = loss === null
    ? null
    : t('units.percent', {
      value: Math.round(loss.low * 100) === Math.round(loss.high * 100)
        ? String(Math.round(loss.high * 100))
        : `${String(Math.round(loss.low * 100))}${t('units.rangeJoin')}${String(Math.round(loss.high * 100))}`,
    });

  return (
    <>
      {/* Prose scrolls away, so the pinned comparison leaves room to choose ships. */}
      <div className="mt-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-body font-semibold text-crystal">{t('counter.compareHeading')}</p>
          <button
            type="button"
            className="shrink-0 py-2 text-body text-crystal underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crystal"
            aria-expanded={explained}
            onClick={() => { setExplained((open) => !open); }}
          >
            {t('counter.compareRuleToggle')}
          </button>
        </div>
        <p className="mt-1 text-body leading-relaxed text-dim">{t('counter.compareMeaning')}</p>
        {explained ? (
          <p data-testid="compare-rule" className="mt-2 text-body leading-relaxed text-dim">
            {t('counter.compareRule')}
          </p>
        ) : null}
      </div>
    <section
      data-force-compare
      className="plate plate-inset bg-panel !opacity-100 z-50 mt-1 px-3 py-2 sticky top-0"
      aria-label={t('counter.compareLabel', {
        yours: compact(yours),
        theirs: theirs
          ? `${compact(theirs.low)}${t('rangeBand.join')}${compact(theirs.high)}`
          : t('counter.compareUnknown'),
      })}
    >
      {/* ── your side: counted, exact, no doubt to draw ── */}
      <div className="mt-2 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-body text-dim">{t('counter.compareYours')}</span>
          <span className="num text-title text-bone">{compact(yours)}</span>
        </div>
        <div className="socket h-1.5 w-full overflow-hidden rounded-full">
          <span
            data-part="yours"
            className="block h-full rounded-full bg-bone/70 transition-[width] duration-200"
            style={{ width: `${String(share(yours))}%` }}
          />
        </div>
      </div>

      {/* ── their side: a reading, with its width and its age on it ── */}
      <div className="mt-2 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          {/*
            THE PROVENANCE RIDES THE LABEL. Where the reading came from and how old
            it is qualify the word "theirs"; a whole row for four words is exactly the
            spend the rest of this sheet was cut to stop.
          */}
          <span className="min-w-0 text-body text-dim">
            {t('counter.compareTheirs')}
            {theirs ? (
              <span data-testid="compare-provenance" className="ml-1 text-faint/80">
                {theirs.ageMinutes === null
                  ? t('counter.compareLive', { source: theirs.source })
                  : t('counter.compareRecord', {
                    source: theirs.source,
                    age: staleness(theirs.ageMinutes),
                  })}
              </span>
            ) : null}
          </span>
          <span className="num shrink-0 text-title text-threat-ink">
            {theirs
              ? theirs.low === theirs.high
                ? compact(theirs.high)
                : `${compact(theirs.low)}${t('rangeBand.join')}${compact(theirs.high)}`
              : t('counter.compareUnknown')}
          </span>
        </div>

        {theirs ? (
          <div className="socket flex h-1.5 w-full overflow-hidden rounded-full">
            <span
              data-part="theirs"
              className="h-full bg-threat/60 transition-[width] duration-200"
              style={{ width: `${String(share(theirs.low))}%` }}
            />
            {/*
              THE PART NOBODY MEASURED. Hatched rather than merely paler, because the
              same hatch already means "this is not solid ground" on the launch
              sheet's own defence bar — a commander who has learnt it once does not
              learn it twice.
            */}
            <span
              data-part="doubt"
              className="h-full transition-[width] duration-200"
              style={{ width: `${String(share(theirs.high) - share(theirs.low))}%`, backgroundImage: HATCH }}
            />
          </div>
        ) : (
          /*
            A GAP STATED AS A GAP, and as the thing that would close it. The dossier
            already treats "never looked" this way; a commitment surface has more
            reason to, not less.
          */
          <p data-testid="compare-unknown" className="text-body leading-relaxed text-alloy">
            {t('counter.compareUnknownWhy')}
          </p>
        )}

        {/*
          THE LINES, AS A STRIP UNDER THE ENEMY'S BAR ON THE SAME SCALE. Cleared in
          the opportunity hue, broken in the alloy one, repelled as the empty track.
          The part of each line the reading leaves open is hatched — the same mark
          as the band's own doubt, meaning the same thing.
        */}
        {lines && (
          <div aria-hidden className="socket flex h-1 w-full overflow-hidden rounded-full">
            <span
              data-part="zone-clears"
              className="h-full bg-opportunity/70"
              style={{ width: `${String(share(lines.clears.low))}%` }}
            />
            <span
              data-part="zone-clears-open"
              className="h-full bg-opportunity/30"
              style={{
                width: `${String(share(lines.clears.high) - share(lines.clears.low))}%`,
                backgroundImage: HATCH,
              }}
            />
            <span
              data-part="zone-breaks"
              className="h-full bg-alloy/60"
              style={{ width: `${String(Math.max(0, share(lines.breaks.low) - share(lines.clears.high)))}%` }}
            />
            <span
              data-part="zone-breaks-open"
              className="h-full bg-alloy/25"
              style={{
                width: `${String(share(lines.breaks.high) - share(Math.max(lines.breaks.low, lines.clears.high)))}%`,
                backgroundImage: HATCH,
              }}
            />
          </div>
        )}
      </div>

      {lines && (
        <p data-testid="compare-lines" className="num mt-2 grid gap-1 text-label leading-relaxed">
          <span className="text-opportunity">{t('counter.linesClears', { at: span(lines.clears) })}</span>
          <span className="text-alloy">{t('counter.linesBreaks', { at: span(lines.breaks) })}</span>
        </p>
      )}
      {lossShare !== null && (
        <div className="mt-2 border-t border-line-soft pt-2">
        <p data-testid="compare-loss" className="text-body font-semibold leading-relaxed text-bone">
          {t('counter.lossLabel', { share: lossShare })}
        </p>
        <p className="mt-1 text-caption leading-relaxed text-dim">{t('counter.lossUncertainty')}</p>
        </div>
      )}
      {notes.length > 0 && (
        <p data-testid="compare-notes" className="mt-1 text-label leading-relaxed text-dim">
          {notes.join(t('counter.lineJoin'))}
        </p>
      )}

      {/*
        THE THIRD BAR, AND IT IS A DIFFERENT CURRENCY ON PURPOSE. The force bars
        share an axis with each other and this one shares nothing with either; the
        hairline is the whole statement of that.
      */}
      {children !== undefined && (
        <div className="mt-2 border-t border-line-soft pt-2">{children}</div>
      )}
    </section>
    </>
  );
}

/** The worst-case consequence is printed at the irreversible launch control. */
export function FleetLossWarning({ loss }: { loss: { low: number; high: number } | null }) {
  const { t } = useTranslation();
  // Match the rounded percentage the player sees in the comparison above. A
  // displayed 100% without the corresponding consequence would contradict itself.
  if (loss === null || Math.round(loss.high * 100) < 100) return null;
  return (
    <p data-total-loss-risk className="mb-2 border-l-2 border-threat pl-3 text-title font-semibold leading-relaxed text-threat-ink">
      {t('counter.lossTotalRisk')}
    </p>
  );
}
