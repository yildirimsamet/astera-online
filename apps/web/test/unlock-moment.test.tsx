import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { UnlockMoment } from '../src/starter/UnlockMoment.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

afterEach(() => { cleanup(); document.querySelectorAll('[data-loading-screen]').forEach((node) => { node.remove(); }); });

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
