import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import SkinInventoryScreen from '../src/screens/SkinInventoryScreen.js';

vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));

it('sends the chosen world and skin, prevents duplicate clicks, refetches and marks only the changed world', async () => {
  let collection = {
    ownedSkinIds: ['planet-lava', 'planet-ice'],
    planets: [{ id: 'one', name: 'Kestrel', skinId: 'planet-ice' }, { id: 'two', name: 'Vega', skinId: 'planet-lava' }],
  };
  let finish: ((response: Response) => void) | undefined;
  const fetch = vi.fn<typeof globalThis.fetch>((url, options) => {
    if (options?.method === 'POST') return new Promise<Response>(resolve => { finish = resolve; });
    if (url === '/api/skins') return Promise.resolve(Response.json(collection));
    return Promise.reject(new Error('Unexpected inventory request'));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.skins, collection);
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <SkinInventoryScreen onOpenShop={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  const kestrel = within(screen.getByRole('article', { name: 'Kestrel' }));
  const lava = kestrel.getByRole('button', { name: 'Put Lava on Kestrel' });
  fireEvent.click(lava);
  await waitFor(() => { expect(lava).toHaveAttribute('aria-busy', 'true'); });
  fireEvent.click(lava);
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(fetch).toHaveBeenCalledWith('/api/skins/planets/one', expect.objectContaining({ method: 'POST', body: JSON.stringify({ skinId: 'planet-lava' }) }));
  collection = { ...collection, planets: collection.planets.map(world => world.id === 'one' ? { ...world, skinId: 'planet-lava' } : world) };
  finish?.(Response.json({ id: 'one', skinId: 'planet-lava' }));
  await waitFor(() => { expect(lava).toHaveAttribute('aria-pressed', 'true'); });
  expect(lava).toHaveAttribute('aria-busy', 'false');
  expect(kestrel.getByRole('button', { name: 'Put Ice on Kestrel' })).toBeEnabled();
  expect(within(screen.getByRole('article', { name: 'Vega' })).getByRole('button', { name: 'Put Lava on Vega' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps the equipped look on rejection, reports the reason on that world and allows retry', async () => {
  const collection = { ownedSkinIds: ['planet-lava', 'planet-ice'], planets: [{ id: 'one', name: 'Kestrel', skinId: 'planet-ice' }] };
  const fetch = vi.fn<typeof globalThis.fetch>((_url, options) => Promise.resolve(options?.method === 'POST'
    ? Response.json({ error: 'SKIN_NOT_OWNED', message: 'This skin is not owned' }, { status: 403 })
    : Response.json(collection)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.skins, collection);
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <SkinInventoryScreen onOpenShop={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  const kestrel = within(screen.getByRole('article', { name: 'Kestrel' }));
  const lava = kestrel.getByRole('button', { name: 'Put Lava on Kestrel' });
  fireEvent.click(lava);
  expect(await kestrel.findByRole('alert')).toHaveTextContent(i18n.t('errors.SKIN_NOT_OWNED'));
  expect(kestrel.getByRole('button', { name: 'Put Ice on Kestrel' })).toHaveAttribute('aria-pressed', 'true');
  expect(lava).toBeEnabled();
  fireEvent.click(lava);
  await waitFor(() => { expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2); });
});
