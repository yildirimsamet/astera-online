import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';

vi.mock('../src/screens/SkinPreview.js', () => ({
  SkinPreview: ({ skinId, status }: { skinId: string; status: string }) => <div data-testid="preview">{skinId}:{status}</div>,
}));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));
const { heard, buzz } = vi.hoisted(() => ({ heard: vi.fn(), buzz: vi.fn() }));
vi.mock('../src/lib/sound.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), playSound: heard }));
vi.mock('../src/lib/haptics.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), haptic: buzz }));

beforeEach(async () => { heard.mockClear(); buzz.mockClear(); await i18n.changeLanguage('en'); });

const V2_LOOK = /(^|\s)(text|bg|border|font|from|via|to)-v2-|rounded-control|rounded-cell|(^|\s)text-(micro|body|caption|figure|dim)(\s|$)|v2-store-(shimmer|chosen)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const euro = { formatted: '€2.99', currencyCode: 'EUR' } as const;
const prices = {
  'planet-lava': euro, 'planet-ice': euro, 'planet-toxic': euro, 'planet-desert': euro, 'planet-turkey': euro,
  'planet-germany': euro, 'planet-france': euro, 'planet-spain': euro, 'planet-japan': euro,
  bundle: { formatted: '€8.49', currencyCode: 'EUR' }, 'ring-aurora': { formatted: '€1.49', currencyCode: 'EUR' },
} as const;
const none = { ownedSkinIds: [] as 'planet-lava'[], planets: [] };
const lava = { ownedSkinIds: ['planet-lava'] as 'planet-lava'[], planets: [] };

function shop(over: Partial<Parameters<typeof SkinShopContent>[0]> = {}) {
  const onPurchase = vi.fn();
  const onOpenInventory = vi.fn();
  const view = render(<SkinShopContent collection={none} commander="Samet" onOpenInventory={onOpenInventory} prices={prices} enabled onPurchase={onPurchase} {...over} />);
  const planets = (): Element => {
    const found = view.container.querySelector('.gk-shop');
    if (!found) throw new Error('the planet store is not on the kit');
    return found;
  };
  return { onPurchase, onOpenInventory, planets };
}

/**
 * C35 (2026-11-16): THE STORE ON THE KIT. "Which look, for how much?" The look still turns in its
 * own living light; around it the collections are the kit's tabs, the two looks of a world the
 * kit's choice plates, the price on a gold plate over one lit press, every card a kit card that
 * answers the thumb, the set on its own gold plate, and a refusal on a banner. Prices, the Polar
 * and Shopier order and what the server is asked are unchanged.
 */
describe('the store on the kit', () => {
  it('draws the planet store in the kit with no old paint left', () => {
    const { planets } = shop();
    expect(planets().closest('.gk')).not.toBeNull();
    expect(oldPaint(planets())).toEqual([]);
  });

  it('puts the two collections on kit tabs and counts what is owned beside the collection', () => {
    const { planets } = shop({ collection: lava });
    const elemental = screen.getByRole('tab', { name: /elemental worlds/i });
    expect(elemental).toHaveClass('gk-tab');
    expect(elemental).toHaveAttribute('aria-selected', 'true');
    const cards = within(planets()).getByRole('region', { name: i18n.t('skins.collection') });
    expect(cards).toHaveTextContent(`1/4 ${i18n.t('skins.collected')}`);
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    expect(heard).toHaveBeenCalledWith('tab');
    expect(within(planets()).getByRole('region', { name: i18n.t('skins.collection') })).toHaveTextContent(`0/5 ${i18n.t('skins.collected')}`);
  });

  it('turns the world between its two looks on the kit choice plates', () => {
    shop();
    const shielded = screen.getByRole('radio', { name: i18n.t('skins.recovery') });
    fireEvent.click(shielded);
    expect(shielded).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('preview')).toHaveTextContent(/:RECOVERY_SHIELD$/);
  });

  it('prices the look on a gold plate over one lit press, and an owned look goes to be worn', () => {
    const { onOpenInventory } = shop({ collection: lava });
    const plate = screen.getByRole('region', { name: i18n.t('skins.priceTitle') });
    expect(plate).toHaveClass('gk-cut', 'gk-shop__price');
    expect(within(plate).getByRole('button', { name: /buy with polar.*€2\.99/i })).toHaveClass('gk-btn', 'gk-btn--action');
    fireEvent.click(screen.getByRole('button', { name: /^lava/i }));
    const wear = within(plate).getByRole('button', { name: i18n.t('skins.wearIt') });
    expect(wear).toHaveClass('gk-btn--self');
    fireEvent.click(wear);
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
  });

  it('says why a look cannot be bought yet on the press itself', () => {
    shop({ enabled: false, prices: {} });
    const plate = screen.getByRole('region', { name: i18n.t('skins.priceTitle') });
    expect(within(plate).getByRole('button', { name: i18n.t('skins.onSaleSoon') })).toBeDisabled();
  });

  it('makes every look a kit card that answers the thumb and lights the chosen one', () => {
    shop();
    const desert = screen.getByRole('button', { name: /^desert/i });
    expect(desert).toHaveClass('gk-shop__card');
    fireEvent.pointerDown(desert);
    fireEvent.click(desert);
    expect(desert).toHaveAttribute('aria-pressed', 'true');
    expect(heard).toHaveBeenCalledWith('tap');
    expect(buzz).toHaveBeenCalledWith('tap');
    expect(screen.getByTestId('preview')).toHaveTextContent(/^planet-desert:/);
  });

  it('offers the set on a gold plate with its saving and the kit press', () => {
    const { onPurchase } = shop();
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    expect(set).toHaveClass('gk-cut', 'gk-shop__bundle');
    const buy = within(set).getByRole('button', { name: /buy/i });
    expect(buy).toHaveClass('gk-btn--action');
    fireEvent.click(buy);
    expect(onPurchase).toHaveBeenCalledWith('bundle');
  });

  it('keeps Polar the quiet second way in Turkey under the Shopier press', () => {
    shop({ countryCode: 'TR', shopier: { prices: { 'planet-lava': 9900, bundle: 27900 }, requestCheckout: vi.fn() } });
    const plate = screen.getByRole('region', { name: i18n.t('skins.priceTitle') });
    expect(within(plate).getByRole('button', { name: i18n.t('skins.shopierBuy', { price: '₺99' }) })).toHaveClass('gk-btn--action');
    expect(screen.getByRole('button', { name: /buy with polar.*€2\.99/i })).toHaveClass('gk-btn--ghost');
  });

  it('says a refused checkout on a warning banner, and a price that would not load on one with a retry', () => {
    const onRetryPricing = vi.fn();
    shop({ purchaseError: { itemId: 'planet-lava', message: 'No checkout' } });
    expect(screen.getByRole('alert')).toHaveClass('gk-banner', 'gk-banner--warn');
    render(<SkinShopContent collection={none} commander="Samet" onOpenInventory={vi.fn()} enabled pricingState="error" onRetryPricing={onRetryPricing} />);
    const failed = screen.getAllByRole('alert').find((node) => node.textContent.includes(i18n.t('skins.pricingError')));
    expect(failed).toHaveClass('gk-banner--warn');
    if (!failed) throw new Error('no pricing banner');
    fireEvent.click(within(failed).getByRole('button', { name: i18n.t('skins.retryPrices') }));
    expect(onRetryPricing).toHaveBeenCalledTimes(1);
  });

  it('sells a look from another category on the kit press', () => {
    shop({ initialId: 'ring-aurora' });
    expect(screen.getByRole('button', { name: /buy with polar.*€1\.49/i })).toHaveClass('gk-btn', 'gk-btn--action');
  });
});
