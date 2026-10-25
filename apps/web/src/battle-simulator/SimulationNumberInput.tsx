import { useState, type InputHTMLAttributes } from 'react';

interface NumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'min' | 'max'> {
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onValueChange: (value: number) => void;
}

/** An unfinished edit is text; only blur normalises it. External preset changes still replace the display. */
export function SimulationNumberInput({ value, min, max, integer = true, onValueChange, ...props }: NumberProps) {
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(null);
  return <input {...props} type="number" inputMode="numeric" min={min} max={max}
    value={draft && Object.is(draft.source, value) ? draft.text : String(value)}
    onChange={event => {
      const text = event.currentTarget.value, number = text === '' ? 0 : Number(text);
      setDraft({ source: number, text }); onValueChange(number);
    }}
    onBlur={event => {
      const text = event.currentTarget.value, number = Number(text);
      const valid = text !== '' && Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
      setDraft(null); onValueChange(valid ? number : 0);
    }} />;
}
