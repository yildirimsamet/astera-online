import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ApiError } from '../src/api/client.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';

vi.mock('../src/screens/SkinPreview.js', () => ({
  SkinPreview: ({ skinId, status }: { skinId: string; status: string }) => <div data-testid="preview">{skinId}:{status}</div>,
}));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { vi.restoreAllMocks(); });

const lira = { formatted: '₺99.00', currencyCode: 'TRY' } as const;
const turkishPrices = {
  'planet-lava': lira, 'planet-ice': lira, 'planet-toxic': lira, 'planet-desert': lira, 'planet-turkey': lira,
  'planet-germany': { formatted: '€2.99', currencyCode: 'EUR' }, 'planet-france': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-spain': { formatted: '€2.99', currencyCode: 'EUR' }, 'planet-japan': { formatted: '€2.99', currencyCode: 'EUR' },
  bundle: { formatted: '₺279.00', currencyCode: 'TRY' }, 'ring-aurora': { formatted: '₺49.00', currencyCode: 'TRY' },
} as const;
const shopierPrices = { 'planet-lava': 9900, 'planet-toxic': 9900, 'planet-desert': 9900, bundle: 27900, 'ring-aurora': 4900 };
const collection = { ownedSkinIds: ['planet-lava'] as 'planet-lava'[], planets: [{ id: 'one', name: 'Orion', skinId: null }] };
const none = { ownedSkinIds: [] as 'planet-lava'[], planets: collection.planets };

const link = (itemId: string) => `https://www.shopier.com/${itemId === 'bundle' ? '61000002' : '61000001'}`;
function shop(over: Partial<Parameters<typeof SkinShopContent>[0]> = {},
  requestCheckout = vi.fn((itemId: string) => Promise.resolve({ url: link(itemId) }))) {
  const onPurchase = vi.fn();
  render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} prices={turkishPrices}
    countryCode="TR" enabled onPurchase={onPurchase} shopier={{ prices: shopierPrices, requestCheckout }} {...over} />);
  return { onPurchase, requestCheckout };
}
const card = (name: RegExp) => screen.getByRole('button', { name });
const shopierPress = (price = '₺99') => screen.getByRole('button', { name: i18n.t('skins.shopierBuy', { price }) });

/**
 * SHOPIER FIRST IN TURKEY (owner 2026-10-16). Polar's fixed fee takes half of a ₺49–99 sale, so a
 * player paying in lira pays on Shopier. Shopier cannot know the commander, so the press opens
 * this commander's own hidden product (owner 2026-10-29): nothing to copy, nothing to write.
 */
describe('paying on Shopier through the commander\'s own page', () => {
  const panelName = () => i18n.t('skins.shopierPanelTitle');

  it('leads with Shopier in Turkey and keeps Polar as the quieter second way', () => {
    const { onPurchase } = shop();
    fireEvent.click(card(/toxic/i));
    const primary = shopierPress();
    const polar = screen.getByRole('button', { name: /buy with polar.*₺99\.00/i });
    expect(primary.compareDocumentPosition(polar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(polar);
    expect(onPurchase).toHaveBeenCalledWith('planet-toxic');
  });

  it('prepares the page, then offers one way forward: pay on Shopier in a new tab', async () => {
    let answer: (value: { url: string }) => void = () => undefined;
    const requestCheckout = vi.fn(() => new Promise<{ url: string }>(resolve => { answer = resolve; }));
    shop({}, requestCheckout);
    fireEvent.click(card(/toxic/i));
    fireEvent.click(shopierPress());
    expect(requestCheckout).toHaveBeenCalledWith('planet-toxic');
    expect(screen.getByRole('button', { name: i18n.t('skins.shopierPreparing') })).toBeDisabled();
    answer({ url: link('planet-toxic') });
    const panel = await screen.findByRole('region', { name: panelName() });
    // One golden way forward: once the page is ready, the first press steps back.
    expect(screen.getByRole('button', { name: i18n.t('skins.shopierReady') })).toBeDisabled();
    const go = within(panel).getByRole('link', { name: i18n.t('skins.shopierGo') });
    expect(go).toHaveAttribute('href', link('planet-toxic'));
    expect(go).toHaveAttribute('target', '_blank');
    expect(go).toHaveAttribute('rel', expect.stringContaining('noopener') as string);
    expect(panel).toHaveTextContent(i18n.t('skins.shopierWhy'));
    expect(panel).toHaveTextContent(i18n.t('skins.shopierWaiting'));
    expect(within(panel).queryByRole('button')).toBeNull();
    expect(panel).not.toHaveTextContent(/AST-|copy|paste/i);
  });

  it('swaps the page panel for the owned look once the payment lands', async () => {
    const requestCheckout = vi.fn(() => Promise.resolve({ url: link('planet-toxic') }));
    const props = { commander: 'Samet', onOpenInventory: vi.fn(), prices: turkishPrices, countryCode: 'TR', enabled: true,
      onPurchase: vi.fn(), shopier: { prices: shopierPrices, requestCheckout } };
    const { rerender } = render(<SkinShopContent collection={collection} {...props} />);
    fireEvent.click(card(/toxic/i));
    fireEvent.click(shopierPress());
    await screen.findByRole('region', { name: panelName() });
    rerender(<SkinShopContent collection={{ ...collection, ownedSkinIds: ['planet-lava', 'planet-toxic'] as 'planet-lava'[] }} {...props} />);
    expect(screen.queryByRole('region', { name: panelName() })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('skins.wearIt') })).toBeInTheDocument();
  });

  it('shows why the page could not be opened, and lets the press try again', async () => {
    const requestCheckout = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new ApiError('SHOPIER_UNAVAILABLE', 'diagnostic', 502)))
      .mockImplementationOnce(() => Promise.resolve({ url: link('planet-toxic') }));
    shop({}, requestCheckout);
    fireEvent.click(card(/toxic/i));
    fireEvent.click(shopierPress());
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.SHOPIER_UNAVAILABLE'));
    fireEvent.click(shopierPress());
    expect(await screen.findByRole('region', { name: panelName() })).toBeInTheDocument();
    expect(requestCheckout).toHaveBeenCalledTimes(2);
  });

  it('offers no Shopier press outside Turkey, for a look without a Shopier price, or when Shopier is closed', () => {
    const { unmount } = render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} enabled
      prices={{ ...turkishPrices, 'planet-toxic': { formatted: '€2.99', currencyCode: 'EUR' } }} countryCode="DE"
      shopier={{ prices: shopierPrices, requestCheckout: vi.fn() }} />);
    fireEvent.click(card(/toxic/i));
    expect(screen.queryByRole('button', { name: /shopier/i })).toBeNull();
    unmount();
    shop();
    fireEvent.click(card(/ice/i));
    expect(screen.queryByRole('button', { name: /shopier/i })).toBeNull();
    expect(screen.getByRole('button', { name: /buy with polar.*₺99\.00/i })).toBeEnabled();
  });

  it('keeps Polar first in Turkey when Shopier is not open', () => {
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} enabled
      prices={turkishPrices} countryCode="TR" />);
    fireEvent.click(card(/toxic/i));
    expect(screen.queryByRole('button', { name: /shopier/i })).toBeNull();
  });

  it('sells the set on Shopier at the set price', async () => {
    const { requestCheckout } = shop({ collection: none });
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    fireEvent.click(within(set).getByRole('button', { name: i18n.t('skins.shopierBuy', { price: '₺279' }) }));
    expect(requestCheckout).toHaveBeenCalledWith('bundle');
    expect(await within(set).findByRole('link', { name: i18n.t('skins.shopierGo') })).toHaveAttribute('href', link('bundle'));
    expect(within(set).getByRole('button', { name: /buy all four with polar.*₺279\.00/i })).toBeInTheDocument();
  });

  it('sells a ring on Shopier from its own category', async () => {
    const { requestCheckout } = shop();
    const categories = screen.getByRole('navigation', { name: i18n.t('skins.categories') });
    fireEvent.click(within(categories).getByRole('button', { name: new RegExp(`^${i18n.t('skins.categoryRING')}`) }));
    fireEvent.click(shopierPress('₺49'));
    expect(requestCheckout).toHaveBeenCalledWith('ring-aurora');
    expect(await screen.findByRole('link', { name: i18n.t('skins.shopierGo') })).toBeInTheDocument();
  });

  it('says in Turkish that nothing has to be written on Shopier', async () => {
    await i18n.changeLanguage('tr');
    shop();
    fireEvent.click(card(/zehir/i));
    fireEvent.click(screen.getByRole('button', { name: 'Shopier ile öde · ₺99' }));
    const panel = await screen.findByRole('region', { name: 'Sana özel ödeme sayfası' });
    expect(within(panel).getByRole('link', { name: "Shopier'de öde" })).toBeInTheDocument();
    expect(panel).toHaveTextContent(/not yazman gerekmez/i);
    expect(panel).toHaveTextContent(/48 saat/);
  });
});
