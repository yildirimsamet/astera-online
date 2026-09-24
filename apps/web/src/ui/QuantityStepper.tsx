import { useEffect, useState, type ChangeEvent } from 'react';
import { haptic } from '../lib/haptics.js';
import { Button, IconButton } from './kit/index.js';

interface QuantityStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  /** Allow direct digit entry while keeping the step buttons available. */
  editable?: boolean;
  /** Accessible name; include the hull when several steppers share a sheet. */
  maxLabel: string;
  /** Short visible copy. Defaults to the accessible label on single steppers. */
  maxText?: string;
  /**
   * THE WAY BACK DOWN, AND IT WAS MISSING. Owner report against the craft sheet:
   * there was a Max and no way to undo it but by pressing minus.
   *
   * Optional, because the two callers want different floors. A build sheet starts
   * at one — you cannot order nothing — so its reset returns to `min` and the
   * control is there to escape a large number in one press rather than twenty. A
   * launch picker starts at zero and already has "none" as a real state.
   */
  resetLabel?: string;
  resetText?: string;
  /**
   * `v2` is the Gözlemevi's row control (B14): minus, the count and plus in one
   * bordered group, Max as a word beside it. The same presses, labels and markers.
   */
  look?: 'plate' | 'v2';
}

/** One exact count control for build, launch and any later fleet commitment. */
export function QuantityStepper({
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  valueLabel,
  editable = false,
  maxLabel,
  maxText = maxLabel,
  resetLabel,
  resetText = resetLabel,
  look = 'plate',
}: QuantityStepperProps) {
  const upper = Math.max(min, max);
  const current = Math.max(min, Math.min(upper, Math.floor(value)));
  const [draft, setDraft] = useState(() => String(current));

  useEffect(() => {
    setDraft((held) => held === '' && current === min ? held : String(current));
  }, [current, min]);

  const commit = (next: number): void => {
    if (editable) setDraft(String(next));
    onChange(next);
  };

  const enter = (event: ChangeEvent<HTMLInputElement>): void => {
    const digits = event.currentTarget.value.replace(/\D/g, '');
    if (digits === '') {
      setDraft('');
      onChange(min);
      return;
    }

    const parsed = Number.parseInt(digits, 10);
    const next = Number.isSafeInteger(parsed)
      ? Math.max(min, Math.min(upper, parsed))
      : upper;
    setDraft(String(next));
    onChange(next);
  };

  const field = (className: string) => (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={valueLabel}
      readOnly={!editable}
      value={editable ? draft : String(current)}
      onChange={editable ? enter : undefined}
      className={className}
    />
  );

  if (look === 'v2') {
    const step = (label: string, disabled: boolean, next: number, face: string) => (
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => { haptic('tap'); commit(next); }}
        className="w-7 text-body text-v2-ink-2 disabled:text-v2-ink-3/40"
      >
        {face}
      </button>
    );
    return (
      <div className="flex shrink-0 items-center gap-1.5 font-v2-ui">
        <div className="flex h-7 items-stretch overflow-hidden rounded-control border border-v2-line-hi bg-v2-deep/60">
          {step(decreaseLabel, current <= min, current - 1, '−')}
          {field('w-9 border-x border-v2-line bg-transparent text-center font-v2-mono text-caption font-semibold text-v2-ink outline-none')}
          {step(increaseLabel, current >= upper, current + 1, '+')}
        </div>
        <span data-count-max>
          <button
            type="button"
            aria-label={maxLabel}
            disabled={current >= upper}
            onClick={() => { haptic('tap'); commit(upper); }}
            className="px-0.5 text-caption font-semibold text-v2-self disabled:text-v2-ink-3"
          >
            {maxText}
          </button>
        </span>
        {resetLabel !== undefined && (
          <span data-count-reset>
            <button
              type="button"
              aria-label={resetLabel}
              disabled={current <= min}
              onClick={() => { haptic('tap'); commit(min); }}
              className="px-0.5 text-caption text-v2-ink-2 disabled:text-v2-ink-3"
            >
              {resetText}
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <IconButton
        ariaLabel={decreaseLabel}
        disabled={current <= min}
        onClick={() => { commit(current - 1); }}
        className="text-title"
      >
        −
      </IconButton>
      {field('num plate plate-sunk h-9 w-9 rounded-control px-2 text-center text-title text-bone outline-none')}
      <IconButton
        ariaLabel={increaseLabel}
        disabled={current >= upper}
        onClick={() => { commit(current + 1); }}
        className="text-title"
      >
        +
      </IconButton>
      {/* The marker sits on a wrapper because anything outside this component
          that needs to point at the control — the onboarding gate (D56) — matches
          by `contains`, and the kit's Button owns its own attributes. */}
      <span data-count-max className="ml-1">
        <Button
          size="sm"
          ariaLabel={maxLabel}
          disabled={current >= upper}
          onClick={() => { commit(upper); }}
          className="min-h-9"
        >
          {maxText}
        </Button>
      </span>
      {/*
        THE PAIR. Max fills the order in one press and this empties it in one, so
        a player who pressed the first can undo it without holding minus twenty
        times. It goes AFTER Max rather than before, because the row reads as an
        escalation — minus, the count, plus, all of it, none of it — and putting
        the undo before the commit would read as a step on the way up.
      */}
      {resetLabel !== undefined && (
        <span data-count-reset>
          <Button
            size="sm"
            variant="ghost"
            ariaLabel={resetLabel}
            disabled={current <= min}
            onClick={() => { commit(min); }}
            className="min-h-9"
          >
            {resetText}
          </Button>
        </span>
      )}
    </div>
  );
}
