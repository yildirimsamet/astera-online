/**
 * HOW GOOD A READ WAS, in the bars the Telescope uses; the figure is the name. Five bars,
 * lit by the report's accuracy (at least one: a read that came home saw something).
 */
export function SignalBars({ accuracy, label }: { accuracy: number; label: string }) {
  const lit = Math.max(1, Math.round(accuracy * 5));
  return (
    <span role="img" aria-label={label} className="gk-bars">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="gk-bars__bar"
          {...(i < lit ? { 'data-lit': '' } : {})}
          style={{ height: `${String(4 + i * 2)}px` }}
        />
      ))}
    </span>
  );
}
