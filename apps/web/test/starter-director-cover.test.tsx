import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { playScene, resetDirector } from '../src/starter/director/director.js';
import { yardNeedScene } from '../src/starter/director/scenes.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';
import { wireVessel } from './starterVesselFixture.js';

const cover = vi.hoisted(() => ({ on: true }));
const canvas = vi.hoisted(() => vi.fn((props: { starter?: { directorLive?: boolean }; onFocus?: (focus: { kind: 'planet'; id: string } | null) => void }) => { void props; return null; }));
vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: canvas }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => cover.on }));

afterEach(() => { cleanup(); resetDirector(); });

const galaxy = () => {
  const client = createCosmeticTrialClient();
  const vessel = vesselSchema.parse(wireVessel({ id: 'trial-home' }));
  for (const key of [keys.planet, keys.planetById('trial-home')]) client.setQueryData(key, { ...vesselToPlanetView(vessel), vessel }, { updatedAt: Date.now() + 86_400_000 });
  const fetch: typeof globalThis.fetch = () => new Promise<Response>(() => undefined);
  return <QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <WorldProvider><ToastProvider><GalaxyView panel={null} onPanel={vi.fn()} commander="Orion" onSignOut={vi.fn()} /></ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>;
};

/**
 * Live playthrough 2026-11-18: the ship's first report ran its tagged round under the opening cover
 * ("preparing the game view"), and a new commander saw only its last shot. A scene waits for the sky.
 */
describe('the director and the opening cover', () => {
  it('holds a scene while the galaxy is still covered, and plays it once the cover lifts', () => {
    cover.on = true;
    const { rerender } = render(galaxy());
    act(() => { playScene(yardNeedScene(), 'trial-home'); });
    expect(screen.queryByTestId('director-stage')).toBeNull();
    // Nor do the camera and the hull's tags begin it: they would run their course out of sight.
    expect(canvas.mock.lastCall?.[0].starter?.directorLive).toBe(false);
    cover.on = false;
    rerender(galaxy());
    expect(screen.getByTestId('director-stage').getAttribute('data-scene')).toBe('yardNeed');
    expect(canvas.mock.lastCall?.[0].starter?.directorLive).toBe(true);
  });

  // Owner phone playtest 2026-11-19: a scene that comes while a world is open would take the camera from it mid-action.
  it('holds a scene while a world is open in the focus card, and plays it once it is put down', () => {
    cover.on = false;
    render(galaxy());
    act(() => { canvas.mock.lastCall?.[0].onFocus?.({ kind: 'planet', id: 'neighbour-1' }); });
    act(() => { playScene(yardNeedScene(), 'trial-home'); });
    expect(screen.queryByTestId('director-stage')).toBeNull();
    expect(canvas.mock.lastCall?.[0].starter?.directorLive).toBe(false);
    act(() => { canvas.mock.lastCall?.[0].onFocus?.(null); });
    expect(screen.getByTestId('director-stage').getAttribute('data-scene')).toBe('yardNeed');
  });
});
