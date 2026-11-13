import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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

  it('tells a reader how many are chosen, beside what a tap does', () => {
    card(24);
    expect(screen.getByRole('button', { name: /more Dart/i })).toHaveAccessibleDescription('24');
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
    expect(screen.getByText('×0.625')).toBeVisible();
  });

  it('writes the multiplier with every digit the rules have: ×0.625, never ×0.6', () => {
    card(24);
    expect(screen.queryByText('×0.6')).toBeNull();
    expect(screen.getByText('×0.625')).toBeVisible();
  });

  it('stops a minus held down to zero, so a later tap on the card keeps its ship', () => {
    vi.useFakeTimers();
    // a frame at a time, so the card draws between repeats as a browser does
    const wait = (ms: number): void => { for (let t = 0; t < ms; t += 50) act(() => { vi.advanceTimersByTime(50); }); };
    try {
      function Live() {
        const [chosen, setChosen] = useState(3);
        return <UnitCard name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={1} home={40} chosen={chosen} onChange={setChosen} />;
      }
      render(<Live />);
      // held until the minus runs out from under the finger; its release never reaches it
      fireEvent.pointerDown(screen.getByRole('button', { name: /fewer Dart/i }), { button: 0 });
      wait(2_000);
      expect(screen.queryByRole('button', { name: /fewer Dart/i })).toBeNull();
      tap(screen.getByRole('button', { name: /more Dart/i }));
      wait(2_000);
      expect(screen.getByRole('button', { name: /fewer Dart/i })).toBeInTheDocument();
      expect(screen.getByText('1')).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
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

  it('gives the multiplier its own band above the ship, ×1 too, like the card (owner 2026-11-12: the badge hid under the art)', () => {
    const { container, unmount } = render(<UnitBay name="Pike" art="/pike.webp" cls="LANCE" multiplier={1} home={20} chosen={8} selected={false} onSelect={() => undefined} />);
    expect(container.querySelector('.gk-bay__band')).toHaveTextContent('×1');
    unmount();
    const courier = render(<UnitBay name="Courier" art="/courier.webp" cls="SUPPORT" multiplier={null} home={17} chosen={3} selected={false} onSelect={() => undefined} />);
    expect(courier.container.querySelector('.gk-bay__band')).not.toHaveTextContent('×');
  });

  it('leaves the whole band to the exact multiplier and pins the class mark to the ship, in every bay', () => {
    // ×0,625 beside the class mark does not fit a quarter of a 350 px row; rounding it would teach a wrong rule
    for (const multiplier of [0.625, null]) {
      const { container, unmount } = render(<UnitBay name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={multiplier} home={52} chosen={24} selected={false} onSelect={() => undefined} />);
      expect(container.querySelector('.gk-bay__band .gk-emblem')).toBeNull();
      expect(container.querySelector('.gk-bay__ship .gk-emblem')).toBeTruthy();
      expect(container.querySelector('.gk-bay__ship .gk-bay__art')).toBeTruthy();
      unmount();
    }
    render(<UnitBay name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={0.625} home={52} chosen={24} selected={false} onSelect={() => undefined} />);
    expect(screen.getByText('×0.625')).toBeInTheDocument();
  });

  it('shows the share of the stock that goes as a bar under the count', () => {
    const { container } = render(<UnitBay name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={0.6} home={40} chosen={24} selected onSelect={() => undefined} />);
    expect(container.querySelector<HTMLElement>('.gk-bay__share')?.style.getPropertyValue('--share')).toBe('60%');
  });
});
