import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { MiningRun } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { closeFocus } from '../src/starter/tutorial/focusClose.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';
import { wireVessel } from './starterVesselFixture.js';

vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: () => null }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

afterEach(cleanup);

const run: MiningRun = {
  id: 'r1', targetKind: 'asteroid', asteroidId: 'rock', debrisFieldId: null, status: 'outbound', craft: 1,
  departAt: new Date(Date.now() - 10_000), arriveAt: new Date(Date.now() + 30_000), recalledAt: null, homeAt: null,
  intercept: { x: 0, y: 0, z: 0 }, minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0,
};

/** The starter ship's galaxy, a followed flight's card open on it. */
function galaxyWithFocus() {
  const client = createCosmeticTrialClient();
  const vessel = vesselSchema.parse(wireVessel({ id: 'trial-home' }));
  for (const key of [keys.planet, keys.planetById('trial-home')]) client.setQueryData(key, { ...vesselToPlanetView(vessel), vessel }, { updatedAt: Date.now() + 86_400_000 });
  for (const key of [keys.miningStatus, keys.miningStatusById('trial-home')]) client.setQueryData(key, { runs: [run], isotopes: [] }, { updatedAt: Date.now() + 86_400_000 });
  const fetch: typeof globalThis.fetch = () => new Promise<Response>(() => undefined);
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <WorldProvider><ToastProvider>
      <GalaxyView panel={null} onPanel={vi.fn()} commander="Orion" onSignOut={vi.fn()} craftFocusRequest={{ request: 1, focus: { kind: 'run', id: 'r1' } }} />
    </ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>);
}

/**
 * Isolated player test 2026-11-18: a player who had closed the guide followed the next-step line from
 * repair to repair, sent the Prospector, and the card that follows it took the foot; with the line gone
 * there was "nothing to do" for a minute and they quit. The line rides above the followed flight.
 */
describe('a followed launch on the starter ship', () => {
  it('keeps the next step over the flight card', () => {
    galaxyWithFocus();
    const rail = document.querySelector('[data-focus-rail]');
    expect(rail).not.toBeNull();
    expect(rail?.contains(screen.getByTestId('ship-objective'))).toBe(true);
  });
});

/** Owner, phone playtest 2026-11-18 (item 12): the guide puts a read card away through the galaxy's own close. */
describe('the galaxy lends the guide its close', () => {
  it('closes the open focus card when the guide asks', () => {
    galaxyWithFocus();
    expect(document.querySelector('[data-focus-rail]')).not.toBeNull();
    act(() => { closeFocus(); });
    expect(document.querySelector('[data-focus-rail]')).toBeNull();
  });
});
