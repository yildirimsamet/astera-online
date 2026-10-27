import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EscortRow } from '../src/ui/EscortRow.js';

const now = Date.parse('2026-10-25T12:00:00Z');

describe('the escort choice on the raid sheet (Y9)', () => {
  it('states what the escort gives, what it risks, and lets the player switch it on', async () => {
    const onChange = vi.fn();
    render(<EscortRow escort={{ kind: 'ready', ship: 'kilavuz', level: 4, bonuses: { damage: 1, hull: 1, time: 0.96, fuel: 0.93 } }}
      on={false} onChange={onChange} now={now} />);
    const toggle = screen.getByRole('switch', { name: /commander ship escorts/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Kılavuz/)).toBeVisible();
    expect(screen.getByText(/travel −4% · fuel −7%/i)).toBeVisible();
    expect(screen.getByText(/never fires and is never hit/i)).toBeVisible();
    expect(screen.getByText(/60 min/i)).toBeVisible();
    await userEvent.setup().click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  /** F23: the row named the risk and never the gain, nor the bay's service after every return. */
  it('says what an escort earns the ship and the service it comes home to', () => {
    render(<EscortRow escort={{ kind: 'ready', ship: 'kilavuz', level: 4, bonuses: { damage: 1, hull: 1, time: 0.96, fuel: 0.93 } }}
      on={false} onChange={vi.fn()} now={now} />);
    expect(screen.getByText(/10–100 ship XP by the size of the battle, 5 without one/i)).toBeVisible();
    expect(screen.getByText(/10 min of service/i)).toBeVisible();
  });

  it('tells a monument raid that a won monument keeps the fleet and sends the ship home alone', () => {
    const { rerender } = render(<EscortRow escort={{ kind: 'ready', ship: 'akinci', level: 4, bonuses: { damage: 1.02, hull: 1, time: 1, fuel: 1 } }}
      on={false} onChange={vi.fn()} now={now} monument />);
    expect(screen.getByText(/the fleet holds the monument and the ship flies home alone/i)).toBeVisible();
    rerender(<EscortRow escort={{ kind: 'ready', ship: 'akinci', level: 4, bonuses: { damage: 1.02, hull: 1, time: 1, fuel: 1 } }}
      on={false} onChange={vi.fn()} now={now} />);
    expect(screen.queryByText(/flies home alone/i)).toBeNull();
  });

  it('names the hull and damage bonuses of the other classes', () => {
    const { rerender } = render(<EscortRow escort={{ kind: 'ready', ship: 'akinci', level: 20, bonuses: { damage: 1.05, hull: 1, time: 1, fuel: 1 } }}
      on onChange={vi.fn()} now={now} />);
    expect(screen.getByText(/damage \+5%/i)).toBeVisible();
    rerender(<EscortRow escort={{ kind: 'ready', ship: 'muhafiz', level: 1, bonuses: { damage: 1, hull: 1.02, time: 1, fuel: 1 } }}
      on onChange={vi.fn()} now={now} />);
    expect(screen.getByText(/hull and shields \+2%/i)).toBeVisible();
  });

  it('keeps a busy ship off, saying what keeps it home and for how long', () => {
    render(<EscortRow escort={{ kind: 'busy', ship: 'kilavuz', level: 4, reason: 'repair', until: now + 90_000 }}
      on={false} onChange={vi.fn()} now={now} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByText(/repair · 1:30/i)).toBeVisible();
  });

  it('draws nothing when there is no escort to offer', () => {
    const view = render(<EscortRow escort={null} on={false} onChange={vi.fn()} now={now} />);
    expect(view.container).toBeEmptyDOMElement();
  });
});
