/**
 * GAUGE — a reading you take without reading.
 *
 * Segmented, not smooth, for the reason a fuel gauge beats a percentage: you can tell
 * at a glance, in motion, one-handed. The eye counts cells instead of estimating a
 * fraction.
 *
 * Two details carry the meaning:
 *
 *   · The LEADING cell is brighter than the ones behind it, so a filling gauge reads
 *     as energy arriving rather than as paint already applied.
 *   · A FULL gauge turns threat-red and breathes, because a full store is not a
 *     success — it is production being thrown away, and `docs/interface.md` finding 5
 *     says the honest version of a storage cap shows the waste on screen rather than
 *     pushing a notification about it.
 */

export type GaugeTone = 'alloy' | 'crystal' | 'neutral' | 'opportunity';

const FILL: Record<GaugeTone, string> = {
  alloy: 'bg-alloy',
  crystal: 'bg-crystal',
  neutral: 'bg-dim',
  opportunity: 'bg-opportunity',
};

const GLOW: Record<GaugeTone, string> = {
  alloy: 'shadow-[0_0_7px_1px_rgba(255,190,82,0.85)]',
  crystal: 'shadow-[0_0_7px_1px_rgba(89,200,255,0.85)]',
  neutral: 'shadow-[0_0_7px_1px_rgba(147,160,182,0.7)]',
  opportunity: 'shadow-[0_0_7px_1px_rgba(111,245,182,0.85)]',
};

export function Gauge({
  value,
  cap,
  tone = 'crystal',
  cells = 12,
  height = 7,
  label,
}: {
  value: number;
  cap: number;
  tone?: GaugeTone;
  cells?: number;
  height?: number;
  /** Only when the gauge stands alone; otherwise the surrounding copy names it. */
  label?: string;
}) {
  const share = cap <= 0 ? 0 : Math.min(1, value / cap);
  const lit = Math.round(share * cells);
  const full = share >= 0.999;

  return (
    <div
      className="plate-sunk flex gap-[2px] rounded-[3px] p-[2px]"
      style={{ height: `${String(height + 4)}px` }}
      role="meter"
      aria-valuenow={Math.round(share * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(label === undefined ? {} : { 'aria-label': label })}
    >
      {Array.from({ length: cells }, (_, i) => {
        const on = i < lit;
        const leading = on && i === lit - 1;
        return (
          <span
            key={i}
            className={`flex-1 rounded-[1px] transition-colors duration-500 ${
              full ? 'bg-threat' : on ? FILL[tone] : 'bg-white/5'
            } ${leading && !full ? GLOW[tone] : ''} ${
              full ? 'motion-safe:animate-[meter-pulse_1.6s_ease-in-out_infinite]' : ''
            }`}
            style={on && !leading && !full ? { opacity: 0.82 } : undefined}
          />
        );
      })}
    </div>
  );
}

/**
 * Progress toward a named thing.
 *
 * Used where the player is saving up. The bar is how close they are and the label is
 * what they get — a bar with no destination is decoration, and this game does not
 * have progress bars for their own sake (D4 rules out build timers entirely).
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
      <div className="plate-sunk mt-1.5 h-[6px] overflow-hidden rounded-[3px]">
        <div
          className={`h-full rounded-[2px] transition-[width] duration-700 ease-out ${
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
 * player must be able to see that an INTERMITTENT reading is worth less than a CLEAR
 * one without stopping to read the word.
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
    <span className={`inline-flex items-end gap-[2px] ${className}`} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-[1px] ${i < lit ? 'bg-current' : 'bg-current opacity-20'}`}
          style={{ height: `${String(5 + i * 2.5)}px` }}
        />
      ))}
    </span>
  );
}
