import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from '../src/ui/QuantityStepper.js';

describe('the shared quantity stepper', () => {
  it('uses minus, plus and Max around a field the count can be typed into', () => {
    render(
      <QuantityStepper
        value={3}
        min={0}
        max={12}
        onChange={vi.fn()}
        decreaseLabel="Fewer Darts"
        increaseLabel="More Darts"
        valueLabel="Dart quantity"
        maxLabel="Max"
      />,
    );

    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).not.toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('button', { name: /fewer darts/i })).toHaveTextContent('−');
    expect(screen.getByRole('button', { name: /more darts/i })).toHaveTextContent('+');
    expect(screen.getByRole('button', { name: 'Max' })).toBeInTheDocument();
  });

  it('changes by exactly one and jumps to the real maximum', async () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={6}
        min={0}
        max={200}
        onChange={onChange}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Quantity"
        maxLabel="Max"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Fewer' }));
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Max' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 5);
    expect(onChange).toHaveBeenNthCalledWith(2, 7);
    expect(onChange).toHaveBeenNthCalledWith(3, 200);
  });

  it('disables only the direction that crossed a boundary', () => {
    const { rerender } = render(
      <QuantityStepper
        value={0}
        min={0}
        max={2}
        onChange={vi.fn()}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Quantity"
        maxLabel="Max"
      />,
    );
    expect(screen.getByRole('button', { name: 'Fewer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More' })).toBeEnabled();

    rerender(
      <QuantityStepper
        value={2}
        min={0}
        max={2}
        onChange={vi.fn()}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Quantity"
        maxLabel="Max"
      />,
    );
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Max' })).toBeDisabled();
  });
});

/**
 * THE WAY BACK DOWN FROM MAX. Owner report against the craft sheet: there was an
 * "En fazla" and no way to undo it except by holding minus.
 *
 * It is OPTIONAL because the two callers want different floors: a build sheet
 * starts at one — you cannot order nothing — so its reset returns to `min`, while
 * a launch picker starts at zero and already has "none" as a real state.
 */
describe('the reset control', () => {
  it('is absent unless a caller asks for it', () => {
    render(
      <QuantityStepper
        value={3}
        min={1}
        max={9}
        onChange={vi.fn()}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Count"
        maxLabel="Max"
      />,
    );
    expect(document.querySelector('[data-count-reset]')).toBeNull();
  });

  it('returns the count to its floor in one press', async () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={40}
        min={1}
        max={99}
        onChange={onChange}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Count"
        maxLabel="Max"
        resetLabel="Reset the count"
        resetText="Reset"
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reset the count' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  /** Already at the floor, there is nothing to undo. */
  it('is dead at the floor, the way Max is dead at the ceiling', () => {
    render(
      <QuantityStepper
        value={1}
        min={1}
        max={99}
        onChange={vi.fn()}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Count"
        maxLabel="Max"
        resetLabel="Reset the count"
        resetText="Reset"
      />,
    );
    expect(screen.getByRole('button', { name: 'Reset the count' })).toBeDisabled();
  });
});

/**
 * TYPING A COUNT (owner, 2026-09-25: "ortadaki input'a tıklayıp klavyeden sayı girebilmeliyim
 * ... inputu boşaltıp baştan sayı yazabilmeyi mümkün kıl"). Every stepper takes digits; the
 * field may be emptied and written again, and what was typed stays as typed until the player
 * leaves the field — then it is settled: an empty field to the floor, too many to the most
 * there are. The count still goes out as it is typed (within its bounds), so a press that
 * follows the typing never sends the number from before it.
 */
describe('typing a count', () => {
  function Held({ initial, min, max, onChange, look }: {
    initial: number; min: number; max: number; onChange: (value: number) => void; look?: 'plate' | 'v2';
  }) {
    const [value, setValue] = useState(initial);
    return (
      <QuantityStepper
        value={value}
        min={min}
        max={max}
        onChange={(next) => { onChange(next); setValue(next); }}
        decreaseLabel="Fewer"
        increaseLabel="More"
        valueLabel="Count"
        maxLabel="Max"
        {...(look ? { look } : {})}
      />
    );
  }

  it.each(['plate', 'v2'] as const)('empties, takes digits and settles on leaving (%s)', async (look) => {
    const onChange = vi.fn();
    render(<Held initial={0} min={0} max={200} onChange={onChange} look={look} />);
    const user = userEvent.setup();
    const field = screen.getByRole('textbox', { name: 'Count' });

    await user.clear(field);
    expect(field).toHaveValue('');
    await user.type(field, '25');
    expect(field).toHaveValue('25');
    expect(onChange).toHaveBeenLastCalledWith(25);

    await user.type(field, '00');
    expect(field).toHaveValue('2500');
    expect(onChange).toHaveBeenLastCalledWith(200);
    await user.tab();
    expect(field).toHaveValue('200');
  });

  it('settles an emptied field on the floor when the player leaves it', async () => {
    const onChange = vi.fn();
    render(<Held initial={7} min={1} max={99} onChange={onChange} look="v2" />);
    const user = userEvent.setup();
    const field = screen.getByRole('textbox', { name: 'Count' });

    await user.clear(field);
    expect(field).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await user.tab();
    expect(field).toHaveValue('1');
  });

  it('ignores what is not a digit, and Enter settles it', async () => {
    const onChange = vi.fn();
    render(<Held initial={3} min={0} max={50} onChange={onChange} look="v2" />);
    const user = userEvent.setup();
    const field = screen.getByRole('textbox', { name: 'Count' });

    await user.clear(field);
    await user.type(field, 'a9-9');
    expect(field).toHaveValue('99');
    await user.type(field, '{Enter}');
    expect(field).toHaveValue('50');
    expect(field).not.toHaveFocus();
  });

  it('selects the count when the field is entered, so typing replaces it', async () => {
    const onChange = vi.fn();
    render(<Held initial={12} min={0} max={50} onChange={onChange} look="v2" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Count' }));
    await user.keyboard('4');
    expect(screen.getByRole('textbox', { name: 'Count' })).toHaveValue('4');
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('shows a step pressed after typing, not the typed digits', async () => {
    const onChange = vi.fn();
    render(<Held initial={0} min={0} max={50} onChange={onChange} look="v2" />);
    const user = userEvent.setup();
    const field = screen.getByRole('textbox', { name: 'Count' });
    await user.clear(field);
    await user.type(field, '80');
    await user.click(screen.getByRole('button', { name: 'Fewer' }));
    expect(field).toHaveValue('49');
    expect(onChange).toHaveBeenLastCalledWith(49);
  });
});
