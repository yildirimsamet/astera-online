import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';

/**
 * A THING YOU KNOW ROUGHLY, DRAWN ROUGHLY. Owner instruction.
 *
 * A probe report is the one number in this game that is deliberately NOT a
 * number — D127 makes it a silhouette, fuzzed at the look and stale from the
 * moment it lands — and the screen was printing it as `1.2k–3.4k` under a grey
 * label. That is a range a player has to read as two figures, subtract, and then
 * decide how much to trust. Three operations, for the fact the intel layer exists
 * to sell.
 *
 * SO THE DOUBT IS THE SHAPE. The bar runs from nothing to the top of what the
 * probe could see; the lit band is where the truth lies, and its WIDTH is how
 * much the reading is worth. A clean read is a narrow block sitting where the
 * value is. A poor one smears across half the card, and a commander who reads no
 * digits at all can still tell those two apart — which is the whole product of
 * raising a Telescope or catching a target with its fleet at home.
 *
 * THE TICK IS THE MIDPOINT, and it is drawn thin on purpose. It is the best guess
 * and it is not a promise; a thick mark would read as the answer, with the band
 * demoted to decoration around it.
 *
 * TWO BANDS ON ONE CARD SHARE NO SCALE, and must not: stock is in thousands and a
 * fleet is in single ships. Each band is measured against its own ceiling, and
 * what is being compared across them is the WIDTH, never the position.
 */
export function RangeBand({
  label,
  low,
  high,
  tone = 'crystal',
}: {
  /** What is being read: stock, defence, ships. */
  label: string;
  low: number;
  high: number;
  tone?: 'crystal' | 'alloy' | 'threat';
}) {
  const { t } = useTranslation();
  /*
    THE SCALE IS THE TOP OF THE READING. Nothing else is available — a probe does
    not report the world's ceiling — and inventing one would draw a band whose
    position means something it does not.
  */
  const top = Math.max(1, high);
  const start = Math.max(0, Math.min(100, (Math.max(0, low) / top) * 100));
  /*
    A BAND HAS A FLOOR. A perfect read is low === high, which is zero width, and a
    zero-width band is not a more precise picture — it is no picture. Three per
    cent is thin enough to still read as "I know this" beside a fuzzy neighbour.
  */
  const width = Math.max(3, 100 - start);
  const mid = start + width / 2;

  return (
    <div data-range-band className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="legend truncate">{label}</span>
      </div>
      <div
        className="socket relative h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={t('rangeBand.reading', {
          label,
          low: compact(Math.max(0, low)),
          high: compact(high),
        })}
      >
        <span
          data-part="band"
          className={`absolute inset-y-0 rounded-full ${BAND[tone]}`}
          style={{ left: `${String(start)}%`, width: `${String(width)}%` }}
        />
        {/* The midpoint: the guess, stated as thinly as a guess deserves. */}
        <span
          aria-hidden
          data-part="mid"
          className="absolute inset-y-0 w-px bg-bone/80"
          style={{ left: `${String(mid)}%` }}
        />
      </div>
      {/*
        THE FIGURES ARE THE CAPTION, not the reading. They stay because a player
        deciding whether to commit a fleet eventually wants the digits — but they
        are `micro`, under the shape, where they are checked rather than parsed.
      */}
      <p className="num text-micro text-faint">
        {compact(Math.max(0, low))}
        <span className="text-faint">{t('rangeBand.join')}</span>
        {compact(high)}
      </p>
    </div>
  );
}

const BAND: Record<'crystal' | 'alloy' | 'threat', string> = {
  crystal: 'bg-crystal/55',
  alloy: 'bg-alloy/55',
  threat: 'bg-threat/50',
};
