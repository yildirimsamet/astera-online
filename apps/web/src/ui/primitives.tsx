import type { ReactNode } from 'react';

/** A silkscreened section rule: the legend cut into a line across the panel. */
export function Section({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <header className="mb-2.5 flex items-center gap-3">
        <h2 className="legend">{label}</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
        {aside && <span className="num text-[11px] text-faint">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel p-3.5 ${className}`}>{children}</div>;
}

/**
 * A row of the same shape everywhere: what it is on the left, what it costs or
 * says on the right. Consistency is what lets a player stop reading and start
 * scanning.
 */
export function Row({
  label,
  detail,
  value,
  action,
}: {
  label: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-bone">{label}</div>
        {detail !== undefined && <div className="mt-0.5 text-[12px] text-dim">{detail}</div>}
      </div>
      {value !== undefined && <div className="num shrink-0 text-[13px]">{value}</div>}
      {action}
    </div>
  );
}

/** Storage against its ceiling. Full storage is wasted production — show it. */
export function Meter({ value, cap, tone }: { value: number; cap: number; tone: 'alloy' | 'crystal' }) {
  const share = cap <= 0 ? 0 : Math.min(1, value / cap);
  const colour = tone === 'alloy' ? 'bg-alloy' : 'bg-crystal';
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-[1px] bg-line-soft">
      <div
        className={`h-full ${colour} transition-[width] duration-500 ease-out`}
        style={{ width: `${String(share * 100)}%`, opacity: share >= 0.999 ? 1 : 0.75 }}
      />
    </div>
  );
}

/**
 * An empty state is an instruction, never an apology.
 *
 * Every one of these tells the player the next thing to do, because in this game
 * an empty screen usually means a system they have not unlocked yet.
 */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-line-soft px-3.5 py-6 text-center text-[13px] text-dim">
      {children}
    </p>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[12px] leading-relaxed text-faint">{children}</p>;
}
