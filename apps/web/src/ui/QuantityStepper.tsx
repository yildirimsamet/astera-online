import { Button, IconButton } from './kit/index.js';

interface QuantityStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  /** Accessible name; include the hull when several steppers share a sheet. */
  maxLabel: string;
  /** Short visible copy. Defaults to the accessible label on single steppers. */
  maxText?: string;
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
  maxLabel,
  maxText = maxLabel,
}: QuantityStepperProps) {
  const upper = Math.max(min, max);
  const current = Math.max(min, Math.min(upper, Math.floor(value)));

  return (
    <div className="flex items-center justify-end gap-2">
      <IconButton
        ariaLabel={decreaseLabel}
        disabled={current <= min}
        onClick={() => { onChange(current - 1); }}
        className="text-title"
      >
        −
      </IconButton>
      <input
        type="text"
        inputMode="numeric"
        aria-label={valueLabel}
        readOnly
        value={String(current)}
        className="num plate plate-sunk h-11 w-14 rounded-control px-2 text-center text-title text-bone outline-none"
      />
      <IconButton
        ariaLabel={increaseLabel}
        disabled={current >= upper}
        onClick={() => { onChange(current + 1); }}
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
          onClick={() => { onChange(upper); }}
          className="min-h-11"
        >
          {maxText}
        </Button>
      </span>
    </div>
  );
}
