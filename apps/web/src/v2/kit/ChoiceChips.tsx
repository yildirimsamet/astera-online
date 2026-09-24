import { useRef, type KeyboardEvent } from 'react';

export interface ChoiceChip<T extends string> {
  id: T;
  label: string;
  /** A second line under the label: what this choice holds. */
  detail?: string;
}

/**
 * ONE OF A FEW, AS CHIPS. The game's answer to the browser's dropdown, which the spec
 * keeps out of the game ("tarayıcının kendi form elemanları oyunu bir web formuna
 * çevirir"): every choice is visible and one tap away. A radio group, so a screen reader
 * hears "one of N", and the arrow keys move between the chips.
 */
export function ChoiceChips<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: readonly ChoiceChip<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.id);
    chips.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5 font-v2-ui">
      {options.map((option, index) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            ref={(node) => { chips.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.label}
            tabIndex={on ? 0 : -1}
            onClick={() => { onChange(option.id); }}
            onKeyDown={(event) => { onKeyDown(event, index); }}
            className={`flex min-w-0 flex-col items-start rounded-control border px-2.5 py-1.5 text-left ${
              on ? 'border-v2-self/60 bg-v2-self/10 text-v2-ink' : 'border-v2-line bg-v2-panel text-v2-ink-2 hover:border-v2-line-hi'
            }`}
          >
            <span className="max-w-full truncate text-caption font-semibold">{option.label}</span>
            {option.detail && <span className="max-w-full truncate font-v2-mono text-micro text-v2-ink-3">{option.detail}</span>}
          </button>
        );
      })}
    </div>
  );
}
