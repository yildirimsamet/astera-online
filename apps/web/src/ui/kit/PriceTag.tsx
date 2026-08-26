import { AlloyIcon, CrystalIcon } from '../icons/index.js';
import { compact, full } from '../../lib/format.js';

/**
 * PRICE — what a decision costs, and whether you can pay for it.
 *
 * `docs/interface.md` finding 1: every item in a progression system is in exactly one
 * of four states — owned, affordable, unaffordable, locked — and the standard failure
 * is rendering the last two identically. This component owns the middle two. A price
 * you cannot meet goes threat-red on the specific resource you are short of, so the
 * player learns *which* number is the problem without doing the subtraction.
 *
 * Zero costs are omitted rather than shown as "0". A Wasp costs alloy and no crystal;
 * printing "0 crystal" implies crystal is part of the decision, and it is not.
 *
 * Line icons rather than the 450px renders on purpose: prices appear at 12–14px in
 * dense rows, and that is the size at which the renders turn to mush. The renders get
 * the hero moments — the HUD pills and the art wells.
 */
export function PriceTag({
  alloy = 0,
  crystal = 0,
  have,
  exact = false,
  size = 'md',
  className = '',
}: {
  alloy?: number;
  crystal?: number;
  /** Omit when affordability is not the question — a report, a loss line. */
  have?: { alloy: number; crystal: number };
  /** Founding and other irreversible payments expose the exact amount. */
  exact?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const text = size === 'sm' ? 'text-micro' : 'text-body';
  const glyph = size === 'sm' ? 'size-3' : 'size-3.5';

  const shortAlloy = have !== undefined && alloy > have.alloy;
  const shortCrystal = have !== undefined && crystal > have.crystal;

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {alloy > 0 && (
        <span className={`inline-flex items-center gap-1 ${shortAlloy ? 'text-threat' : 'text-alloy'}`}>
          <AlloyIcon className={glyph} />
          <span className={`num ${text}`}>{exact ? full(alloy) : compact(alloy)}</span>
        </span>
      )}
      {crystal > 0 && (
        <span className={`inline-flex items-center gap-1 ${shortCrystal ? 'text-threat' : 'text-crystal'}`}>
          <CrystalIcon className={glyph} />
          <span className={`num ${text}`}>{exact ? full(crystal) : compact(crystal)}</span>
        </span>
      )}
      {alloy <= 0 && crystal <= 0 && <span className={`num ${text} text-faint`}>free</span>}
    </span>
  );
}

/** One resource figure with its mark. For gains, losses and rates. */
export function Amount({
  value,
  of,
  size = 'md',
  tone,
  className = '',
}: {
  value: number | string;
  of: 'alloy' | 'crystal';
  size?: 'sm' | 'md';
  /** Overrides the resource hue — used where the sign matters more than the kind. */
  tone?: 'threat' | 'opportunity' | 'dim';
  className?: string;
}) {
  const Mark = of === 'alloy' ? AlloyIcon : CrystalIcon;
  const colour =
    tone === 'threat'
      ? 'text-threat'
      : tone === 'opportunity'
        ? 'text-opportunity'
        : tone === 'dim'
          ? 'text-dim'
          : of === 'alloy'
            ? 'text-alloy'
            : 'text-crystal';

  return (
    <span className={`inline-flex items-center gap-1 ${colour} ${className}`}>
      <Mark className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      <span className={`num ${size === 'sm' ? 'text-micro' : 'text-body'}`}>{value}</span>
    </span>
  );
}
