import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.jsx';
import { useEventStream } from '../src/session/useEventStream.js';
import { useLiveAlerts } from '../src/session/useLiveAlerts.js';

vi.mock('../src/session/useSession.js', () => ({ useSession: () => ({
  session: { phase: 'ready', me: { displayName: 'Commander', isAdmin: false, latestResult: null } },
  rollover: vi.fn(), signOut: vi.fn(),
}) }));
vi.mock('../src/session/useEventStream.js', () => ({ useEventStream: vi.fn() }));
vi.mock('../src/session/useLiveAlerts.js', () => ({ useLiveAlerts: vi.fn() }));
vi.mock('../src/lib/music.js', () => ({ useAmbientMusic: vi.fn() }));
vi.mock('../src/api/world.js', () => ({ WorldProvider: ({ children }: { children: ReactNode }) => children }));
// The v2 shell draws the galaxy through its render prop; its HUD reads the API, which
// this boundary test has no use for (the old header and strip were stubbed the same way).
vi.mock('../src/v2/shell/GameShell.js', () => ({
  GameShell: ({ galaxy }: { galaxy: (shell: { homeRequest: number; worldsRequest: number; onPanel: () => void }) => ReactNode }) =>
    galaxy({ homeRequest: 0, worldsRequest: 0, onPanel: () => undefined }),
}));
vi.mock('../src/screens/GalaxyView.jsx', () => ({ GalaxyView: ({ onReplayAcademy }: { onReplayAcademy: () => void }) =>
  <button onClick={onReplayAcademy}>Replay Academy</button> }));
vi.mock('../src/onboarding/Academy.jsx', () => ({ Academy: ({ onLeave }: { onLeave: () => void }) =>
  <button onClick={onLeave}>Leave Academy</button> }));

describe('the replay boundary', () => {
  it('suspends the real stream and alerts while practising and reconnects on return', () => {
    render(<App />);
    expect(vi.mocked(useEventStream).mock.lastCall?.[0]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Replay Academy' }));
    expect(vi.mocked(useEventStream).mock.lastCall?.[0]).toBe(false);
    expect(vi.mocked(useLiveAlerts).mock.lastCall?.[0]).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Academy' }));
    expect(vi.mocked(useEventStream).mock.lastCall?.[0]).toBe(true);
    expect(vi.mocked(useLiveAlerts).mock.lastCall?.[0]).toBe(true);
  });
});
