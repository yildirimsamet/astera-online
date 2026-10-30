import { useEffect, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App.js';
import { useSession } from '../../src/session/useSession.js';
import { useEventStream } from '../../src/session/useEventStream.js';
import { useLiveAlerts } from '../../src/session/useLiveAlerts.js';

const lifecycle = vi.hoisted(() => ({ mounted: 0, unmounted: 0 }));
vi.mock('../../src/session/useSession.js', () => ({ useSession: vi.fn(() => ({
  session: { phase: 'ready', me: { displayName: 'Pilot', isAdmin: false, latestResult: null } },
  rollover: vi.fn(), signOut: vi.fn(),
})) }));
vi.mock('../../src/session/useEventStream.js', () => ({ useEventStream: vi.fn() }));
vi.mock('../../src/session/useLiveAlerts.js', () => ({ useLiveAlerts: vi.fn() }));
vi.mock('../../src/api/context.js', () => ({ useApi: () => ({ accessToken: null, restore: () => Promise.resolve(false) }) }));
vi.mock('../../src/lib/music.js', () => ({ useAmbientMusic: vi.fn() }));
vi.mock('../../src/shell/LocalAlertSync.js', () => ({ LocalAlertSync: () => null }));
vi.mock('../../src/api/world.js', () => ({ WorldProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../../src/v2/shell/GameShell.js', () => ({ GameShell:
  ({ galaxy }: { galaxy: (props: object) => ReactNode }) => galaxy({}),
}));
vi.mock('../../src/screens/GalaxyView.js', () => ({ GalaxyView: function GalaxyStub({ onEnterArena }: { onEnterArena: () => void }) {
  useEffect(() => { lifecycle.mounted++; return () => { lifecycle.unmounted++; }; }, []);
  return <button onClick={onEnterArena}>Enter flight</button>;
} }));
vi.mock('../../src/arena/ArenaGate.js', () => ({ ArenaGate: ({ onLeave }: { onLeave: () => void }) =>
  <div data-testid="arena"><button onClick={onLeave}>Leave flight</button></div>,
}));

afterEach(() => { history.replaceState(null, '', '/'); vi.unstubAllEnvs(); });

describe('a flight replaces the galaxy canvas while the session stays alive', () => {
  it('unmounts the galaxy, keeps alerts and SSE on, then remounts on return', async () => {
    lifecycle.mounted = 0;
    lifecycle.unmounted = 0;
    render(<App />);
    // The game branch is lazy: the public page renders first, the session after it loads.
    fireEvent.click(await screen.findByRole('button', { name: 'Enter flight' }, { timeout: 10_000 }));
    expect(screen.getByTestId('arena')).toBeInTheDocument();
    expect(lifecycle.unmounted).toBe(1);
    expect(vi.mocked(useEventStream).mock.lastCall?.[0]).toBe(true);
    expect(vi.mocked(useLiveAlerts).mock.lastCall?.[0]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Leave flight' }));
    expect(screen.queryByTestId('arena')).not.toBeInTheDocument();
    expect(lifecycle.mounted).toBe(2);
  });

  it('opens the local sandbox without authentication or a live galaxy subscription', () => {
    history.replaceState(null, '', '/?arena=sandbox');
    const before = vi.mocked(useSession).mock.calls.length;
    const streams = vi.mocked(useEventStream).mock.calls.length;
    render(<App />);
    expect(screen.getByTestId('arena')).toBeInTheDocument();
    expect(vi.mocked(useSession).mock.calls.length).toBe(before);
    expect(vi.mocked(useEventStream).mock.calls.length).toBe(streams);
  });

  it('ignores an unauthenticated sandbox URL in the ordinary production build', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ARENA', '1');
    history.replaceState(null, '', '/?arena=sandbox');
    render(<App />);
    expect(screen.queryByTestId('arena')).not.toBeInTheDocument();
  });
});
