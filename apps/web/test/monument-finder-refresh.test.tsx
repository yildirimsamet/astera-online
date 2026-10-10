import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { galaxySchema, seasonSchema } from '../src/api/schemas.js';
import { WorldProvider } from '../src/api/world.js';
import { setMonumentHonorees } from '../src/i18n/names.js';
import { GalaxyView } from '../src/screens/GalaxyView.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';

// Keep the production host, API schemas, cache and finder; WebGL has no bearing
// on a season response arriving after the public monument positions.
vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: () => null }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

afterEach(() => { setMonumentHonorees([]); });

it.each([false, true])('updates an open finder when season honours change without changing the public galaxy snapshot (clear names: %s)', async (clearNames) => {
  const honorees = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
  setMonumentHonorees(clearNames ? honorees : []);
  const client = createCosmeticTrialClient();
  const galaxy = galaxySchema.parse(client.getQueryData(keys.galaxy));
  const season = seasonSchema.parse(client.getQueryData(keys.season));
  client.setQueryData(keys.galaxy, galaxySchema.parse({ ...galaxy, monuments: Array.from({ length: 8 }, (_, index) => ({
    id: `monument-${String(index + 1)}`, ordinal: index + 1, difficulty: index < 4 ? 'HARD' : 'EASY',
    position: { x: 6000, y: index * 100, z: 0 }, controller: { kind: 'NEUTRAL' },
    capacity: index < 4 ? 7270 : 1550, used: 0, productionPerMinute: index < 4 ? 8 : 3,
    radiationHpPerMinute: index < 4 ? 5 : 2, emptySince: null, respawnAt: null,
  })) }));
  client.setQueryData(keys.season, { ...season, monumentHonorees: clearNames ? honorees : [] });
  const publicSnapshot = client.getQueryData(keys.galaxy);
  const fetch: typeof globalThis.fetch = (input) => {
    const url = input instanceof Request ? input.url : String(input);
    return new URL(url, 'https://test.invalid').pathname === '/api/season'
      ? Promise.resolve(new Response(JSON.stringify({ ...season, monumentHonorees: clearNames ? [] : honorees })))
      : new Promise<Response>(() => undefined);
  };
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <WorldProvider><ToastProvider><GalaxyView panel={null} onPanel={vi.fn()} commander="Orion"
      onSignOut={vi.fn()} showChat={false} showGuidance /></ToastProvider></WorldProvider>
  </ApiProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '8 monuments' }));
  const list = screen.getByRole('list');
  expect(within(list).getAllByRole('button').at(-1)).toHaveTextContent(clearNames ? 'Eighth • Ancient War Cemetery' : 'Ancient War Cemetery');
  if (!clearNames) expect(list).not.toHaveTextContent('Eighth');

  await act(async () => { await client.refetchQueries({ queryKey: keys.season, exact: true }); });

  expect(client.getQueryData(keys.galaxy)).toBe(publicSnapshot);
  await waitFor(() => {
    const entries = within(list).getAllByRole('button');
    expect(entries[0]).toHaveTextContent(clearNames ? 'Abandoned Space Wreckage' : 'First • Abandoned Space Wreckage');
    expect(entries[7]).toHaveTextContent(clearNames ? 'Ancient War Cemetery' : 'Eighth • Ancient War Cemetery');
    if (clearNames) expect(list).not.toHaveTextContent('Eighth');
  });
});
