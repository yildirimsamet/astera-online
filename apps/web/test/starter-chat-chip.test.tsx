import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';
import { wireVessel } from './starterVesselFixture.js';

vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: () => null }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

afterEach(cleanup);

const asked: string[] = [];
const show = (features: readonly string[]) => {
  asked.length = 0;
  const client = createCosmeticTrialClient();
  const vessel = vesselSchema.parse(wireVessel({ features }));
  // The active world is the trial's capital, so the ship has to answer under that key as well.
  for (const key of [keys.planet, keys.planetById('trial-home')]) client.setQueryData(key, { ...vesselToPlanetView(vessel), vessel }, { updatedAt: Date.now() + 86_400_000 });
  const fetch: typeof globalThis.fetch = (input) => {
    asked.push(new URL(input instanceof Request ? input.url : String(input), 'https://test.invalid').pathname);
    return new Promise<Response>(() => undefined);
  };
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <WorldProvider><ToastProvider><GalaxyView panel={null} onPanel={vi.fn()} commander="Orion" onSignOut={vi.fn()} /></ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>);
};

describe('chat aboard', () => {
  it('has its button once the Survey repair opens it', () => {
    show(['chat']);
    expect(screen.getByRole('button', { name: /^Chat/ })).toBeInTheDocument();
  });

  it('has none before that', () => {
    show([]);
    expect(screen.queryByRole('button', { name: /^Chat/ })).toBeNull();
  });

  it('does not ask the main game about returning, since a ship has no season to return to', () => {
    show(['chat']);
    expect(asked).not.toContain('/api/return-applications');
  });

  it('waits to know whether this is a ship before it asks at all', () => {
    asked.length = 0;
    const client = createCosmeticTrialClient();
    client.removeQueries({ queryKey: keys.planet });
    client.removeQueries({ queryKey: keys.planets });
    const fetch: typeof globalThis.fetch = (input) => {
      asked.push(new URL(input instanceof Request ? input.url : String(input), 'https://test.invalid').pathname);
      return new Promise<Response>(() => undefined);
    };
    render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
      <WorldProvider><ToastProvider><GalaxyView panel={null} onPanel={vi.fn()} commander="Orion" onSignOut={vi.fn()} /></ToastProvider></WorldProvider>
    </ApiProvider></QueryClientProvider>);
    expect(asked).not.toContain('/api/return-applications');
  });

  it('is not switched off for a ship by the app around it', () => {
    const app = readFileSync(join(import.meta.dirname, '../src/App.tsx'), 'utf8');
    expect(app).not.toMatch(/showChat: false/);
  });
});
