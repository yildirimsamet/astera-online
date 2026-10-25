import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SimulationNumberInput } from '../src/battle-simulator/SimulationNumberInput.js';

function Field({ start = 10 }: { start?: number }) {
  const [value, setValue] = useState(start);
  return <><SimulationNumberInput aria-label="Quantity" value={value} min={0} max={400} onValueChange={setValue} /><output>{value}</output>
    <button type="button" onClick={() => { setValue(7); }}>Preset</button></>;
}
describe('simulation numeric editing', () => {
  it('allows backspace to leave an empty field, then entering 5 without a leading zero', () => {
    render(<Field />);
    const input = screen.getByLabelText('Quantity');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveDisplayValue('');
    fireEvent.change(input, { target: { value: '5' } });
    expect(input).toHaveDisplayValue('5');
    fireEvent.blur(input);
    expect(input).toHaveDisplayValue('5');
    expect(screen.getByRole('status')).toHaveTextContent('5');
  });

  it.each(['', '-3', '401', '2.5'])('resets invalid value %s to zero only on blur', raw => {
    render(<Field />);
    const input = screen.getByLabelText('Quantity');
    fireEvent.focus(input); fireEvent.change(input, { target: { value: raw } });
    expect(input).toHaveDisplayValue(raw);
    fireEvent.blur(input);
    expect(input).toHaveDisplayValue('0');
  });

  it('accepts updated presets when not being edited', () => {
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Preset' }));
    expect(screen.getByLabelText('Quantity')).toHaveDisplayValue('7');
  });
});
