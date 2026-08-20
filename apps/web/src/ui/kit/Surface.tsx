import type { ReactNode } from 'react';

/**
 * The furniture: headings, dividers, empty states, loading states.
 *
 * Small components, but they are where the old interface leaked "website" most badly
 * — a dashed-border box saying "nothing here" is the admin-dashboard idiom, and this
 * game shows one of those on the intel screen, which is its most important surface.
 */

/** A silkscreened section rule: the legend cut into a line across the panel. */
export function SectionHead({
  label,
  aside,
  icon,
}: {
  label: string;
  aside?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-3 flex items-center gap-2.5">
      {icon === undefined ? null : <span className="text-faint">{icon}</span>}
      <h2 className="legend shrink-0">{label}</h2>
      <span className="rail-soft flex-1" />
      {aside === undefined ? null : (
        <span className="num shrink-0 text-micro text-faint">{aside}</span>
      )}
    </header>
  );
}

export type ChipTone = 'neutral' | 'threat' | 'opportunity' | 'alloy' | 'crystal' | 'locked';

const CHIP: Record<ChipTone, string> = {
  neutral: '',
  threat: 'chip-threat',
  opportunity: 'chip-opportunity',
  alloy: 'chip-alloy',
  crystal: 'chip-crystal',
  locked: 'chip-locked',
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
    <span className={`chip ${CHIP[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

/**
 * An empty state is an instruction, never an apology.
 *
 * In this game an empty surface almost always means a system the player has not
 * unlocked yet — no Telescope, no probe reports, nothing in flight. That is an
 * ambition to point at, not an absence to apologise for, so every one of these names
 * the next thing to do and gives it a way to be pressed.
 */
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
    <div className="plate plate-sunk flex flex-col items-center gap-3 px-5 py-8 text-center">
      {icon === undefined ? null : (
        <span className="socket grid size-14 place-items-center text-faint">{icon}</span>
      )}
      <p className="font-display text-[15px] font-semibold tracking-wide text-bone">{title}</p>
      {children === undefined ? null : (
        <p className="max-w-[34ch] text-[13px] leading-relaxed text-dim">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Loading: a plate warming up, not a spinner.
 *
 * A spinner says "the web is thinking". A panel with light moving under it says the
 * instrument is coming online — the same wait, wearing the game's clothes.
 */
export function Skeleton({
  className = '',
  rounded = 'rounded-lg',
}: {
  className?: string;
  rounded?: string;
}) {
  return <div className={`plate-sunk shimmer ${rounded} ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" rounded="rounded" />
      ))}
    </div>
  );
}

/** Where a whole surface is still arriving. Says what is coming, not "Loading…". */
export function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-6">
      <span className="size-2 animate-pulse rounded-full bg-crystal shadow-[0_0_10px_1px_rgba(89,200,255,0.8)]" />
      <p className="legend">{children}</p>
    </div>
  );
}

/**
 * WHERE A SURFACE COULD NOT BE READ AT ALL. D53a.
 *
 * `Waiting` says something is coming. This says it is not, and offers the one
 * action that can change that.
 *
 * The distinction had been lost in three places, and each lost it differently.
 * React Query's `isPending` goes FALSE the moment a query errors — the status
 * becomes `error` — but `data` stays undefined, so a gate written as
 * `isPending || !data` falls through to its loading branch forever: an animated
 * pulse claiming progress on a request that has already given up. On the reports
 * list it was worse than a pulse, because an empty list and a failed one took the
 * same branch and the screen said "nothing has been fought over yet" about a
 * request that never arrived. `ServersScreen` was the only surface that had the
 * error branch, and it is the pattern the other three now follow.
 */
export function Unreachable({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="px-4 py-6" role="alert">
      <p className="text-[14px] text-alert">Could not reach {what}.</p>
      <button
        type="button"
        className="btn mt-3"
        onClick={() => {
          onRetry();
        }}
      >
        Try again
      </button>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-micro leading-relaxed text-faint">{children}</p>;
}
