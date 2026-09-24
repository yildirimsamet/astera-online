import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Something is waiting behind this option. */
  dot?: boolean;
  /** What the dot means, read after the label. */
  dotLabel?: string;
}

export interface SegmentedProps<T extends string> {
  /** What the switch chooses between, for a screen reader. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** An id per option, so a panel below can be labelled by the tab that shows it. */
  tabId?: (id: T) => string;
}

/**
 * A SEGMENTED SWITCH. The bell sheet's Signals · Chronicle · Chat (K1) and the
 * base's This world | Research (K6).
 *
 * A tab list: the one that is on is raised, a dot marks one with something
 * waiting behind it, and the arrow keys move along it — wrapping at the ends —
 * as a tab list does everywhere else.
 */
export function Segmented<T extends string>({ label, options, value, onChange, tabId }: SegmentedProps<T>) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    // WAI-ARIA tabs: Home and End jump to the ends.
    const jump = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
    if (step === 0 && jump === null) return;
    event.preventDefault();
    const next = jump ?? (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.id);
    tabs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col rounded-control border border-v2-line bg-v2-panel p-0.5 font-v2-ui"
    >
      {options.map((option, index) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            ref={(element) => { tabs.current[index] = element; }}
            type="button"
            {...(tabId ? { id: tabId(option.id) } : {})}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            aria-label={option.dot && option.dotLabel ? `${option.label} · ${option.dotLabel}` : option.label}
            onClick={() => { onChange(option.id); }}
            onKeyDown={(event) => { onKeyDown(event, index); }}
            className={`relative flex items-center justify-center gap-1 truncate rounded-chip px-2 py-1.5 text-caption font-medium ${
              on ? 'bg-v2-raise text-v2-ink ring-1 ring-v2-line-hi' : 'text-v2-ink-3'
            }`}
          >
            {option.label}
            {option.dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-v2-self" />}
          </button>
        );
      })}
    </div>
  );
}
