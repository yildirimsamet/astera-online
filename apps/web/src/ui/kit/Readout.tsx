import type { ReactNode } from 'react';

/**
 * READOUT — the game's way of stating a number.
 *
 * Stock, power, ETA, exposure, dominion: the game *is* those numbers, and the old
 * interface set them at 13px in mono inside a list, which is how a strategy game ends
 * up looking like a log file. Here the size difference does the work a label would
 * otherwise have to do in words.
 *
 * Everything is tabular so a ticking value never jitters sideways.
 */

export type ReadoutSize = 'hero' | 'lg' | 'md' | 'sm';

const SIZE: Record<ReadoutSize, string> = {
  hero: 'text-hero',
  lg: 'text-readout',
  md: 'text-figure',
  sm: 'text-body',
};

export function Readout({
  children,
  size = 'md',
  tone = 'bone',
  unit,
  className = '',
  glow = false,
}: {
  children: ReactNode;
  size?: ReadoutSize;
  tone?: 'bone' | 'alloy' | 'crystal' | 'threat' | 'opportunity' | 'dim';
  /** The small trailing qualifier: /h, min, ×. Never the same size as the figure. */
  unit?: string;
  className?: string;
  /** Lit from behind. Only for a value that is live right now. */
  glow?: boolean;
}) {
  const colour =
    tone === 'alloy'
      ? 'text-alloy'
      : tone === 'crystal'
        ? 'text-crystal'
        : tone === 'threat'
          ? 'text-threat'
          : tone === 'opportunity'
            ? 'text-opportunity'
            : tone === 'dim'
              ? 'text-dim'
              : 'text-bone';

  return (
    <span className={`readout ${SIZE[size]} ${colour} ${glow ? 'lit' : 'etch'} ${className}`}>
      {children}
      {unit === undefined ? null : (
        <span className="unit">
          {unit}
        </span>
      )}
    </span>
  );
}

/**
 * A labelled reading: engraved caption above, figure below.
 *
 * The shape of every fact on a plate. Consistency here is what lets a player stop
 * reading and start scanning.
 */
export function Stat({
  label,
  value,
  detail,
  tone = 'bone',
  size = 'md',
  align = 'left',
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'bone' | 'alloy' | 'crystal' | 'threat' | 'opportunity' | 'dim';
  size?: ReadoutSize;
  align?: 'left' | 'right' | 'center';
}) {
  const justify = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  return (
    <div className={`min-w-0 ${justify}`}>
      <p className="legend truncate">{label}</p>
      <p className="mt-2">
        <Readout size={size} tone={tone}>
          {value}
        </Readout>
      </p>
      {detail === undefined ? null : (
        <p className="mt-1 truncate text-micro text-faint">{detail}</p>
      )}
    </div>
  );
}
