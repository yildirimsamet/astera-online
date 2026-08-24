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
      className="relative flex h-[7px] gap-[2px]"
      role="meter"
      {...(label ? { 'aria-label': label } : {})}
      data-full={full ? 'true' : 'false'}
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
          className="absolute -right-0.5 -top-1 h-[9px] w-[3px] rounded-[1px] border border-bone/80 bg-panel shadow-[0_0_6px_currentColor]"
        />
      )}
    </div>
  );
}
