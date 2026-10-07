import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';

/**
 * What this action will spend, compared with the available store.
 * The bright segment and the prominent figure both show the cost as selection
 * changes. The dim tail provides stock context; a separate red segment and
 * caption show any shortage without replacing the full cost.
 */
export function SpendBar({
  stock,
  spend,
  tone,
  label,
  compactSize = false,
  inline = false,
}: {
  /** What the world holds of this resource right now. */
  stock: number;
  /** What the act on screen would take out of it. Zero before anyone presses. */
  spend: number;
  /** Which substance, so the bar wears the colour the header already taught. */
  tone: 'alloy' | 'crystal' | 'deuterium';
  /** Two or three words naming the spend: "fuel for the flight". */
  label: string;
  /** Half height and no art, for a bar that sits inside a row rather than on a card. */
  compactSize?: boolean;
  /** One line — the label, the bar, the figure — for a bar riding a sticky header (the launch's tank). */
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const short = Math.max(0, spend - stock);
  const covered = Math.min(spend, Math.max(0, stock));
  const left = Math.max(0, stock - spend);
  /*
    THE SCALE IS WHICHEVER IS BIGGER. Against the store alone, a spend of twice
    the tank draws the same full bar as a spend of exactly the tank — the two
    states a player most needs to tell apart.
  */
  const scale = Math.max(1, stock, spend);
  const share = (value: number): number => Math.max(0, Math.min(100, (value / scale) * 100));

  const shortage = t('spend.shortfall', { short: compact(short) });
  const reading = t('spend.readingSpend', { label, spend: compact(spend) });
  const figure = (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span data-spend-amount className={`readout text-caption ${short > 0 ? 'text-threat-ink' : 'text-bone'}`}>
        {compact(spend)}
      </span>
      {short > 0 && (
        <span data-spend-short className="readout text-micro text-threat-ink">
          ({shortage})
        </span>
      )}
    </span>
  );

  const bar = (
      <div
        className={`socket flex overflow-hidden rounded-full ${inline ? 'h-1 min-w-0 flex-1' : `w-full ${compactSize ? 'h-1.5' : 'h-2'}`}`}
        role="img"
        aria-label={short > 0 ? `${reading}; ${shortage}` : reading}
      >
        <span
          data-part="spent"
          className={`h-full transition-[width] duration-200 ${SPENT[tone]}`}
          style={{ width: `${String(share(covered))}%` }}
        />
        <span
          data-part="left"
          className={`h-full ${LEFT[tone]}`}
          style={{ width: `${String(share(left))}%` }}
        />
        {short > 0 && (
          <>
            {/* The line the spend ran past. Without it the red reads as more tank. */}
            <span aria-hidden className="h-full w-px shrink-0 bg-bone/70" />
            <span
              data-part="short"
              className="h-full bg-threat/70"
              style={{ width: `${String(share(short))}%` }}
            />
          </>
        )}
      </div>
  );

  if (inline) {
    return (
      <div data-spend-bar data-short={short > 0 ? 'true' : 'false'} className="flex w-full items-center gap-2">
        <span className="shrink-0 text-caption text-faint">{label}</span>
        {bar}
        {figure}
      </div>
    );
  }

  return (
    <div
      data-spend-bar
      data-short={short > 0 ? 'true' : 'false'}
      className={`flex flex-col w-full ${compactSize ? 'gap-1' : 'gap-2'}`}
    >
      <div className="flex items-center gap-2">
        {!compactSize && (
          <img
            src={RESOURCE_ART[tone]}
            alt=""
            aria-hidden
            className="size-4 shrink-0 object-contain"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-caption text-faint">{label}</span>
        {figure}
      </div>
      {bar}
    </div>
  );
}

/** Full strength for what leaves, so the burn is the loudest part of the bar. */
const SPENT: Record<'alloy' | 'crystal' | 'deuterium', string> = {
  alloy: 'bg-alloy',
  crystal: 'bg-crystal',
  deuterium: 'bg-deuterium',
};

/** A quarter strength for what survives: present, and plainly not the subject. */
const LEFT: Record<'alloy' | 'crystal' | 'deuterium', string> = {
  alloy: 'bg-alloy/25',
  crystal: 'bg-crystal/25',
  deuterium: 'bg-deuterium/25',
};
