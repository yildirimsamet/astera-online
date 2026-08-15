/**
 * A meter you can read without reading.
 *
 * The first version was a 3px line. A line says "some fraction of something"; it
 * does not say *how close to the edge you are*, which is the only reason storage
 * is on screen at all. This one is built from cells, so the eye counts rather than
 * estimates, and the last cell lights differently when you are wasting production.
 *
 * Segments beat a smooth bar for the same reason a fuel gauge beats a percentage:
 * you can tell at a glance, in motion, one-handed.
 */
export function Meter({
  value,
  cap,
  tone,
  cells = 12,
}: {
  value: number;
  cap: number;
  tone: 'alloy' | 'crystal';
  cells?: number;
}) {
  const share = cap <= 0 ? 0 : Math.min(1, value / cap);
  const lit = Math.round(share * cells);
  const full = share >= 0.999;

  const colour = tone === 'alloy' ? 'bg-alloy' : 'bg-crystal';
  const glow =
    tone === 'alloy' ? 'shadow-[0_0_6px_rgba(217,164,65,0.8)]' : 'shadow-[0_0_6px_rgba(111,211,224,0.8)]';

  return (
    <div
      className="flex h-[7px] gap-[2px]"
      role="meter"
      aria-valuenow={Math.round(share * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: cells }, (_, i) => {
        const on = i < lit;
        // The leading cell is brighter: the fill has a head, so it reads as
        // something arriving rather than a static proportion.
        const leading = on && i === lit - 1;
        return (
          <span
            key={i}
            className={`flex-1 rounded-[1px] transition-colors duration-500 ${
              full ? 'bg-threat' : on ? colour : 'bg-line/70'
            } ${leading && !full ? glow : ''} ${full ? 'motion-safe:animate-[meter-pulse_1.6s_ease-in-out_infinite]' : ''}`}
            style={leading && !full ? undefined : { opacity: on ? 0.9 : 1 }}
          />
        );
      })}
    </div>
  );
}

/**
 * Progress toward the next level of something, with the next level named.
 *
 * Used where the player is saving up: the bar is how close they are, and the
 * label is what they get. A bar with no destination is decoration.
 */
export function ProgressToNext({
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
        <span className={`num text-[10px] ${ready ? 'text-opportunity' : 'text-faint'}`}>
          {ready ? 'ready' : `${String(Math.floor(share * 100))}%`}
        </span>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-[1px] bg-line/60">
        <div
          className={`h-full transition-[width] duration-700 ease-out ${
            ready ? 'bg-opportunity' : 'bg-crystal/70'
          }`}
          style={{ width: `${String(share * 100)}%` }}
        />
      </div>
    </div>
  );
}
