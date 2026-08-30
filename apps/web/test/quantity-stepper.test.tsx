import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from '../src/ui/QuantityStepper.js';

describe('the shared quantity stepper', () => {
  it('uses minus, plus and Max around a read-only input', () => {
    render(
      <QuantityStepper
        value={3}
        min={0}
        max={12}
        onChange={vi.fn()}
        decreaseLabel="Fewer Wasps"
        increaseLabel="More Wasps"
        valueLabel="Wasp quantity"
        maxLabel="Max"
      />,
    );

    expect(screen.getByRole('textbox', { name: /wasp quantity/i })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: /wasp quantity/i })).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /fewer wasps/i })).toHaveTextContent('−');
    expect(screen.getByRole('button', { name: /more wasps/i })).toHaveTextContent('+');
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
