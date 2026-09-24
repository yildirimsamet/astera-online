import type { ReactNode } from 'react';
import i18n from '../../i18n/index.js';
import { compact, full } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { RESOURCE_ART } from '../../ui/assets.js';

/**
 * THE OLD KIT'S SURFACES, IN THE GÖZLEMEVI LANGUAGE. D5.
 *
 * The clan room was the largest surface still drawn in the first kit — sheared plates,
 * shouted display type, a hero the size of the phone. These take the SAME props as
 * `ui/kit`'s `Section`, `Plate`, `Button`, `Chip`, `EmptyState`, `Note`, `Stat` and
 * `PriceTag`, so a screen moves to the new language by changing one import and none of
 * its logic. Colours by relationship (K2): your move is `self`, a clan's identity is
 * `ally`, a gap you can close is `warn`, and red only for what can harm you.
 */

const HEADING = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';

export function SectionHead({ label, aside, icon }: { label: string; aside?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="flex items-center gap-2">
      {icon === undefined ? null : <span className="text-v2-ink-3">{icon}</span>}
      <h2 className={`shrink-0 ${HEADING}`}>{label}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-v2-line" />
      {aside === undefined ? null : <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">{aside}</span>}
    </header>
  );
}

export function Section({
  label,
  aside,
  icon,
  children,
}: {
  label: string;
  aside?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionHead label={label} {...(aside === undefined ? {} : { aside })} {...(icon === undefined ? {} : { icon })} />
      {children}
    </section>
  );
}

export type PlateTone = 'neutral' | 'lit' | 'threat' | 'opportunity' | 'alloy';

const PLATE: Record<PlateTone, string> = {
  neutral: 'border-v2-line bg-v2-panel',
  lit: 'border-v2-line-hi bg-v2-panel',
  threat: 'border-v2-hostile/40 bg-v2-hostile/5',
  opportunity: 'border-v2-self/40 bg-v2-self/5',
  alloy: 'border-v2-warn/40 bg-v2-warn/5',
};

export function Plate({
  children,
  tone = 'neutral',
  sunk = false,
  className = '',
  as: Tag = 'div',
}: {
  children?: ReactNode;
  tone?: PlateTone;
  /** Accepted for the old kit's callers; the new language has no sheared corners. */
  cut?: boolean | 'sm' | 'lg';
  /** Recessed instead of raised: wells and tracks. */
  sunk?: boolean;
  /** Accepted for the old kit's callers; nothing lifts in the new language. */
  flush?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'li' | 'aside';
}) {
  return (
    <Tag className={`rounded-control border ${sunk ? 'border-v2-line bg-v2-deep' : PLATE[tone]} ${className}`}>
      {children}
    </Tag>
  );
}

export type ButtonVariant = 'default' | 'primary' | 'commit' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'hero';

const VARIANT: Record<ButtonVariant, string> = {
  default: 'border border-v2-line-hi bg-v2-raise/60 text-v2-ink disabled:text-v2-ink-3',
  primary: 'bg-v2-self font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3',
  commit: 'bg-v2-self font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3',
  ghost: 'text-v2-ink-2 disabled:text-v2-ink-3',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 text-micro',
  md: 'min-h-10 px-3 text-caption',
  lg: 'min-h-11 px-4 text-caption',
  hero: 'min-h-11 px-4 text-caption',
};

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  full: wide = false,
  icon,
  trailing,
  className = '',
  type = 'button',
  ariaLabel,
  testId,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  full?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  testId?: string;
}) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      disabled={disabled}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      {...(testId === undefined ? {} : { 'data-testid': testId })}
      onClick={() => {
        if (disabled) return;
        haptic(variant === 'commit' ? 'commit' : 'tap');
        onClick?.();
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control font-v2-ui ${VARIANT[variant]} ${SIZE[size]} ${wide ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
      {trailing === undefined ? null : <span className="ml-auto pl-1">{trailing}</span>}
    </button>
  );
}

export type ChipTone = 'neutral' | 'threat' | 'opportunity' | 'alloy' | 'crystal' | 'locked';

const CHIP: Record<ChipTone, string> = {
  neutral: 'border-v2-line-hi text-v2-ink-2',
  threat: 'border-v2-hostile/50 text-v2-hostile',
  opportunity: 'border-v2-self/50 text-v2-self',
  alloy: 'border-v2-warn/50 text-v2-warn',
  // A clan's own identity: the colour of allies.
  crystal: 'border-v2-ally/50 bg-v2-ally/10 text-v2-ally',
  locked: 'border-v2-line text-v2-ink-3',
};

export function Chip({
  children,
  tone = 'neutral',
  icon,
  className = '',
}: {
  children: ReactNode;
  tone?: ChipTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-chip border px-1.5 py-0.5 text-micro font-semibold ${CHIP[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-control border border-dashed border-v2-line-hi px-3 py-5 text-center">
      {icon === undefined ? null : <span className="grid size-10 place-items-center text-v2-ink-3">{icon}</span>}
      <p className="max-w-[34ch] text-caption text-v2-ink">{title}</p>
      {children === undefined ? null : <p className="max-w-[34ch] text-micro leading-snug text-v2-ink-3">{children}</p>}
      {action === undefined ? null : action}
    </div>
  );
}

/** One clause of rule under the thing it qualifies. Never two. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-micro leading-snug text-v2-ink-3">{children}</p>;
}

type StatTone = 'bone' | 'alloy' | 'crystal' | 'threat' | 'opportunity' | 'dim';

const STAT: Record<StatTone, string> = {
  bone: 'text-v2-ink',
  alloy: 'text-v2-ink',
  crystal: 'text-v2-self',
  threat: 'text-v2-hostile',
  opportunity: 'text-v2-self',
  dim: 'text-v2-ink-2',
};

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
  tone?: StatTone;
  size?: 'hero' | 'lg' | 'md' | 'sm';
  align?: 'left' | 'right' | 'center';
}) {
  const justify = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  const figure = size === 'hero' || size === 'lg' ? 'text-figure' : 'text-body';
  return (
    <div className={`min-w-0 ${justify}`}>
      <p className="truncate text-micro text-v2-ink-3">{label}</p>
      <p className={`mt-0.5 font-v2-mono font-semibold tabular-nums ${figure} ${STAT[tone]}`}>{value}</p>
      {detail === undefined ? null : <p className="mt-0.5 truncate text-micro text-v2-ink-3">{detail}</p>}
    </div>
  );
}

/** A price in resource marks; a part the purse cannot meet is warn. */
export function PriceTag({
  alloy = 0,
  crystal = 0,
  have,
  exact = false,
  size = 'md',
  className = '',
}: {
  alloy?: number;
  crystal?: number;
  have?: { alloy: number; crystal: number };
  exact?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const text = size === 'sm' ? 'text-micro' : 'text-caption';
  const part = (resource: 'alloy' | 'crystal', amount: number, short: boolean) => (
    <span className={`inline-flex items-center gap-1 ${short ? 'text-v2-warn' : 'text-v2-ink'}`}>
      <img src={RESOURCE_ART[resource]} alt={i18n.t(`vocabulary.resource.${resource}`)} className="size-3.5 object-contain" />
      <span className={`font-v2-mono tabular-nums ${text}`}>{exact ? full(amount) : compact(amount)}</span>
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {alloy > 0 && part('alloy', alloy, have !== undefined && alloy > have.alloy)}
      {crystal > 0 && part('crystal', crystal, have !== undefined && crystal > have.crystal)}
    </span>
  );
}
