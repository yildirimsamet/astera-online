import { ShieldIcon } from '../../ui/icons/index.js';

type Tone = 'alloy' | 'crystal' | 'deuterium';

const LIT: Record<Tone, string> = { alloy: 'bg-v2-alloy', crystal: 'bg-v2-crystal', deuterium: 'bg-v2-deut' };
/** An empty cell is the resource's own hue, faint — never grey (owner, round 2, rule 4). */
const EMPTY: Record<Tone, string> = { alloy: 'bg-v2-alloy/15', crystal: 'bg-v2-crystal/15', deuterium: 'bg-v2-deut/15' };

/** The gap between cells, in px; the bracket's geometry is computed from it. */
const GAP = 2;

/**
 * A STORE, READ BY COUNTING. Owner, 2026-09-24, with the old STORE panel as the picture:
 * the segmented bar had gone, and the safe part drawn on the smooth bar that replaced it
 * read as a square.
 *
 * Cells, because a fuel gauge is read by counting rather than estimating. The part a raid
 * cannot take (the Vault's floor, D190) is a bracket drawn AROUND its own cells with the
 * shield over it — a marking, not a second quantity — at least one cell whenever anything
 * is safe, because a floor drawn as nothing is one the player is entitled to think does not
 * exist. A full store closes with a cap in warn: a gap you can close, never a threat (K2).
 */
export function StoreBar({
  value,
  cap,
  safe,
  tone,
  cells = 12,
}: {
  value: number;
  cap: number;
  /** How much of the store a raid cannot take. */
  safe: number;
  tone: Tone;
  cells?: number;
}) {
  const share = cap <= 0 ? 0 : Math.min(1, Math.max(0, value) / cap);
  // Any stock lights a cell: 169 of 4.5k is not an empty store.
  const lit = share > 0 ? Math.max(1, Math.round(share * cells)) : 0;
  const full = cap > 0 && value >= cap;
  const safeCells = safe > 0 && cap > 0 ? Math.max(1, Math.round(Math.min(1, safe / cap) * cells)) : 0;
  // One cell's width, and the run of `n` cells with the gaps between them.
  const cell = `(100% - ${String((cells - 1) * GAP)}px) / ${String(cells)}`;
  const run = (n: number): string => `(${cell} * ${String(n)} + ${String((n - 1) * GAP)}px)`;

  return (
    <span aria-hidden className="relative block pt-3">
      <span className="relative flex h-1.5 gap-0.5">
        {Array.from({ length: cells }, (_, index) => (
          <span
            key={index}
            data-cell=""
            {...(index < lit ? { 'data-lit': '' } : {})}
            className={`flex-1 rounded-full ${index < lit ? LIT[tone] : EMPTY[tone]}`}
          />
        ))}
        {full && (
          <span data-full-cap="" className="absolute -right-1.5 top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-full bg-v2-warn" />
        )}
      </span>
      {safeCells > 0 && (
        <>
          <span
            data-safe=""
            data-safe-cells={String(safeCells)}
            className="pointer-events-none absolute -bottom-[3px] -left-[3px] top-[9px] rounded-cell border border-v2-ink/80"
            style={{ width: `calc(${run(safeCells)} + 6px)` }}
          />
          <span
            data-safe-shield=""
            className="pointer-events-none absolute top-0 -translate-x-1/2 text-v2-ink"
            style={{ left: `calc(${run(safeCells)} / 2)` }}
          >
            <ShieldIcon className="size-2.5" />
          </span>
        </>
      )}
    </span>
  );
}
