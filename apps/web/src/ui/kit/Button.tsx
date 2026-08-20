import type { ReactNode } from 'react';
import { haptic } from '../../lib/haptics.js';

/**
 * SLAB — a surface you press.
 *
 * The old interface had one button style: a 38px hairline rectangle at 2px radius,
 * worn identically by "raise a refinery" and by "launch a fleet that cannot be
 * recalled". That is the single clearest reason it read as a form rather than a game,
 * so weight here is not styling — it is how the player tells the reversible from the
 * irreversible before they press.
 */

export type ButtonVariant =
  | 'default'
  /** The affirmative action on a surface: build, raise, install, watch. */
  | 'primary'
  /**
   * Reserved for the irreversible: launching, and nothing else.
   *
   * A launched fleet cannot be recalled (`docs/decisions.md`). This is the one
   * control in the game with no undo and it must never look like the one that buys a
   * Wasp. If a second use for this variant ever appears, that is the bug.
   */
  | 'commit'
  /** Tertiary. No thickness, no fill — must not compete with anything. */
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'hero';

const VARIANT: Record<ButtonVariant, string> = {
  default: '',
  primary: 'slab-primary',
  commit: 'slab-commit',
  ghost: 'slab-ghost',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-[11px]',
  md: 'min-h-[42px] px-4 py-2.5 text-[13px]',
  lg: 'min-h-[52px] px-5 py-3 text-[14px]',
  hero: 'min-h-[60px] px-6 py-4 text-[16px] tracking-[0.12em]',
};

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  full = false,
  icon,
  trailing,
  className = '',
  type = 'button',
  ariaLabel,
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
}) {
  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      disabled={disabled}
      {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
      onClick={() => {
        if (disabled) return;
        // Weight matches consequence. A commit is the only press in the game that
        // gets the three-pulse pattern, so the hand learns the difference too.
        haptic(variant === 'commit' ? 'commit' : 'tap');
        onClick?.();
      }}
      className={`slab ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
      {trailing === undefined ? null : <span className="ml-auto pl-1">{trailing}</span>}
    </button>
  );
}

/**
 * A square press for a glyph alone.
 *
 * Always needs `ariaLabel` — there is no text to fall back on, and the screenshot
 * tooling navigates by accessible name.
 */
export function IconButton({
  children,
  onClick,
  ariaLabel,
  tone = 'default',
  size = 'md',
  disabled = false,
  className = '',
  badge = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  tone?: ButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  /** An unread mark, positioned so it never overlaps the glyph's optical centre. */
  badge?: boolean | 'threat';
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic('tap');
        onClick?.();
      }}
      className={`slab ${VARIANT[tone]} relative shrink-0 p-0 ${
        size === 'sm' ? 'size-9 min-h-0' : 'size-11 min-h-0'
      } ${className}`}
    >
      {children}
      {badge === false ? null : (
        <span className={`pip ${badge === 'threat' ? 'pip-threat' : ''} absolute right-1.5 top-1.5`} />
      )}
    </button>
  );
}
