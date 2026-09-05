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
}: {
  value: number;
  cap: number;
  tone: 'alloy' | 'crystal' | 'deuterium';
  cells?: number;
  label?: string;
}) {
  const share = cap <= 0 ? 0 : Math.min(1, value / cap);
  const lit = Math.round(share * cells);
  const full = share >= 0.999;

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
        return (
          <span
            key={i}
            className={`flex-1 rounded-cell transition-colors duration-500 ${
              on ? colour : 'bg-line/70'
            } ${leading ? glow : ''}`}
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
