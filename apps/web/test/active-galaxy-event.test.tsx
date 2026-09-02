import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ActiveGalaxyEvent } from '../src/screens/ActiveGalaxyEvent.js';

const NOW = Date.parse('2026-09-02T10:30:00.000Z');
let endsAt = new Date('2026-09-02T11:00:00.000Z');
let secondEvent = false;

vi.mock('../src/api/queries.js', () => ({
  useGalaxyEvents: () => ({
    data: {
      events: [{
        id: '87fd333f-4270-4ada-a809-2f34ea37aca6',
        kind: 'ASTEROID_SHOWER',
        startsAt: new Date('2026-09-02T10:00:00.000Z'),
        endsAt,
        asteroidSpawnMultiplier: 5,
      }, ...(secondEvent ? [{
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

  it('renders every compatible active event instead of silently selecting the first', () => {
    secondEvent = true;
    render(<ActiveGalaxyEvent />);
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });
});
