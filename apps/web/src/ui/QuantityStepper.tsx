import { useState, type ChangeEvent } from 'react';
import { Glyph } from '../game-ui/icons.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';

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
}

/**
 * THE COUNT AS A FIELD THAT CAN BE WRITTEN IN (owner, 2026-09-25: "inputu boşaltıp baştan sayı
 * yazabilmeyi mümkün kıl"). What is typed is kept exactly as typed while the field is being
 * written in — nothing rewrites it mid-word, so it can be emptied and written again — and goes
 * out within its bounds as it is typed, so a press that follows (a hold on Launch before the
 * field has lost focus) sends this number. Settled on leaving. Shared by the stepper and the
 * kit's ship card.
 */
export function useCountField({ value, min, max, onChange, label, disabled = false, id }: {
  value: number; min: number; max: number; onChange: (value: number) => void; label: string; disabled?: boolean; id?: string;
}) {
  const upper = Math.max(min, max);
  const current = Math.max(min, Math.min(upper, Math.floor(value)));
  const [draft, setDraft] = useState<string | null>(null);
  const enter = (event: ChangeEvent<HTMLInputElement>): void => {
    const typed = event.currentTarget.value.replace(/\D/g, '');
    setDraft(typed);
    const parsed = Number.parseInt(typed, 10);
    onChange(typed === '' ? min : Number.isSafeInteger(parsed) ? Math.max(min, Math.min(upper, parsed)) : upper);
  };
  const field = (className: string) => (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      {...(id === undefined ? {} : { id })}
      disabled={disabled}
      value={draft ?? String(current)}
      // Entered with the count selected, so the first figure typed replaces it.
      onFocus={(event) => { event.currentTarget.select(); }}
      onChange={enter}
      // Settled on leaving: an empty field is the floor, too many the most there are.
      onBlur={() => { setDraft(null); }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      className={className}
    />
  );
  return { upper, current, field, settle: () => { setDraft(null); } };
}

/**
 * One exact count control for build, launch and any later fleet commitment, on the game kit
 * (G2-f): 44 px steps that tick and tap on their own, the last one to the ceiling landing
 * with a thunk. The plate and v2 looks had no caller left (2026-11-16) and are gone.
 */
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
  resetLabel,
  resetText = resetLabel,
}: QuantityStepperProps) {
  const { upper, current, field, settle } = useCountField({ value, min, max, onChange, label: valueLabel });

  const commit = (next: number): void => {
    settle();
    onChange(next);
  };

  const press = (next: number): void => {
    playSound('tick');
    haptic(next >= upper && upper > min ? 'thunk' : 'tap');
    commit(next);
  };
  const step = (label: string, disabled: boolean, next: number, glyph: 'minus' | 'plus') => (
    <button type="button" {...OWN_SOUND} aria-label={label} disabled={disabled} onClick={() => { press(next); }} className="gk-qty__step">
      <Glyph id={glyph} />
    </button>
  );
  return (
    <div className="gk-qty">
      <div className="gk-qty__group">
        {step(decreaseLabel, current <= min, current - 1, 'minus')}
        {field('gk-qty__field gk-num')}
        {step(increaseLabel, current >= upper, current + 1, 'plus')}
      </div>
      <span data-count-max>
        <button type="button" {...OWN_SOUND} aria-label={maxLabel} disabled={current >= upper} onClick={() => { press(upper); }} className="gk-qty__max">
          {maxText}
        </button>
      </span>
      {resetLabel !== undefined && (
        <span data-count-reset>
          <button type="button" {...OWN_SOUND} aria-label={resetLabel} disabled={current <= min} onClick={() => { press(min); }} className="gk-qty__reset">
            {resetText}
          </button>
        </span>
      )}
    </div>
  );

}
