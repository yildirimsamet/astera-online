import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Preview } from '../src/api/schemas.js';
import { Rehearsal } from '../src/onboarding/Rehearsal.jsx';
import { track } from '../src/lib/analytics.js';
import * as script from '../src/onboarding/script.js';

vi.mock('../src/lib/analytics.js', () => ({ track: vi.fn() }));

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
  it('points at the action using the supplied hand instead of a dark spotlight', () => {
    const beat = script.BEATS.find((entry) => entry.id === 'core')!;
    const current = vi.spyOn(script, 'currentBeat').mockReturnValue(beat);
    const view = render(<Rehearsal preview={preview()} onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(view.container.querySelector('img[src="/assets/images/general/tutorial-hand-icon.png"]')).not.toBeNull();
    expect(view.container.querySelector('#onboarding-spotlight')).toBeNull();
    current.mockRestore();
  });
  it('claims all four opening orders even when skipped immediately', async () => {
    const onClaim = vi.fn(() => Promise.resolve());
    render(<Rehearsal preview={preview()} onClaim={onClaim} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(track).toHaveBeenCalledWith('tutorial_skip', { orders: 0 });
    await user.type(screen.getByLabelText('Commander name'), 'NewPilot');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Password'), 'a-real-password');
    await user.click(screen.getByRole('button', { name: /claim/i }));
    expect(onClaim).toHaveBeenCalledWith('NewPilot', 'a-real-password', [
      { kind: 'upgrade', building: 'CORE' },
      { kind: 'upgrade', building: 'REFINERY' },
      { kind: 'upgrade', building: 'EXTRACTOR' },
      { kind: 'build', hull: 'DART', count: 2 },
    ]);
  });

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
