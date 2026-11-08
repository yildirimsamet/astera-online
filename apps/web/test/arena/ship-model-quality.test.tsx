import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type * as AssetMemory from '../../src/arena/assets/memory.js';
import { useShipModels } from '../../src/arena/hangar/shipModels.js';

const { full, lite } = vi.hoisted(() => ({ full: '/__ref/dist/v2/ships/akinci-full.glb', lite: '/arena/galaxy-ships/akinci.glb?v=1' }));
vi.mock('../../src/api/context.js', () => ({ useApi: () => ({ galaxyShipModels: () => Promise.resolve({ models: { akinci: { url: lite, engines: [], nozzle: .03, ktx2: false } } }) }) }));
vi.mock('../../src/arena/assets/memory.js', async original => ({ ...await original<typeof AssetMemory>(), ktx2Ready: () => Promise.resolve({}) }));
vi.mock('../../src/arena/assets/manifest.js', () => ({ parseReferenceManifest: () => ({ ships: { classes: {
  akinci: { model: full }, muhafiz: { model: full }, kilavuz: { model: full },
} } }) }));

afterEach(() => { vi.unstubAllGlobals(); });

it('preserves the full compressed model for a roomy desktop hangar', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
  function DesktopHangar() { const models = useShipModels(true, false); return <span>{models?.akinci?.url ?? 'waiting'}</span>; }
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><DesktopHangar /></QueryClientProvider>);
  expect(await screen.findByText(full)).toBeInTheDocument();
  query.clear();
});
