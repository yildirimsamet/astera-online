import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Preview } from '../src/api/schemas.js';
import { Rehearsal } from '../src/onboarding/Rehearsal.jsx';

vi.mock('../src/screens/GalaxyView.jsx', () => ({
  GalaxyView: () => <div data-testid="rehearsal-galaxy" />,
}));

vi.mock('../src/shell/PendingStrip.js', () => ({
  PendingStrip: () => null,
}));

vi.mock('../src/shell/StatusBar.js', () => ({
  StatusBar: () => null,
}));

vi.mock('../src/onboarding/Gate.jsx', () => ({
  Spotlight: () => null,
  useGate: () => undefined,
  usePlacement: () => 'bottom' as const,
  useScrollIntoView: () => undefined,
}));

vi.mock('../src/onboarding/BeatCard.jsx', () => ({
  BeatCard: ({ onSkip, skipLabel }: { onSkip: () => void; skipLabel: string }) => (
    <button type="button" onClick={onSkip}>{skipLabel}</button>
  ),
}));

const preview = (): Preview => ({
  season: {
    seasonId: 'season-1',
    shard: 'EU-1',
    shardName: 'Vantage',
    seed: 1,
    status: 'live',
    startsAt: new Date('2026-08-30T10:00:00Z'),
    endsAt: new Date('2026-09-13T10:00:00Z'),
    playerCap: 50,
    players: 2,
  },
  galaxy: { you: { planetId: 'reserved', playerId: 'reserved' }, planets: [] },
  traffic: { contacts: [] },
  reserved: {
    id: 'reserved',
    name: 'Kestrel-12',
    slotIndex: 12,
    position: { x: 0, y: 0, z: 0 },
  },
  shard: { code: 'EU-1', name: 'Vantage', planets: 2, capacity: 50, online: 1 },
});

describe('skipping the onboarding rehearsal', () => {
  it('opens the final commander-credentials step instead of returning to the landing screen', async () => {
    const onLeave = vi.fn();
    render(
      <Rehearsal
        preview={preview()}
        onClaim={vi.fn(() => Promise.resolve())}
        onSignIn={vi.fn()}
        onLeave={onLeave}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Skip' }));

    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Sign the world with your name' })).toBeInTheDocument();
    expect(screen.getByLabelText('Commander name')).toHaveFocus();
  });
});
