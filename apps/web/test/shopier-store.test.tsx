import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ApiError } from '../src/api/client.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';

vi.mock('../src/screens/SkinPreview.js', () => ({
  SkinPreview: ({ skinId, status }: { skinId: string; status: string }) => <div data-testid="preview">{skinId}:{status}</div>,
}));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));

const writeText = vi.fn((_text: string) => Promise.resolve());
beforeEach(async () => {
  await i18n.changeLanguage('en');
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
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

function shop(over: Partial<Parameters<typeof SkinShopContent>[0]> = {},
  requestCode = vi.fn((itemId: string) => Promise.resolve({ code: 'AST-7K3M9Q', url: `https://www.shopier.com/${itemId === 'bundle' ? '51278911' : '51278683'}` }))) {
  const onPurchase = vi.fn();
  render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} prices={turkishPrices}
    countryCode="TR" enabled onPurchase={onPurchase} shopier={{ prices: shopierPrices, requestCode }} {...over} />);
  return { onPurchase, requestCode };
}
const card = (name: RegExp) => screen.getByRole('button', { name });
const shopierPress = (price = '₺99') => screen.getByRole('button', { name: i18n.t('skins.shopierBuy', { price }) });

/**
 * SHOPIER FIRST IN TURKEY (owner 2026-10-16). Polar's fixed fee takes half of a ₺49–99 sale, so a
 * player paying in lira pays on Shopier. Shopier's page cannot know the commander: the store hands
 * a single-use code for the order note, and the server binds the paid order by it.
 */
describe('paying on Shopier with a purchase code', () => {
  it('leads with Shopier in Turkey and keeps Polar as the quieter second way', () => {
    const { onPurchase } = shop();
    fireEvent.click(card(/toxic/i));
    const primary = shopierPress();
    const polar = screen.getByRole('button', { name: /buy with polar.*₺99\.00/i });
    expect(primary.compareDocumentPosition(polar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(polar);
    expect(onPurchase).toHaveBeenCalledWith('planet-toxic');
  });

  it('hands the code with the steps, copies it, and opens the product in a new tab', async () => {
    const { requestCode } = shop();
    fireEvent.click(card(/toxic/i));
    fireEvent.click(shopierPress());
    expect(requestCode).toHaveBeenCalledWith('planet-toxic');
    const panel = await screen.findByRole('region', { name: i18n.t('skins.shopierCodeTitle') });
    expect(within(panel).getByText('AST-7K3M9Q')).toBeInTheDocument();
    // One golden way forward: once the code is out, the first press steps back.
    expect(screen.getByRole('button', { name: i18n.t('skins.shopierCodeReady') })).toBeDisabled();
    expect(panel).toHaveTextContent(i18n.t('skins.shopierStepPaste'));
    expect(panel).toHaveTextContent(i18n.t('skins.shopierStepPay'));
    expect(panel).toHaveTextContent(i18n.t('skins.shopierWhy'));
    fireEvent.click(within(panel).getByRole('button', { name: i18n.t('skins.shopierCopy') }));
    expect(writeText).toHaveBeenCalledWith('AST-7K3M9Q');
    expect(await within(panel).findByRole('button', { name: i18n.t('skins.shopierCopied') })).toBeInTheDocument();
    const go = within(panel).getByRole('link', { name: i18n.t('skins.shopierGo') });
    expect(go).toHaveAttribute('href', 'https://www.shopier.com/51278683');
    expect(go).toHaveAttribute('target', '_blank');
    expect(go).toHaveAttribute('rel', expect.stringContaining('noopener') as string);
    writeText.mockClear();
    fireEvent.click(go);
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith('AST-7K3M9Q'); });
    expect(panel).toHaveTextContent(i18n.t('skins.shopierWaiting'));
  });

  it('swaps the code panel for the owned look once the payment lands', async () => {
    const requestCode = vi.fn(() => Promise.resolve({ code: 'AST-7K3M9Q', url: 'https://www.shopier.com/51278683' }));
    const props = { commander: 'Samet', onOpenInventory: vi.fn(), prices: turkishPrices, countryCode: 'TR', enabled: true,
      onPurchase: vi.fn(), shopier: { prices: shopierPrices, requestCode } };
    const { rerender } = render(<SkinShopContent collection={collection} {...props} />);
    fireEvent.click(card(/toxic/i));
    fireEvent.click(shopierPress());
    await screen.findByRole('region', { name: i18n.t('skins.shopierCodeTitle') });
    rerender(<SkinShopContent collection={{ ...collection, ownedSkinIds: ['planet-lava', 'planet-toxic'] as 'planet-lava'[] }} {...props} />);
    expect(screen.queryByRole('region', { name: i18n.t('skins.shopierCodeTitle') })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('skins.wearIt') })).toBeInTheDocument();
  });

  it('shows why a code could not be issued', async () => {
    shop({}, vi.fn(() => Promise.reject(new ApiError('SKIN_ALREADY_OWNED', 'diagnostic', 409))));
    fireEvent.click(card(/toxic/i));
    fireEvent.click(shopierPress());
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('errors.SKIN_ALREADY_OWNED'));
  });

  it('offers no Shopier press outside Turkey, for a look without a Shopier product, or when Shopier is closed', () => {
    const { unmount } = render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} enabled
      prices={{ ...turkishPrices, 'planet-toxic': { formatted: '€2.99', currencyCode: 'EUR' } }} countryCode="DE"
      shopier={{ prices: shopierPrices, requestCode: vi.fn() }} />);
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
    expect(screen.queryByText(/order note/i)).toBeNull();
  });

  it('sells the set on Shopier at the set price', async () => {
    const { requestCode } = shop({ collection: none });
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    fireEvent.click(within(set).getByRole('button', { name: i18n.t('skins.shopierBuy', { price: '₺279' }) }));
    expect(requestCode).toHaveBeenCalledWith('bundle');
    expect(await within(set).findByText('AST-7K3M9Q')).toBeInTheDocument();
    expect(within(set).getByRole('button', { name: /buy all four with polar.*₺279\.00/i })).toBeInTheDocument();
  });

  it('sells a ring on Shopier from its own category', async () => {
    const { requestCode } = shop();
    const categories = screen.getByRole('navigation', { name: i18n.t('skins.categories') });
    fireEvent.click(within(categories).getByRole('button', { name: new RegExp(`^${i18n.t('skins.categoryRING')}`) }));
    fireEvent.click(shopierPress('₺49'));
    expect(requestCode).toHaveBeenCalledWith('ring-aurora');
    expect(await screen.findByText('AST-7K3M9Q')).toBeInTheDocument();
  });

  it('explains the code in Turkish', async () => {
    await i18n.changeLanguage('tr');
    shop();
    fireEvent.click(card(/zehir/i));
    fireEvent.click(screen.getByRole('button', { name: 'Shopier ile öde · ₺99' }));
    const panel = await screen.findByRole('region', { name: 'Ödeme kodun' });
    expect(panel).toHaveTextContent(/sipariş notu/i);
  });
});
