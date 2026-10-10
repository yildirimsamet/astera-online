import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveGalaxyEvent } from '../../src/api/schemas.js';
import { ChatChip, EventChips, HomeChip } from '../../src/v2/hud/GalaxyCorners.js';

/**
 * THE GALAXY'S CORNERS. Owner feedback, 2026-09-24.
 *
 * Three things the old disc had in plain sight and the v2 shell hid: a way home to the
 * active world, the event running now with its time left, and the chat. Small and
 * see-through, so the galaxy stays the screen.
 */
const NOW = Date.parse('2026-09-24T12:00:00Z');

const trade: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000002',
  kind: 'TRADE_SHIP',
  startsAt: new Date(NOW - 600_000),
  endsAt: new Date(NOW + 47 * 60_000),
  rate: { alloy: 1, crystal: 2, deuterium: 4 },
  appearsAtMinute: 0,
  expiresAtMinute: 60,
  orbit: { radius: 100, period: 60, phase: 0, inclination: 0, ascendingNode: 0, speed: 1 },
};

const shower: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'ASTEROID_SHOWER',
  startsAt: new Date(NOW - 3_600_000),
  endsAt: new Date(NOW + 90 * 60_000),
  asteroidSpawnMultiplier: 2,
};

describe('the way home', () => {
  it('flies to the active world on a press', async () => {
    const onHome = vi.fn();
    render(<HomeChip onHome={onHome} />);
    await userEvent.click(screen.getByRole('button', { name: /fly to your world/i }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});

describe('the chat, in reach', () => {
  it('opens the chat and says how much is unread', async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<ChatChip unread={0} onOpen={onOpen} />);
    expect(screen.getByRole('button', { name: /^chat$/i })).toBeInTheDocument();
    rerender(<ChatChip unread={4} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /chat.*4 unread/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('the events running now', () => {
  it('names each event with the time it has left', () => {
    render(<EventChips events={[trade, shower]} now={NOW} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /trade ship.*47m/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /asteroid shower.*1h 30m/i })).toBeInTheDocument();
  });

  it('shows the actual shower multiplier in the primary color before its remaining time', async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<EventChips events={[trade, shower]} now={NOW} onOpen={onOpen} />);
    const chip = screen.getByRole('button', { name: /asteroid shower.*2x.*1h 30m/i });
    expect(within(chip).getByText('2x')).toHaveClass('text-v2-self');
    expect(chip.textContent).toMatch(/Asteroid shower2x1h 30m/i);
    expect(within(screen.getByRole('button', { name: /trade ship/i })).queryByText(/\dx/)).toBeNull();
    await userEvent.click(chip);
    expect(onOpen).toHaveBeenCalledWith(shower);
    const oldCalendarEvent: ActiveGalaxyEvent = { ...shower, asteroidSpawnMultiplier: 5 };
    rerender(<EventChips events={[oldCalendarEvent]} now={NOW} onOpen={onOpen} />);
    expect(screen.getByRole('button', { name: /asteroid shower.*5x/i })).toBeInTheDocument();
    expect(screen.queryByText('2x')).toBeNull();
  });

  it('hands the pressed event to its host', async () => {
    const onOpen = vi.fn();
    render(<EventChips events={[trade]} now={NOW} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /trade ship/i }));
    expect(onOpen).toHaveBeenCalledWith(trade);
  });

  it('draws nothing when nothing is running', () => {
    const { container } = render(<EventChips events={[]} now={NOW} onOpen={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
