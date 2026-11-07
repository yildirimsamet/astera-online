import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { coverGalaxy } from '../src/lib/galaxyCover.js';
import { UnlockMoment } from '../src/starter/UnlockMoment.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

function show(overGalaxy: boolean) {
  const fetch: typeof globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 404 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const vessel = vesselSchema.parse(wireVessel({ unlockToAnnounce: 'intel' }));
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch, authTransport: null })}><ToastProvider>
    <UnlockMoment vessel={vessel} overGalaxy={overGalaxy} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
}

/**
 * ONE THING AT A TIME (player test, 2026-11-05). With "While you were away" open, the opening line
 * still showed on the galaxy below it, and its "Got it" landed on the sheet's scrim: the tap closed
 * the story instead. On the galaxy the line now waits until no sheet stands over it.
 */
describe('an opening announced on the galaxy', () => {
  it('waits while a sheet stands over the galaxy', () => {
    const release = coverGalaxy('part');
    show(true);
    expect(screen.queryByTestId('unlock-moment')).toBeNull();
    act(() => { release(); });
    expect(screen.getByTestId('unlock-moment')).toBeTruthy();
  });

  it('stays inside a page that is itself a sheet', () => {
    const release = coverGalaxy('whole');
    show(false);
    expect(screen.getByTestId('unlock-moment')).toBeTruthy();
    release();
  });
});
