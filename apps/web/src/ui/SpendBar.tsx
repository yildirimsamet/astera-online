import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';

/**
 * WHAT A PRICE TAKES OUT OF WHAT YOU HOLD. Owner instruction, and the third
 * member of D142's vocabulary.
 *
 * `CapacityBar` answers "does it fit"; `Meter` answers "how full is it". Neither
 * answers the question a commander holds while looking at a fuel figure or a
 * cargo hold, which is **what will be left of my tank after I press this** — and
 * that question was being answered everywhere in the game by two numbers on one
 * grey line and a subtraction the player was expected to do in their head.
 *
 * WHAT THE PICTURE SAYS:
 *
 *   · THE WHOLE BAR is what is standing in the store right now.
 *   · THE BRIGHT PART, taken off the LEFT-HAND end, is what this act would burn.
 *     It shrinks the remainder in front of the player's eyes as the stepper moves,
 *     which is the same teaching mechanism the build sheet's bright segment uses.
 *   · WHAT IS LEFT is the dim tail. It is the default figure for a fixed cost,
 *     because that decision asks what survives. A cargo slider can instead make
 *     the bright, departing amount the figure: there the player is choosing what
 *     to send, and the remainder is not the question.
 *
 * WHEN THE PRICE IS BIGGER THAN THE STORE the bar cannot draw it inside itself,
 * and pretending otherwise — clamping the spend at 100% — would draw "exactly
 * enough" for every shortfall from one unit to ten thousand. So the deficit
 * continues PAST the end of the store in threat red, separated by a hard stop
 * line, and the figure switches from what remains to what is missing. A player
 * who reads nothing sees a bar that has run off its own end.
 *
 * RED IS CORRECT HERE and `interface.md` I0's rule about full stores does not
 * apply: I0 protects a store that is FULL, which is not an attack. This is a
 * refusal — the control below it will not fire — and a refusal the player has
 * caused is exactly what the amber/red split exists to distinguish. Amber is a
 * gap you can close by building something; this one you close by not sending so
 * many ships, which is a decision on this very screen.
 */
export function SpendBar({
  stock,
  spend,
  tone,
  label,
  readout = 'left',
  compactSize = false,
}: {
  /** What the world holds of this resource right now. */
  stock: number;
  /** What the act on screen would take out of it. Zero before anyone presses. */
  spend: number;
  /** Which substance, so the bar wears the colour the header already taught. */
  tone: 'alloy' | 'crystal' | 'deuterium';
  /** Two or three words naming the spend: "fuel for the flight". */
  label: string;
  /** Which side of the decision gets the prominent number. */
  readout?: 'left' | 'spend';
  /** Half height and no art, for a bar that sits inside a row rather than on a card. */
  compactSize?: boolean;
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

  return (
    <div
      data-spend-bar
      data-short={short > 0 ? 'true' : 'false'}
      className={`flex flex-col ${compactSize ? 'gap-1' : 'gap-2'}`}
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
        {/* The answer follows the caller's decision: what remains after a cost,
            or what is being packed when the slider itself chooses the spend. */}
        {short > 0 ? (
          <span data-spend-short className="readout shrink-0 text-caption text-threat-ink">
            &minus;{compact(short)}
          </span>
        ) : readout === 'spend' ? (
          <span data-spend-amount className="readout shrink-0 text-caption text-bone">
            {compact(spend)}
          </span>
        ) : (
          <span data-spend-left className="readout shrink-0 text-caption text-bone">
            {compact(left)}
          </span>
        )}
      </div>

      <div
        className={`socket flex w-full overflow-hidden rounded-full ${compactSize ? 'h-1.5' : 'h-2.5'}`}
        role="img"
        aria-label={
          short > 0
            ? t('spend.readingShort', { label, short: compact(short) })
            : readout === 'spend'
              ? t('spend.readingSpend', { label, spend: compact(spend) })
            : t('spend.reading', { label, spend: compact(spend), left: compact(left) })
        }
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
