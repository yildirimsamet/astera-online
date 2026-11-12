import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnitBay, UnitCard } from '../../src/game-ui/index.js';

/**
 * THE SHIP CARD: the art is the button. A tap adds one ship, a hold adds many, a
 * small minus takes one back, MAX sends the whole stock — and nothing can go past
 * what stands at home.
 */

const tap = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
};

const card = (chosen: number, onChange = vi.fn()) => {
  render(<UnitCard name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={0.625} home={40} chosen={chosen} onChange={onChange} />);
  return onChange;
};

describe('the ship card', () => {
  it('adds one ship per tap on the card', () => {
    const onChange = card(24);
    tap(screen.getByRole('button', { name: /more Dart/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it('adds nothing once the whole stock is chosen', () => {
    const onChange = card(40);
    tap(screen.getByRole('button', { name: /more Dart/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes one back with the minus, which only shows when something is chosen', () => {
    const onChange = card(24);
    tap(screen.getByRole('button', { name: /fewer Dart/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(23);
  });

  it('has no minus at zero', () => {
    card(0);
    expect(screen.queryByRole('button', { name: /fewer Dart/i })).toBeNull();
  });

  it('sends the whole stock with max', () => {
    const onChange = card(3);
    const max = screen.getByRole('button', { name: /max.*Dart|Dart.*max/i });
    fireEvent.pointerDown(max, { button: 0 });
    fireEvent.click(max, { detail: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('shows the chosen count, the stock and the counter multiplier', () => {
    card(24);
    expect(screen.getByText('24')).toBeVisible();
    expect(screen.getByText('40')).toBeVisible();
    expect(screen.getByText('×0.6')).toBeVisible();
  });
});

describe('the ship bay', () => {
  it('is chosen for the slider by a press and says how many of the stock go', () => {
    const onSelect = vi.fn();
    render(<UnitBay name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={1.6} home={40} chosen={24} selected={false} onSelect={onSelect} />);
    const bay = screen.getByRole('button', { name: /Dart/ });
    expect(bay).toHaveAttribute('aria-pressed', 'false');
    expect(bay).toHaveTextContent('24');
    expect(bay).toHaveTextContent('/40');
    fireEvent.pointerDown(bay, { button: 0 });
    fireEvent.click(bay, { detail: 1 });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
