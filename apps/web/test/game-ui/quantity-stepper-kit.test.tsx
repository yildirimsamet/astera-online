import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { haptic } from '../../src/lib/haptics.js';
import { playSound } from '../../src/lib/sound.js';
import type * as Sound from '../../src/lib/sound.js';
import type * as Haptics from '../../src/lib/haptics.js';
import { QuantityStepper } from '../../src/ui/QuantityStepper.js';

vi.mock('../../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), playSound: vi.fn() }));
vi.mock('../../src/lib/haptics.js', async (original) => ({ ...await original<typeof Haptics>(), haptic: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });

const draw = (value = 2, onChange = vi.fn()) => render(
  <QuantityStepper
    look="kit"
    value={value}
    min={0}
    max={5}
    onChange={onChange}
    decreaseLabel="Fewer Darts"
    increaseLabel="More Darts"
    valueLabel="Dart quantity"
    maxLabel="All Darts"
    maxText="All"
  />,
);

/**
 * THE COUNT ON THE GAME KIT (G2-f, 2026-11-14). The v2 look's steps were 28 px and the global
 * mixer clicked for them; on the kit each step is a 44 px press that ticks and taps on its own,
 * and the last one to the ceiling lands with a thunk. The presses, labels and markers are the
 * shared stepper's.
 */
describe('the kit look of the count', () => {
  it('draws its steps, its field and its Max as the kit’s own presses', () => {
    const { container } = draw();
    for (const name of ['Fewer Darts', 'More Darts', 'All Darts']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('data-own-sound');
    }
    expect(container.querySelector('.gk-qty')).not.toBeNull();
    expect(container.querySelector('[data-count-max]')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Dart quantity' })).toHaveValue('2');
  });

  it('ticks and taps on a step, and thunks when it reaches the ceiling', async () => {
    const onChange = vi.fn();
    draw(2, onChange);
    await userEvent.click(screen.getByRole('button', { name: 'More Darts' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(playSound).toHaveBeenLastCalledWith('tick');
    expect(haptic).toHaveBeenLastCalledWith('tap');
    await userEvent.click(screen.getByRole('button', { name: 'All Darts' }));
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(haptic).toHaveBeenLastCalledWith('thunk');
  });

  it('is dead in the direction it cannot go', () => {
    draw(0);
    expect(screen.getByRole('button', { name: 'Fewer Darts' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More Darts' })).toBeEnabled();
  });
});
