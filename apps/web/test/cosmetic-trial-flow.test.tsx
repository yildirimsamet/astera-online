import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { GalaxyView as GalaxyData } from '../src/api/schemas.js';
import type { GalaxyCanvas } from '../src/galaxy/GalaxyCanvas.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { CosmeticTrialGallery, createCosmeticTrialClient } from '../src/v2/gallery/CosmeticTrialGallery.js';

vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: (props: Parameters<typeof GalaxyCanvas>[0]) =>
  <><output data-testid="worlds">{JSON.stringify(props.planets.map(world => ({ id: world.id, skin: world.skin?.id, ring: world.ringId })))}</output>
    <output data-testid="inspection">{props.inspectionPlanetId ?? 'none'}</output>
    <button onClick={() => { props.onFocus(null); }}>Clear map focus</button></>,
}));
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

it('tries a store ring on either owned world, compares, returns to the same product and restores live data on ownership loss', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(() => undefined));
  const api = new Api({ fetch });
  const client = createCosmeticTrialClient();
  render(<ApiProvider api={api}><ToastProvider><CosmeticTrialGallery client={client} /></ToastProvider></ApiProvider>);
  fireEvent.click(await screen.findByRole('button', { name: /^Planet rings/ }));
  fireEvent.click(screen.getByRole('button', { name: /Singularity/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Try on my world' }));
  const worlds = () => screen.getByTestId('worlds');
  await waitFor(() => { expect(worlds()).toHaveTextContent('ring-singularity'); });
  expect(screen.getByTestId('inspection')).toHaveTextContent('trial-home');
  fireEvent.change(screen.getByRole('combobox', { name: 'World to try on' }), { target: { value: 'trial-colony' } });
  expect(screen.getByTestId('inspection')).toHaveTextContent('trial-colony');
  expect(worlds().textContent).toBe('[{"id":"trial-home","skin":"planet-ice","ring":"ring-helios"},{"id":"trial-colony","skin":"planet-lava","ring":"ring-singularity"}]');
  fireEvent.click(screen.getByRole('button', { name: 'Show equipped look' }));
  expect(worlds()).not.toHaveTextContent('ring-singularity');
  fireEvent.click(screen.getByRole('button', { name: 'Show trial look' }));
  fireEvent.click(screen.getByRole('button', { name: 'Return to shop' }));
  expect(await screen.findByRole('button', { name: /^Planet rings/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Singularity' })).toBeInTheDocument();
  expect(worlds()).not.toHaveTextContent('ring-singularity');
  fireEvent.click(screen.getByRole('button', { name: 'Try on my world' }));
  await screen.findByRole('region', { name: 'Temporary trial' });
  const live = client.getQueryData<GalaxyData>(keys.galaxy)!;
  expect(live.planets.every(world => world.ringId === 'ring-helios')).toBe(true);
  act(() => { client.setQueryData(keys.galaxy, { ...live, planets: live.planets.map(world => ({ ...world, isOwned: false })) }); });
  await waitFor(() => { expect(screen.queryByRole('region', { name: 'Temporary trial' })).not.toBeInTheDocument(); });
  expect(worlds()).not.toHaveTextContent('ring-singularity');
  expect(fetch.mock.calls.every(args => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(args[1]?.method ?? 'GET'))).toBe(true);
});

it('ends a planet trial when resuming map interactions, and keeps the equipped ring throughout', async () => {
  const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
  render(<ApiProvider api={api}><ToastProvider><CosmeticTrialGallery /></ToastProvider></ApiProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Try on my world' }));
  await screen.findByRole('region', { name: 'Temporary trial' });
  expect(screen.getByTestId('worlds')).toHaveTextContent('planet-toxic');
  expect(screen.getByTestId('worlds')).toHaveTextContent('ring-helios');
  fireEvent.click(screen.getByRole('button', { name: 'Clear map focus' }));
  expect(screen.queryByRole('region', { name: 'Temporary trial' })).not.toBeInTheDocument();
  expect(screen.getByTestId('worlds')).toHaveTextContent('planet-ice');
});
