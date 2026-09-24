type Cell = 'ready' | 'loading' | 'empty';

const LOOK: Record<Cell, string> = {
  ready: 'bg-v2-self shadow-[0_0_6px_var(--color-v2-self)]',
  loading: 'ring-[1.5px] ring-inset ring-v2-self',
  empty: 'bg-v2-line',
};

/**
 * CHARGES, CELL BY CELL. D3 (owner, round 2): "1 / 2" is a fraction to decode; a slot
 * that is loaded glows in your colour, one being loaded is outlined, an empty one is
 * dark. Loaded first, then loading, then empty — the order a stockpile fills in.
 */
export function ChargeTally({
  ready,
  loading,
  total,
  label,
}: {
  ready: number;
  loading: number;
  total: number;
  /** The whole reading, in words: the cells are one picture. */
  label: string;
}) {
  if (total <= 0) return null;
  const lit = Math.max(0, Math.min(total, ready));
  const filling = Math.max(0, Math.min(total - lit, loading));
  const cells: Cell[] = Array.from({ length: total }, (_, index) =>
    index < lit ? 'ready' : index < lit + filling ? 'loading' : 'empty');

  return (
    <span
      data-tally=""
      data-used={lit + filling}
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
