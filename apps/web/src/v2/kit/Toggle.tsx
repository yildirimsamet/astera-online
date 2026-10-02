import type { ReactNode } from 'react';

/**
 * AN ACKNOWLEDGEMENT, IN THE GAME'S OWN HAND. The browser's checkbox is one of the form
 * controls the spec keeps out of the game; this is a checkbox to a screen reader and a
 * small switch to the eye, with the sentence it agrees to beside it. `tone` is the colour
 * of what is being agreed to: warn for a gap, hostile for a threat to you (K2).
 */
export function Toggle({ checked, onChange, children, tone = 'warn', disabled = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** `self` is a setting of your own (the defence posture), neither a gap nor a threat. */
  tone?: 'warn' | 'hostile' | 'self';
  /** Greyed and inert; the sentence beside it should say why. */
  disabled?: boolean;
}) {
  const on = tone === 'hostile'
    ? 'border-v2-hostile bg-v2-hostile/80'
    : tone === 'self' ? 'border-v2-self bg-v2-self/80' : 'border-v2-warn bg-v2-warn/80';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={() => { if (!disabled) onChange(!checked); }}
      className={`flex w-full items-start gap-2.5 rounded-control px-1 py-1 text-left font-v2-ui text-caption text-v2-ink ${
        disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`relative mt-0.5 h-4 w-7 shrink-0 rounded-full border transition-colors ${checked ? on : 'border-v2-line-hi bg-v2-deep'}`}
      >
        <span className={`absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-v2-ink transition-[left] ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      <span className="min-w-0 flex-1 leading-snug">{children}</span>
    </button>
  );
}
