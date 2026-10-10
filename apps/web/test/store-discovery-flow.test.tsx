import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyCanvas } from '../src/galaxy/GalaxyCanvas.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { StoreDiscoveryGallery } from '../src/v2/gallery/StoreDiscoveryGallery.js';

vi.mock('../src/galaxy/GalaxyCanvas.js', () => ({ GalaxyCanvas: (props: Parameters<typeof GalaxyCanvas>[0]) =>
  <output data-testid="worlds">{JSON.stringify(props.planets.map(world => ({ id: world.id, skin: world.skin?.id, ring: world.ringId })))}</output>,
}));
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));
vi.mock('../src/lib/preload.js', () => ({ GALAXY_ASSETS: [], usePreload: () => ({ ready: true, progress: 1 }) }));
vi.mock('../src/lib/openingCover.js', () => ({ useOpeningCover: () => false }));

const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(() => undefined));
const originalUrl = window.location.href;
beforeEach(() => {
  fetch.mockClear();
  window.history.replaceState(null, '', '?view=store-discovery&panel=inventory');
});
afterEach(() => { window.history.replaceState(null, '', originalUrl); });

function show() {
  render(<ApiProvider api={new Api({ fetch })}><ToastProvider><StoreDiscoveryGallery /></ToastProvider></ApiProvider>);
}

it('changes either preview world, restores its default and updates the galaxy without reaching a server', async () => {
  show();
  const kestrel = within(await screen.findByRole('article', { name: 'Kestrel' }));
  const lava = kestrel.getByRole('button', { name: 'Put Lava on Kestrel' });
  fireEvent.click(lava);
  await waitFor(() => { expect(lava).toHaveAttribute('aria-pressed', 'true'); });
  expect(screen.getByTestId('worlds')).toHaveTextContent('"trial-home","skin":"planet-lava"');
  const vega = within(screen.getByRole('article', { name: 'Vega' }));
  fireEvent.click(vega.getByRole('button', { name: 'Put Ice on Vega' }));
  await waitFor(() => { expect(vega.getByRole('button', { name: 'Put Ice on Vega' })).toHaveAttribute('aria-pressed', 'true'); });
  fireEvent.click(kestrel.getByRole('button', { name: 'Use default on Kestrel' }));
  await waitFor(() => { expect(kestrel.getByRole('button', { name: 'Use default on Kestrel' })).toHaveAttribute('aria-pressed', 'true'); });
  expect(screen.getByTestId('worlds')).not.toHaveTextContent('"trial-home","skin":');
  expect(vega.getByRole('button', { name: 'Put Lava on Vega' })).toBeEnabled();
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

it('restores and equips an owned ring in the preview, then keeps inventory and store navigation usable', async () => {
  show();
  fireEvent.click(await screen.findByRole('button', { name: /^Planet rings/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore default' }));
  await waitFor(() => { expect(screen.getByRole('button', { name: 'Equip appearance' })).toBeEnabled(); });
  expect(screen.getByTestId('worlds')).not.toHaveTextContent('ring-helios');
  fireEvent.click(screen.getByRole('button', { name: 'Equip appearance' }));
  await waitFor(() => { expect(screen.getByRole('button', { name: 'Equipped' })).toBeDisabled(); });
  expect(screen.getByTestId('worlds')).toHaveTextContent('ring-helios');
  fireEvent.click(screen.getByRole('tab', { name: 'Shop' }));
  expect(await screen.findByRole('tab', { name: 'Shop' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('tab', { name: /^Inventory/ }));
  expect(await screen.findByRole('article', { name: 'Kestrel' })).toBeInTheDocument();
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

it('keeps keyboard focus on the selected tab when moving between the two screens', async () => {
  show();
  const inventory = await screen.findByRole('tab', { name: /^Inventory/ });
  inventory.focus();
  fireEvent.keyDown(inventory, { key: 'ArrowLeft' });
  await waitFor(() => { expect(screen.getByRole('tab', { name: 'Shop' })).toHaveFocus(); });
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Shop' }), { key: 'ArrowRight' });
  await waitFor(() => { expect(screen.getByRole('tab', { name: /^Inventory/ })).toHaveFocus(); });
});

it('keeps collection counts in their categories rather than showing a conflicting purchased-only total', async () => {
  show();
  expect(await screen.findByRole('tab', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: 'Planets 02' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Planet rings 01' })).toBeInTheDocument();
  const standards = screen.getByRole('button', { name: 'Clan standards 04' });
  fireEvent.click(standards);
  expect(screen.getByRole('button', { name: /^Bastion/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Meridian/ })).toBeInTheDocument();
});
