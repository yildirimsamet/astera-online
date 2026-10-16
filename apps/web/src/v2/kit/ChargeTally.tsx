type Cell = 'ready' | 'loading' | 'paused' | 'flight' | 'empty';

const LOOK: Record<Cell, string> = {
  ready: 'bg-v2-self shadow-[0_0_6px_var(--color-v2-self)]',
  loading: 'ring-[1.5px] ring-inset ring-v2-self',
  paused: 'bg-v2-warn/20 ring-[1.5px] ring-inset ring-v2-warn',
  flight: 'bg-v2-sky-violet/20 ring-[1.5px] ring-inset ring-v2-sky-violet',
  empty: 'bg-v2-line',
};

/**
 * Inventory slots only: ready is filled, loading outlined, paused amber, and a
 * flying weapon retains its violet outlined slot. Empty slots remain dark.
 * TacticalStock pairs this picture with an explicit stock/charge count; a weapon's
 * level uses a separate badge rather than borrowing this inventory grammar.
 */
export function ChargeTally({
  ready,
  loading,
  paused = 0,
  inFlight = 0,
  total,
  label,
}: {
  ready: number;
  loading: number;
  paused?: number;
  inFlight?: number;
  total: number;
  /** The whole reading, in words: the cells are one picture. */
  label: string;
}) {
  if (total <= 0) return null;
  const lit = Math.max(0, Math.min(total, ready));
  const filling = Math.max(0, Math.min(total - lit, loading));
  const stopped = Math.max(0, Math.min(total - lit - filling, paused));
  const flying = Math.max(0, Math.min(total - lit - filling - stopped, inFlight));
  const cells: Cell[] = Array.from({ length: total }, (_, index) =>
    index < lit ? 'ready' : index < lit + filling ? 'loading'
      : index < lit + filling + stopped ? 'paused'
        : index < lit + filling + stopped + flying ? 'flight' : 'empty');

  return (
    <span
      data-tally=""
      data-used={lit + filling + stopped + flying}
      data-total={total}
      role="img"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-[3px]"
    >
      {cells.map((cell, index) => (
        <span key={index} aria-hidden="true" data-cell={cell} className={`h-3 w-[5px] rounded-cell ${LOOK[cell]}`} />
      ))}
    </span>
  );
}
