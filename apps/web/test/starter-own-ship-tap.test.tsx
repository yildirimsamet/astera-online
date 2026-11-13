import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import type { Focus } from '../src/galaxy/FocusPanel.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';
import { wireVessel } from './starterVesselFixture.js';

// The scene is a button here: a tap on it is the tap on the player's own ship.
vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({
  GalaxyCanvas: ({ onFocus, activePlanetId }: { onFocus: (next: Focus | null) => void; activePlanetId: string }) => (
    <button type="button" data-testid="own-ship" onClick={() => { onFocus({ kind: 'planet', id: activePlanetId }); }} />
  ),
}));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

afterEach(cleanup);

function show() {
  const client = createCosmeticTrialClient();
  const vessel = vesselSchema.parse(wireVessel({ unlockToAnnounce: 'production' }));
  for (const key of [keys.planet, keys.planetById('trial-home')]) client.setQueryData(key, { ...vesselToPlanetView(vessel), vessel }, { updatedAt: Date.now() + 86_400_000 });
  const fetch: typeof globalThis.fetch = () => new Promise<Response>(() => undefined);
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <WorldProvider><ToastProvider><GalaxyView panel={null} onPanel={vi.fn()} commander="Orion" onSignOut={vi.fn()} /></ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>);
}

// Prod 2026-11-10..13: five of six "mark_missing" stops came after a tap on the player's own ship. The
// selection drew nothing, yet it hid the system card and the next-step line the guide was pointing at.
describe('a tap on the own ship', () => {
  it('keeps the system card the guide points at on screen', () => {
    show();
    // No stylesheet here: `hidden` is the Tailwind class the foot of the screen is hidden with.
    expect(screen.getByTestId('unlock-moment').closest('.hidden')).toBeNull();
    act(() => { fireEvent.click(screen.getByTestId('own-ship')); });
    expect(screen.getByTestId('unlock-moment').closest('.hidden')).toBeNull();
  });
});
