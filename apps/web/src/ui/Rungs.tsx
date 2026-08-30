import { useTranslation } from 'react-i18next';

/**
 * HOW FAR UP A LADDER SOMETHING IS, AS A SHAPE. Owner instruction.
 *
 * This was `L2 / 5`, which is a fraction a player has to READ and then convert
 * into the only thing they wanted: how much is left. Five marks with two lit is
 * the same fact arriving without being read — the eye counts small groups without
 * being asked to, which is why dice have pips and not numerals.
 *
 * IT IS NOT A PROGRESS BAR. A bar says "some of the way", and a research ladder is
 * not continuous: it is a fixed, small number of DISCRETE rungs, each one bought
 * separately, and the count of them matters. A bar would hide that there are
 * exactly five and that the fourth is a decision.
 *
 * THE NEXT RUNG IS DRAWN DIFFERENTLY FROM THE REST OF THE UNBOUGHT ONES. It is the
 * one on offer, and marking it is what turns a readout into a sentence about what
 * happens if you press — the same job the bright segment does in `CapacityBar`.
 *
 * THE WORDS ARE FOR THE SCREEN READER, which cannot see five dots. `aria-label`
 * carries the fraction the picture replaced.
 */
export function Rungs({
  level,
  max,
  next = false,
}: {
  /** Rungs held. */
  level: number;
  /** The ceiling. One rung is a permission, not a ladder — see `UpgradeRow`. */
  max: number;
  /** Whether to light the rung about to be bought as the one on offer. */
  next?: boolean;
}) {
  const { t } = useTranslation();
  const held = Math.max(0, Math.min(max, Math.floor(level)));

  return (
    <span
      className="flex shrink-0 items-center gap-[3px]"
      role="img"
      aria-label={t('upgradeRow.ladder', { level: held, max })}
    >
      {Array.from({ length: max }, (_unused, index) => {
        const bought = index < held;
        const onOffer = next && index === held;
        return (
          <span
            key={index}
            aria-hidden
            data-rung={bought ? 'held' : onOffer ? 'next' : 'open'}
            /*
              A HELD RUNG IS SOLID, THE NEXT IS OUTLINED IN THE COLOUR OF A CHOICE,
              AND THE REST ARE HOLES. Three states, three weights, no colour needed
              to tell the first from the last — which keeps it readable for the one
              player in twelve who cannot separate the two hues.
            */
            className={
              bought
                ? 'size-1.5 rounded-full bg-crystal'
                : onOffer
                  ? 'size-1.5 rounded-full border border-crystal/70'
                  : 'size-1.5 rounded-full bg-bone/15'
            }
          />
        );
      })}
    </span>
  );
}
