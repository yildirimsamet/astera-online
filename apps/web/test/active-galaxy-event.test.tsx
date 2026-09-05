import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ActiveGalaxyEvent } from '../src/screens/ActiveGalaxyEvent.js';

const NOW = Date.parse('2026-09-02T10:30:00.000Z');
let endsAt = new Date('2026-09-02T11:00:00.000Z');
let secondEvent = false;
let merchant = false;

vi.mock('../src/api/queries.js', () => ({
  useGalaxyEvents: () => ({
    data: {
      events: [{
        id: '87fd333f-4270-4ada-a809-2f34ea37aca6',
        kind: 'ASTEROID_SHOWER',
        startsAt: new Date('2026-09-02T10:00:00.000Z'),
        endsAt,
        asteroidSpawnMultiplier: 5,
      }, ...(merchant ? [{
        id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
        kind: 'TRADE_SHIP' as const,
        startsAt: new Date('2026-09-02T10:00:00.000Z'),
        endsAt: new Date('2026-09-02T11:00:00.000Z'),
        rate: { alloy: 1, crystal: 3, deuterium: 90 },
        appearsAtMinute: 600,
        expiresAtMinute: 780,
        orbit: {
          radius: 1_100,
          period: 176,
          phase: 0.7,
          inclination: 0.4,
          ascendingNode: 1.9,
          speed: 39.17,
        },
      }] : []), ...(secondEvent ? [{
        id: '6d06f858-e06e-4a06-b2cf-4d58c543203f',
        kind: 'ASTEROID_SHOWER' as const,
        startsAt: new Date('2026-09-02T10:15:00.000Z'),
        endsAt: new Date('2026-09-02T11:15:00.000Z'),
        asteroidSpawnMultiplier: 5,
      }] : [])],
    },
  }),
}));

vi.mock('../src/lib/time.js', () => ({
  countdown: (milliseconds: number) => `${String(Math.floor(milliseconds / 60_000))}m 00s`,
  useNow: () => NOW,
}));

afterEach(async () => {
  endsAt = new Date('2026-09-02T11:00:00.000Z');
  secondEvent = false;
  merchant = false;
  await i18n.changeLanguage('en');
});

describe('active galaxy event chip', () => {
  it('shows the authoritative multiplier and remaining time', () => {
    render(<ActiveGalaxyEvent />);
    expect(screen.getByRole('status')).toHaveTextContent('Asteroid shower');
    expect(screen.getByRole('status')).toHaveTextContent('Spawn ×5 · 30m 00s left');
    expect(screen.getByRole('status')).toHaveClass('pointer-events-none');
  });

  it('disappears at the half-open end boundary', () => {
    endsAt = new Date(NOW);
    render(<ActiveGalaxyEvent />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reads naturally in Turkish', async () => {
    await i18n.changeLanguage('tr');
    render(<ActiveGalaxyEvent />);
    expect(screen.getByRole('status')).toHaveTextContent('Asteroid yağmuru');
    expect(screen.getByRole('status')).toHaveTextContent('Oluşma ×5');
  });

  /**
   * THE SECOND PUBLIC EVENT KIND GETS THE SAME CHIP. D156.
   *
   * It carries the RATE rather than only its name, because the rate is the whole of
   * the decision the merchant is asking for — a commander glancing at the corner
   * should already know whether it is worth opening the rail (D124).
   */
  /**
   * THE RATE IS DRAWN, AND ALL THREE GOODS ARE IN IT. Owner report: the chip read
   * *"90 alaşım = 1 döteryum"*, which names two of the three substances the
   * merchant deals in and spends a line of prose doing it. It is an equality
   * between three quantities, so it is drawn as one — mark, number, equals — which
   * is D142 applied to the smallest surface in the game, and it stops being a
   * translated sentence at the same time.
   */
  it('gives the merchant a chip of its own, with the rate drawn and the clock on it', () => {
    merchant = true;
    render(<ActiveGalaxyEvent />);
    const chips = screen.getAllByRole('status');
    expect(chips).toHaveLength(2);
    const trade = chips.find((chip) => chip.textContent.includes('Trade ship'));
    expect(trade).toBeDefined();

    // Every good is named by its own mark rather than by a word in one language.
    const marks = trade?.querySelectorAll('img') ?? [];
    expect([...marks].map((mark) => mark.getAttribute('alt')))
      .toEqual(['Alloy', 'Crystal', 'Deuterium']);
    expect(trade).toHaveTextContent('90');
    expect(trade).toHaveTextContent('30');
    expect(trade).toHaveTextContent('1');
    expect(trade).toHaveTextContent('30m 00s left');
  });

  it('names the merchant in Turkish too', async () => {
    merchant = true;
    await i18n.changeLanguage('tr');
    render(<ActiveGalaxyEvent />);
    const trade = screen.getAllByRole('status')
      .find((chip) => chip.textContent.includes('Ticaret Gemisi'));
    expect(trade).toBeDefined();
    expect(trade).toHaveTextContent('kaldı');
    const marks = trade?.querySelectorAll('img') ?? [];
    expect([...marks].map((mark) => mark.getAttribute('alt')))
      .toEqual(['Alaşım', 'Kristal', 'Döteryum']);
  });

  it('renders every compatible active event instead of silently selecting the first', () => {
    secondEvent = true;
    render(<ActiveGalaxyEvent />);
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });
});
