import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { CosmeticId } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import SkinsScreen from '../src/screens/SkinsScreen.js';

const navigation = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/polarCheckout.js', () => ({ navigateToPolarCheckout: navigation }));
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));

beforeEach(async () => { navigation.mockClear(); await i18n.changeLanguage('en'); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const pricing = { countryCode: 'DE', prices: {
  'planet-lava': { formatted: '€2.99', currencyCode: 'EUR', amount: 299 },
  'ship-red-dragon': { formatted: '€4.49', currencyCode: 'EUR', amount: 449 },
  'ship-shark': { formatted: '€5.99', currencyCode: 'EUR', amount: 599 },
  'ring-aurora': { formatted: '€3.49', currencyCode: 'EUR', amount: 349 },
  'ring-helios': { formatted: '€3.99', currencyCode: 'EUR', amount: 399 },
  'probe-ufo': { formatted: '€2.49', currencyCode: 'EUR', amount: 249 },
  'flag-vanguard': { formatted: '€99.00', currencyCode: 'EUR', amount: 9900 },
  'flag-helios': { formatted: '€7.99', currencyCode: 'EUR', amount: 799 },
} };

function show({ getPricing = () => Promise.resolve(response(pricing)),
  checkout = () => Promise.resolve(response({ checkoutId: '9a046305-84df-4892-8e1f-6869479b9783',
    url: 'https://sandbox.polar.sh/checkout/9a046305-84df-4892-8e1f-6869479b9783' })),
  initialId = 'ship-red-dragon', owned = [], enabled = true,
}: { getPricing?: () => Promise<Response>; checkout?: () => Promise<Response>;
  initialId?: CosmeticId; owned?: CosmeticId[]; enabled?: boolean } = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    const path = typeof input === 'string' ? new URL(input, 'http://localhost').pathname
      : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    if (path === '/api/skins/polar-shop') return Promise.resolve(response({ enabled }));
    if (path === '/api/skins/polar-pricing') return getPricing();
    if (path === '/api/skins/polar-purchase') return checkout();
    return Promise.reject(new Error('Unexpected store request'));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.skins, { ownedSkinIds: [], ownedCosmeticIds: owned, planets: [] }, { updatedAt: Date.now() + 86_400_000 });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <SkinsScreen commander="Orion" onOpenInventory={vi.fn()} initialId={initialId} />
  </ApiProvider></QueryClientProvider>);
  return { fetch };
}

it('lets customers compare server prices and hull compatibility on ship, ring and probe cards before selecting them', async () => {
  show();
  const dragon = await screen.findByRole('button', { name: /^Dragon.*€4.49/ });
  expect(dragon).toHaveTextContent('For Corsair');
  expect(screen.getByRole('button', { name: /^Whale.*€5.99/ })).toHaveTextContent('For Citadel');
  expect(screen.getByText('One payment · while Astera Online operates')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Planet rings/ }));
  expect(screen.getByRole('button', { name: /^Aurora.*€3.49/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Helios.*€3.99/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Probes/ }));
  expect(screen.getByRole('button', { name: /^UFO.*€2.49/ })).toBeInTheDocument();
});

it('keeps included and already owned standards distinct from paid products even if pricing contains a quote', async () => {
  show({ initialId: 'flag-helios', owned: ['flag-helios'] });
  await screen.findByRole('button', { name: 'Inventory' });
  expect(screen.getByRole('button', { name: /^Vanguard/ })).toHaveTextContent('Included');
  expect(screen.getByRole('button', { name: /^Solar Dynasty/ })).toHaveTextContent('Owned');
  expect(screen.queryByText('€99.00')).not.toBeInTheDocument();
  expect(screen.queryByText('€7.99')).not.toBeInTheDocument();
});

it('explains a pricing failure, retries only that read and restores the actual purchase without claiming a future launch', async () => {
  const getPricing = vi.fn(() => Promise.resolve(response(pricing)));
  getPricing.mockImplementationOnce(() => Promise.resolve(response({ error: 'UNREACHABLE', message: 'Internal diagnostic' }, 503)));
  const { fetch } = show({ getPricing });
  expect(await screen.findByRole('alert')).toHaveTextContent('Prices could not be loaded');
  expect(screen.queryByText('On sale very soon')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Buy with Polar/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry prices' }));
  expect(await screen.findByRole('button', { name: 'Buy with Polar · €4.49' })).toBeEnabled();
  expect(getPricing).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows loading while the price read is pending and enables checkout only after a valid quote arrives', async () => {
  let resolvePrice: ((value: Response) => void) | undefined;
  const read = new Promise<Response>(resolve => { resolvePrice = resolve; });
  show({ getPricing: () => read });
  expect(await screen.findByRole('status')).toHaveTextContent('Loading prices');
  expect(screen.getByRole('button', { name: 'Loading prices…' })).toBeDisabled();
  expect(screen.queryByText('On sale very soon')).not.toBeInTheDocument();
  resolvePrice?.(response(pricing));
  expect(await screen.findByRole('button', { name: 'Buy with Polar · €4.49' })).toBeEnabled();
});

it.each(['SKIN_ALREADY_OWNED', 'SKIN_SHOP_CLOSED', 'SKIN_CHECKOUT_IN_PROGRESS', 'SKIN_CHECKOUT_STARTING'] as const)(
  'explains %s beside the purchase and does not show that failure on another product', async code => {
    show({ checkout: () => Promise.resolve(response({ error: code, message: 'Private payment diagnostic' }, 409)) });
    fireEvent.click(await screen.findByRole('button', { name: 'Buy with Polar · €4.49' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(i18n.t(`errors.${code}`));
    expect(alert).not.toHaveTextContent('Private payment diagnostic');
    expect(navigation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Whale/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy with Polar · €5.99' })).toBeEnabled();
  },
);

it('creates one checkout on an immediate double press and shows progress until its URL is ready', async () => {
  let resolveCheckout: ((value: Response) => void) | undefined;
  const started = new Promise<Response>(resolve => { resolveCheckout = resolve; });
  const checkout = vi.fn(() => started);
  show({ checkout });
  const buy = await screen.findByRole('button', { name: 'Buy with Polar · €4.49' });
  fireEvent.click(buy);
  fireEvent.click(buy);
  await waitFor(() => { expect(checkout).toHaveBeenCalledTimes(1); });
  expect(screen.getByRole('button', { name: 'Opening checkout…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Opening checkout…' })).toHaveAttribute('aria-busy', 'true');
  resolveCheckout?.(response({ checkoutId: '9a046305-84df-4892-8e1f-6869479b9783',
    url: 'https://sandbox.polar.sh/checkout/9a046305-84df-4892-8e1f-6869479b9783' }));
  await waitFor(() => { expect(navigation).toHaveBeenCalledTimes(1); });
});

it('keeps the existing unavailable state when checkout is actually closed', async () => {
  show({ enabled: false });
  expect(await screen.findByRole('button', { name: 'On sale very soon' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Retry prices' })).not.toBeInTheDocument();
});

it('does not claim that planet sales have not opened when only the price read has failed', async () => {
  show({ initialId: 'planet-lava', getPricing: () => Promise.resolve(response({ error: 'POLAR_PRICING_UNAVAILABLE', message: 'Location unavailable' }, 502)) });
  expect(await screen.findByRole('alert')).toHaveTextContent('Prices could not be loaded');
  expect(screen.queryByText(/Sales have not opened yet/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Price unavailable' }).length).toBeGreaterThan(0);
});
