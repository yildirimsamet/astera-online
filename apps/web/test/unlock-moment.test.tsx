import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { playScene, resetDirector, skipBeat } from '../src/starter/director/director.js';
import { UnlockMoment } from '../src/starter/UnlockMoment.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

beforeEach(() => { localStorage.clear(); resetDirector(); });
afterEach(() => { cleanup(); resetDirector(); document.querySelectorAll('[data-loading-screen]').forEach((node) => { node.remove(); }); });

function show(onAwaken: () => void) {
  const api = new Api({ fetch: () => Promise.resolve(new Response('{}', { status: 404 })), authTransport: null });
  render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><ToastProvider>
    <UnlockMoment vessel={vesselSchema.parse(wireVessel({ unlockToAnnounce: 'intel' }))} overGalaxy onAwaken={onAwaken} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
}

/** Onboarding design §5.3: the bay lights up where the player can see it, not under the loading cover. */
describe('a system coming back on the galaxy', () => {
  it('lights the bay of the system that came back', async () => {
    const awaken = vi.fn();
    show(awaken);
    await waitFor(() => { expect(awaken).toHaveBeenCalledWith('SURVEY'); });
    expect(awaken).toHaveBeenCalledTimes(1);
  });

  it('takes the player to what opened when "Try it" is pressed', () => {
    const tried = vi.fn();
    const api = new Api({ fetch: () => Promise.resolve(new Response('{}', { status: 404 })), authTransport: null });
    render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><ToastProvider>
      <UnlockMoment vessel={vesselSchema.parse(wireVessel({ unlockToAnnounce: 'intel' }))} overGalaxy onTry={tried} />
    </ToastProvider></ApiProvider></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /try/i }));
    expect(tried).toHaveBeenCalledWith('intel');
  });

  it('waits until the loading cover is gone', async () => {
    const cover = document.createElement('main');
    cover.setAttribute('data-loading-screen', '');
    document.body.append(cover);
    const awaken = vi.fn();
    show(awaken);
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    expect(awaken).not.toHaveBeenCalled();
    cover.remove();
    await waitFor(() => { expect(awaken).toHaveBeenCalledWith('SURVEY'); });
  });
});

// Live play 2026-11-18: the telescope came back on the hull in a scene, then a card announced it again
// ("Defence systems online") and the sky would not open until it was closed.
describe('a system the director has just shown coming back', () => {
  const telescope = vesselSchema.parse(wireVessel({ unlockToAnnounce: 'telescope' }));
  const mount = (calls: string[]) => {
    const api = new Api({ fetch: (input) => { calls.push(String(input)); return Promise.resolve(new Response('{}', { status: 404 })); }, authTransport: null });
    return render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><ToastProvider>
      <UnlockMoment vessel={telescope} overGalaxy />
    </ToastProvider></ApiProvider></QueryClientProvider>);
  };
  const doneScene = { id: 'repair:TELESCOPE:1:done', once: true, beats: [{ id: 'back', shot: { kind: 'bay' as const, system: 'DEFENCE' as const }, ms: 2600 }] };

  it('shows no card while a scene plays', () => {
    act(() => { playScene(doneScene, telescope.id); });
    mount([]);
    expect(screen.queryByTestId('unlock-moment')).toBeNull();
  });

  it('needs no card once its scene has played: the system is taken as seen', async () => {
    act(() => { playScene(doneScene, telescope.id); skipBeat(); });
    const calls: string[] = [];
    mount(calls);
    expect(screen.queryByTestId('unlock-moment')).toBeNull();
    await waitFor(() => { expect(calls.some(url => url.includes('/api/starter/unlocks/seen'))).toBe(true); });
  });

  it('still shows its card to a player who was away while it opened', () => {
    mount([]);
    expect(screen.getByTestId('unlock-moment')).toBeInTheDocument();
  });
});
