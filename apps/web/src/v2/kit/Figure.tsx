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
    <div className="gk-figure">
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num gk-figure__value" {...(tone === 'threat' ? { 'data-tone': 'hostile' } : {})}>{value}</dd>
      {sub && <dd className="gk-num gk-figure__sub">{sub}</dd>}
    </div>
  );
}

/** The grid the figures stand in. */
export function Figures({ children, ...data }: { children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <dl {...data} className="gk-well gk-figures gk-figures--well">
      {children}
    </dl>
  );
}
