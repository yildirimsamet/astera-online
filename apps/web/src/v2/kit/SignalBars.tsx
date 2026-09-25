/**
 * HOW GOOD A READ WAS, in the bars the Telescope uses; the figure is the name. Five bars,
 * lit by the report's accuracy (at least one: a read that came home saw something).
 */
export function SignalBars({ accuracy, label }: { accuracy: number; label: string }) {
  const lit = Math.max(1, Math.round(accuracy * 5));
  return (
    <span role="img" aria-label={label} className="inline-flex items-end gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-cell ${i < lit ? 'bg-v2-self' : 'bg-v2-line'}`}
          style={{ height: `${String(4 + i * 2)}px` }}
        />
      ))}
    </span>
  );
}
