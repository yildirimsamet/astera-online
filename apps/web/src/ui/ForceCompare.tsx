import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';
import { staleness } from '../lib/time.js';

/**
 * YOUR FLEET AND THEIRS, ON ONE AXIS. Owner report.
 *
 * *"Savunma gücü yazıyor ama bunun neye karşılık geldiğini bilmiyorum."*
 *
 * The complaint was exact and the cause was not the wording. A probe's `defence`
 * band is `fleetValue(homeFleet)` — the resources sunk into whatever was standing
 * on that world — and the dossier printed it as `11,400 – 13,900` under "Defence
 * value", correctly sourced, correctly aged, and with nothing anywhere in the game
 * expressing the commander's OWN fleet on that scale. A figure with no second
 * figure beside it is not information. It is trivia with a provenance stamp.
 *
 * THE SHARED SCALE IS THE WHOLE COMPONENT, and it is the one legitimate exception
 * to `RangeBand`'s rule that "two bands on one card share no scale, and must not".
 * That prohibition guards against comparing stock against ship count — two
 * quantities in different units, where only the WIDTH is comparable. Here both
 * sides are the same quantity in the same units, and the comparison is the point;
 * sharing the axis is what makes it honest rather than what makes it a lie.
 *
 * WHAT IT REFUSES TO DO:
 *
 *   · NAME A WINNER. No verdict, no percentage, no green tick. The reading is
 *     stale, fuzzed, and blind to the counter cycle — and a screen that answers
 *     "will I win" ends the bet this game is made of. The player judges.
 *   · DRAW A ZERO FOR AN ABSENCE. Never-looked renders no enemy bar at all. An
 *     empty bar would say the world is undefended, which is the most expensive lie
 *     an intel surface can tell, on the exact screen where a fleet stops being
 *     recallable.
 *   · HIDE THE DOUBT. The stretch between the band's floor and its ceiling is
 *     hatched and is its own drawn part, so a vague probe still looks vague beside
 *     a fleet the commander counted exactly.
 */

export interface ForceReading {
  low: number;
  high: number;
  /** Where it came from, already worded: `sourceLabel` from the dossier. */
  source: string;
  /**
   * MINUTES SINCE IT WAS TRUE — NULL MEANS LIVE, and that is not zero.
   *
   * The dossier already draws this distinction and it matters more here than
   * anywhere: a world's defence is a frozen record and a pirate in a Telescope
   * circle is being looked at right now. Printing "0m old" over a live reading
   * would demote current sight to a very fresh memory.
   */
  ageMinutes: number | null;
}

export function ForceCompare({
  yours,
  theirs,
}: {
  yours: number;
  theirs: ForceReading | null;
}) {
  const { t } = useTranslation();

  /*
    THE CEILING IS WHICHEVER SIDE IS BIGGER, including the unmeasured top of the
    enemy band. Scaling to the band's FLOOR would draw the doubt off the end of the
    card, which is exactly where a commander would stop seeing it.
  */
  const top = Math.max(yours, theirs?.high ?? 0);
  const share = (value: number): number =>
    top <= 0 ? 0 : Math.max(0, Math.min(100, (value / top) * 100));

  return (
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
      <p className="legend text-crystal">{t('counter.compareHeading')}</p>

      {/* ── your side: counted, exact, no doubt to draw ── */}
      <div className="mt-2 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-micro text-faint">{t('counter.compareYours')}</span>
          <span className="num text-caption text-bone">{compact(yours)}</span>
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
            THE PROVENANCE RIDES THE LABEL. Owner directive: compact, and let the
            design explain itself. Where the reading came from and how old it is are
            qualifiers on the word "theirs", not a sentence of their own — a whole
            row for four words is exactly the spend the rest of this sheet was cut
            to stop.
          */}
          <span className="min-w-0 truncate text-micro text-faint">
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
          <span className="num shrink-0 text-caption text-threat-ink">
            {theirs
              ? theirs.low === theirs.high
                ? compact(theirs.high)
                : `${compact(theirs.low)}${t('rangeBand.join')}${compact(theirs.high)}`
              : t('counter.compareUnknown')}
          </span>
        </div>

        {theirs ? (
          <>
            <div className="socket flex h-1.5 w-full overflow-hidden rounded-full">
              <span
                data-part="theirs"
                className="h-full bg-threat/60 transition-[width] duration-200"
                style={{ width: `${String(share(theirs.low))}%` }}
              />
              {/*
                THE PART NOBODY MEASURED. Hatched rather than merely paler, because
                the same hatch already means "this is not solid ground" on the
                launch sheet's own defence bar — a commander who has learnt it once
                does not learn it twice.
              */}
              <span
                data-part="doubt"
                className="h-full transition-[width] duration-200"
                style={{
                  width: `${String(share(theirs.high) - share(theirs.low))}%`,
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgb(255 255 255 / 22%) 0 3px, transparent 3px 6px)',
                }}
              />
            </div>
          </>
        ) : (
          /*
            A GAP STATED AS A GAP, and as the thing that would close it. The
            dossier already treats "never looked" this way; a commitment surface
            has more reason to, not less.
          */
          <p data-testid="compare-unknown" className="text-micro leading-snug text-alloy">
            {t('counter.compareUnknownWhy')}
          </p>
        )}
      </div>

      <p className="mt-2 text-micro leading-snug text-faint/80">
        {t('counter.compareNote')}
      </p>
    </section>
  );
}
