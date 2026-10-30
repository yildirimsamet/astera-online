import { useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { openProfile } from '../src/shell/profileRoute.js';

const state = vi.hoisted(() => ({ ready: true, shellMounted: vi.fn(), shellUnmounted: vi.fn() }));
vi.mock('../src/session/useSession.js', () => ({ useSession: () => ({
  session: state.ready
    ? { phase: 'ready', me: { displayName: 'Orion', country: 'TR', isAdmin: false, latestResult: null } }
    : { phase: 'landing' },
  signOut: vi.fn(),
}) }));
vi.mock('../src/session/useEventStream.js', () => ({ useEventStream: vi.fn() }));
vi.mock('../src/session/useLiveAlerts.js', () => ({ useLiveAlerts: vi.fn() }));
vi.mock('../src/lib/music.js', () => ({ useAmbientMusic: vi.fn() }));
vi.mock('../src/api/context.js', () => ({ useApi: () => ({}) }));
vi.mock('../src/api/world.js', () => ({ WorldProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../src/shell/LocalAlertSync.js', () => ({ LocalAlertSync: () => null }));
vi.mock('../src/platform/updateGate.js', () => ({ useUpdateRequired: () => false }));
vi.mock('../src/platform/maintenanceGate.js', () => ({ useMaintenance: () => null }));
vi.mock('../src/landing/public/WebLandingGate.js', () => ({ WebLandingGate: () => <p>Sign in</p> }));
vi.mock('../src/screens/GalaxyView.js', () => ({ GalaxyView: () => <p>Live galaxy</p> }));
vi.mock('../src/v2/shell/GameShell.js', () => ({ GameShell: ({ galaxy, onPanel }: {
  galaxy: (shell: { homeRequest: number; worldsRequest: number; centerRequest: number; clearRequest: number; onPanel: () => void; onOpenChat: () => void }) => ReactNode;
  onPanel: (panel: 'planet') => void;
}) => {
  useEffect(() => { state.shellMounted(); return state.shellUnmounted; }, []);
  return <div><p>Top bar</p><button onClick={openProfile}>Open profile</button><button onClick={() => { onPanel('planet'); }}>Open base</button>
    {galaxy({ homeRequest: 0, worldsRequest: 0, centerRequest: 0, clearRequest: 0, onPanel: () => undefined, onOpenChat: () => undefined })}</div>;
} }));
vi.mock('../src/shell/ProfilePage.js', () => ({ ProfilePage: ({ name, onBack }: { name: string; onBack: () => void }) => <div>Profile for {name}<button onClick={onBack}>Back to game</button></div> }));

beforeEach(() => { state.ready = true; state.shellMounted.mockClear(); state.shellUnmounted.mockClear(); });
afterEach(() => { history.replaceState(null, '', '/'); });

it('requires a session for a direct profile visit', async () => {
  state.ready = false;
  history.replaceState(null, '', '/profile');
  render(<App />);
  expect(await screen.findByText('Sign in')).toBeVisible();
  expect(screen.queryByText('Profile for Orion')).toBeNull();
});

it('restores the authenticated profile from its URL and returns to the game', async () => {
  history.replaceState(null, '', '/profile');
  render(<App />);
  expect(await screen.findByText('Profile for Orion')).toBeVisible();
  expect(screen.getByText('Top bar')).toBeVisible();
  expect(screen.getByText('Live galaxy')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back to game' }));
  expect(await screen.findByRole('button', { name: 'Open profile' })).toBeVisible();
  expect(location.pathname).toBe('/');
  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  expect(await screen.findByText('Profile for Orion')).toBeVisible();
  expect(state.shellMounted).toHaveBeenCalledOnce();
  expect(state.shellUnmounted).not.toHaveBeenCalled();
  act(() => {
    history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(await screen.findByRole('button', { name: 'Open profile' })).toBeVisible();
});

it('closes the profile URL when another game page is selected', async () => {
  history.replaceState(null, '', '/profile');
  render(<App />);
  await screen.findByText('Profile for Orion');
  fireEvent.click(screen.getByRole('button', { name: 'Open base' }));
  expect(location.pathname).toBe('/');
  expect(screen.queryByText('Profile for Orion')).toBeNull();
  expect(screen.getByText('Top bar')).toBeVisible();
});
