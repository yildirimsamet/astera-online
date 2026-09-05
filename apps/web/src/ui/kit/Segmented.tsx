import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { haptic } from '../../lib/haptics.js';

/**
 * SEGMENTED — one of a small fixed set, and which one is visible without reading.
 *
 * There were three of these and they agreed about nothing. The planet categories
 * marked the current tab with `bg-raised text-bone` and `aria-current="page"`, a
 * NAVIGATION idiom on a control that navigates nowhere; the intel report tabs
 * used `bg-crystal/12 text-crystal` with a hand-written roving tabindex; the
 * language pair used cyan TEXT plus a `border-crystal/60` that never drew, because
 * `.btn` sets `border: 0` and a colour with no width is dropped in silence. Three
 * shapes, three grammars for "this one is on", three things said to a screen
 * reader, and on one of them half the selected state was missing entirely.
 *
 * ONE GRAMMAR: THE SELECTED SEGMENT IS LIT AND RAISED. It is the only one with a
 * face catching the light and the only one at full ink; everything else is flat
 * and faint. That is the same physical language `.slab` uses for a surface you
 * press, read in reverse — which is why it needs no explaining.
 *
 * `role` picks the SEMANTICS, and the look never changes with them:
 *
 *   tablist  the segments switch the panel below (`role=tab`, `aria-selected`,
 *            roving tabindex, Left/Right/Home/End — the full keyboard contract
 *            the intel tabs already implemented by hand)
 *   group    the segments set a value (`aria-pressed`) — a preference, a count
 */
export interface Segment<T extends string> {
  id: T;
  label: ReactNode;
  /** Announced instead of the label, where the label is an abbreviation. */
  hint?: string;
}

export function Segmented<T extends string>({
  segments,
  value,
  onSelect,
  label,
  role = 'group',
  size = 'md',
  className = '',
  flush = false,
  marker,
  panelId,
  tabId,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onSelect: (id: T) => void;
  /** Names the whole control. Always required — a bare row of words is not a control. */
  label: string;
  role?: 'group' | 'tablist';
  size?: 'sm' | 'md';
  className?: string;
  /** No track and square ends — for a bar pinned to the edge of a surface. */
  flush?: boolean;
  /** `data-{marker}` on each segment, for the onboarding gate and the harness. */
  marker?: 'tab';
  /** The panel each segment controls. Tablists only. */
  panelId?: (id: T) => string;
  /** A stable id per segment, so a panel can point back at its own tab. */
  tabId?: (id: T) => string;
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const isTabs = role === 'tablist';

  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isTabs) return;
    const index = segments.findIndex((segment) => segment.id === value);
    if (index < 0) return;
    const count = segments.length;
    // ARROWS WRAP. The ends of a tablist are not walls: a player holding Right
    // should come back round rather than stop dead on the last tab, and the intel
    // tabs already had a test proving it before this component existed.
    const next =
      event.key === 'ArrowRight' ? (index + 1) % count
      : event.key === 'ArrowLeft' ? (index - 1 + count) % count
      : event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : -1;
    if (next < 0 || next === index) return;
    event.preventDefault();
    const target = segments[next];
    if (!target) return;
    // Selection FOLLOWS focus here, which is the right pattern when switching a
    // panel is instant and costs nothing — the player sees what they arrowed to.
    onSelect(target.id);
    buttons.current.get(target.id)?.focus();
  };

  return (
    <div
      role={role}
      aria-label={label}
      onKeyDown={move}
      className={
        flush
          ? `grid gap-1 px-3 py-2 ${className}`
          : `plate plate-sunk grid gap-1 rounded-control p-1 ${className}`
      }
      style={{ gridTemplateColumns: `repeat(${String(segments.length)}, minmax(0, 1fr))` }}
    >
      {segments.map((segment) => {
        const on = segment.id === value;
        return (
          <button
            key={segment.id}
            type="button"
            ref={(node) => {
              if (node) buttons.current.set(segment.id, node);
              else buttons.current.delete(segment.id);
            }}
            {...(isTabs
              ? {
                  role: 'tab' as const,
                  'aria-selected': on,
                  tabIndex: on ? 0 : -1,
                  ...(panelId === undefined ? {} : { 'aria-controls': panelId(segment.id) }),
                  ...(tabId === undefined ? {} : { id: tabId(segment.id) }),
                }
              : { 'aria-pressed': on })}
            {...(marker === 'tab' ? { 'data-tab': segment.id } : {})}
            {...(segment.hint === undefined ? {} : { 'aria-label': segment.hint })}
            onClick={() => {
              if (on) return;
              haptic('tap');
              onSelect(segment.id);
            }}
            className={`legend rounded-chip transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crystal ${
              size === 'sm' ? 'min-h-9 px-2' : 'min-h-11 px-2'
            } ${
              on
                ? 'bg-raised text-bone shadow-[inset_0_1px_0_rgb(255_255_255/12%),0_1px_0_rgb(0_0_0/45%)]'
                : 'text-faint hover:text-dim'
            }`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
