import type { ReactNode } from 'react';

/**
 * A FLIGHT IN FIGURES (B14): one label, one value, an optional line under it. The launch
 * and the clan wave read their summaries in this one shape, three to a row.
 */
export function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Red for a figure that is the reason the commit will refuse. */
  tone?: 'threat';
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-micro text-v2-ink-3">{label}</dt>
      <dd className={`mt-0.5 font-v2-mono text-caption font-semibold ${tone === 'threat' ? 'text-v2-hostile' : 'text-v2-ink'}`}>{value}</dd>
      {sub && <dd className="font-v2-mono text-micro text-v2-ink-3">{sub}</dd>}
    </div>
  );
}

/** The grid the figures stand in. */
export function Figures({ children, ...data }: { children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <dl {...data} className="grid grid-cols-3 gap-x-3 gap-y-2.5 rounded-control border border-v2-line bg-v2-deep/40 px-3 py-2.5">
      {children}
    </dl>
  );
}
