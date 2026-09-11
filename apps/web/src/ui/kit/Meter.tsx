/**
 * METER — a reading you take without reading.
 *
 * Segmented, not smooth, for the reason a fuel gauge beats a percentage: you can
 * tell at a glance, in motion, one-handed. The eye counts cells instead of
 * estimating a fraction, and the leading cell is brighter so a filling meter reads
 * as energy arriving rather than as paint already applied.
 *
 * A FULL METER KEEPS ITS OWN HUE AND CLOSES WITH A HARD END-CAP, and that is a
 * gameplay rule rather than a style (`docs/interface.md` I0). There were two
 * implementations of this component and they disagreed about exactly that: this
 * one, and a `Gauge` in the kit that turned the whole bar threat-red and pulsed
 * it, citing a finding I0 had already reversed. Storage filling up is not an
 * attack. Threat red is reserved for something that can harm the commander, and
 * spending it on a full store is how a player learns to ignore the colour.
 *
 * The wrong one is gone. This is the only meter.
 */
export function Meter({
  value,
  cap,
  tone,
  cells = 12,
  label,
  safeShare = 0,
}: {
  value: number;
  cap: number;
  tone: 'alloy' | 'crystal' | 'deuterium';
  cells?: number;
  label?: string;
  /**
   * THE PART OF THE BAR A RAID CANNOT REACH, drawn INSIDE it. D190.
   *
   * The vault floor is a share of the STORE, and drawing it as a separate figure
   * is what let players believe the Vault was a box that holds a fixed amount
   * rather than the thing that makes the store deep. Marked in place, the rule
   * reads without a sentence: this much of what you see is untouchable, the rest
   * is what a raider comes for, and the whole bar grows when the Vault does.
   */
  safeShare?: number;
}) {
  const share = cap <= 0 ? 0 : Math.min(1, value / cap);
  const lit = Math.round(share * cells);
  const full = share >= 0.999;
  // At least one cell whenever there is any protection at all: a floor drawn as
  // nothing is a floor the player is entitled to think does not exist.
  const safeCells = safeShare > 0
    ? Math.max(1, Math.round(Math.min(1, safeShare) * cells))
    : 0;

  const colour = tone === 'alloy'
    ? 'bg-alloy'
    : tone === 'crystal' ? 'bg-crystal' : 'bg-deuterium';
  const glow = tone === 'alloy'
    ? 'shadow-[0_0_6px_rgba(217,164,65,0.8)]'
    : tone === 'crystal'
      ? 'shadow-[0_0_6px_rgba(111,211,224,0.8)]'
      : 'shadow-[0_0_6px_var(--color-deuterium-glow)]';

  return (
    <div
      className="relative flex h-[5px] gap-px"
      role="meter"
      {...(label ? { 'aria-label': label } : {})}
      data-full={full ? 'true' : 'false'}
      aria-valuenow={Math.round(share * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: cells }, (_, i) => {
        const on = i < lit;
        const leading = on && i === lit - 1;
        const safe = i < safeCells;
        /*
          A RING WAS INVISIBLE AND A COLOUR IS NOT. D190, owner report with a
          screenshot: *"işaretli dilim hiç ama hiç belli olmuyor ki."* Right — a
          1px inset ring on a five-pixel cell that is already carrying a saturated
          fill is nothing at arm's length, and this game is played one-handed by
          people who are not looking hard.

          The safe cells take BONE instead of the resource hue, so the eye reads a
          different material rather than a decorated one. It survives the case that
          matters most, too: a store over its ceiling pins every cell lit, and the
          pale head against the saturated rest still says "only this much is safe".
        */
        return (
          <span
            key={i}
            data-safe={safe ? 'true' : undefined}
            className={`flex-1 rounded-cell transition-colors duration-500 ${
              safe ? (on ? 'bg-bone' : 'bg-bone/25') : on ? colour : 'bg-line/70'
            } ${leading && !safe ? glow : ''}`}
            style={leading && !full ? undefined : { opacity: on ? 0.9 : 1 }}
          />
        );
      })}
      {full && (
        <span
          aria-hidden
          data-meter-cap
          className="absolute -right-0.5 -top-1 h-[9px] w-[3px] rounded-cell border border-bone/80 bg-panel shadow-[0_0_6px_currentColor]"
        />
      )}
    </div>
  );
}

/**
 * Progress toward a named thing.
 *
 * Used where the player is saving up. The bar is how close they are and the label
 * is what they get — a bar with no destination is decoration, and this game does
 * not have progress bars for their own sake.
 */
export function Progress({
  have,
  need,
  label,
}: {
  have: number;
  need: number;
  label: string;
}) {
  const share = need <= 0 ? 1 : Math.min(1, have / need);
  const ready = share >= 1;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="legend">{label}</span>
        <span className={`num text-micro ${ready ? 'text-opportunity lit' : 'text-faint'}`}>
          {ready ? 'READY' : `${String(Math.floor(share * 100))}%`}
        </span>
      </div>
      <div className="plate-sunk mt-2 h-[6px] overflow-hidden rounded-chip">
        <div
          className={`h-full rounded-cell transition-[width] duration-700 ease-out ${
            ready
              ? 'bg-opportunity shadow-[0_0_9px_1px_rgba(111,245,182,0.7)]'
              : 'bg-crystal/75 shadow-[0_0_7px_0_rgba(89,200,255,0.5)]'
          }`}
          style={{ width: `${String(share * 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Signal strength, five bars, for the intel layer only.
 *
 * The height ramp is doing real work: clarity is a gradient, not a binary, and a
 * player must be able to see that an INTERMITTENT reading is worth less than a
 * CLEAR one without stopping to read the word.
 */
export function Bars({
  lit,
  total = 5,
  className = '',
}: {
  lit: number;
  total?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-end gap-px ${className}`} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-cell ${i < lit ? 'bg-current' : 'bg-current opacity-20'}`}
          style={{ height: `${String(5 + i * 2.5)}px` }}
        />
      ))}
    </span>
  );
}
