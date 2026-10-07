import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { PLANET_SKIN_IDS } from '@astera/rules';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';
import { SkinInventoryContent } from '../src/screens/SkinInventoryScreen.js';
import { BUNDLE_PRICE, SHOPIER_LINKS, SKIN_PRICE, priceText } from '../src/lib/skinStore.js';

vi.mock('../src/screens/SkinPreview.js', () => ({
  SkinPreview: ({ skinId, status }: { skinId: string; status: string }) =>
    <div data-testid="preview">{skinId}:{status}</div>,
}));

beforeEach(async () => { await i18n.changeLanguage('en'); });

const collection = {
  ownedSkinIds: ['planet-lava', 'planet-ice'] as ('planet-lava' | 'planet-ice')[],
  planets: [
    { id: 'one', name: 'Orion', skinId: null },
    { id: 'two', name: 'Vega', skinId: 'planet-lava' as const },
  ],
};

/**
 * THE STORE SELLS (owner, 2026-09-25: "Bu sayfa şuanda tek para kaynağımız olacak"). ₺99 / $2.99
 * a look through Paddle, the four together for less, and only true
 * claims on the page — no invented counts, no invented scarcity.
 */
const prices = {
  'planet-lava': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-ice': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-toxic': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-desert': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-turkey': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-germany': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-france': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-spain': { formatted: '€2.99', currencyCode: 'EUR' },
  'planet-japan': { formatted: '€2.99', currencyCode: 'EUR' },
  bundle: { formatted: '€8.49', currencyCode: 'EUR' },
} as const;
const turkishPrices = { ...prices,
  'planet-lava': { formatted: '₺99.00', currencyCode: 'TRY' },
  'planet-ice': { formatted: '₺99.00', currencyCode: 'TRY' },
  'planet-toxic': { formatted: '₺99.00', currencyCode: 'TRY' },
  'planet-desert': { formatted: '₺99.00', currencyCode: 'TRY' },
  'planet-turkey': { formatted: '₺99.00', currencyCode: 'TRY' },
  bundle: { formatted: '₺279.00', currencyCode: 'TRY' },
} as const;
const none = { ownedSkinIds: [] as ('planet-lava' | 'planet-ice')[], planets: collection.planets };

describe('the skin store', () => {
  const shop = (over: Partial<Parameters<typeof SkinShopContent>[0]> = {}) => {
    const onOpenInventory = vi.fn();
    const onPurchase = vi.fn();
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={onOpenInventory}
      prices={prices} enabled onPurchase={onPurchase} {...over} />);
    return { onOpenInventory, onPurchase };
  };
  const card = (name: RegExp) => screen.getByRole('button', { name });

  it('lets the player inspect the actual look, and its shielded look', () => {
    shop();
    expect(screen.getByTestId('preview')).toHaveTextContent(/:NORMAL$/);
    for (const id of ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert']) {
      expect(screen.getByRole('img', { name: new RegExp(id.replace('planet-', ''), 'i') }))
        .toHaveAttribute('src', `/assets/images/skins/${id}.png`);
    }
    fireEvent.click(screen.getByRole('button', { name: /recovery shield/i }));
    expect(screen.getByTestId('preview')).toHaveTextContent(/:RECOVERY_SHIELD$/);
    expect(screen.queryByRole('button', { name: /apply to orion/i })).not.toBeInTheDocument();
  });

  it('opens on a look the player does not own yet', () => {
    shop();
    expect(screen.getByTestId('preview')).toHaveTextContent(/^planet-toxic:/);
  });

  it('separates elemental and country worlds into accessible tabs without mixing their offers', () => {
    shop({ collection: none });
    const elemental = screen.getByRole('tab', { name: /elemental worlds/i });
    const countries = screen.getByRole('tab', { name: /country worlds/i });
    expect(elemental).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('img', { name: /lava/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /turkey/i })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: i18n.t('skins.bundleTitle') })).toBeInTheDocument();

    fireEvent.click(countries);
    expect(countries).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('preview')).toHaveTextContent(/^planet-turkey:/);
    expect(screen.getByRole('img', { name: /turkey/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /spain/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /japan/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /lava/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: i18n.t('skins.bundleTitle') })).toBeNull();

    fireEvent.click(card(/germany/i));
    expect(screen.getByRole('button', { name: /buy.*€2\.99/i })).toBeEnabled();
  });

  it('prices each look the player lacks in the reader’s money, and marks the ones they own', async () => {
    shop();
    expect(card(/toxic/i)).toHaveTextContent('€2.99');
    expect(card(/desert/i)).toHaveTextContent('€2.99');
    expect(card(/lava/i)).toHaveTextContent(i18n.t('skins.owned'));
    await i18n.changeLanguage('tr');
    expect(card(/zehir/i)).toHaveTextContent('€2.99');
  });

  it('buys the selected live item through the authenticated checkout action', () => {
    const { onPurchase } = shop();
    fireEvent.click(card(/desert/i));
    fireEvent.click(screen.getByRole('button', { name: /buy.*€2\.99/i }));
    expect(onPurchase).toHaveBeenCalledWith('planet-desert');
  });

  it('sells Japan at the country price through the authenticated checkout action', () => {
    const { onPurchase } = shop({ collection: none });
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    fireEvent.click(card(/japan/i));
    expect(screen.getByTestId('preview')).toHaveTextContent(/^planet-japan:/);
    fireEvent.click(screen.getByRole('button', { name: /buy.*€2\.99/i }));
    expect(onPurchase).toHaveBeenCalledWith('planet-japan');
  });

  it('keeps the Paddle press waiting, not vanished, while its checkout is being created', () => {
    shop({ pending: true });
    expect(screen.getByRole('button', { name: /buy.*€2\.99/i })).toBeDisabled();
    expect(shopier()).toBeInTheDocument();
  });

  it('sends a look the player owns to the collection to put it on', () => {
    const { onOpenInventory } = shop();
    fireEvent.click(card(/lava/i));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('skins.wearIt') }));
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
  });

  it('offers the four together to a player who owns none, set against the four apart', () => {
    const { onPurchase } = shop({ collection: none });
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    expect(set).toHaveTextContent('€11.96');
    expect(set).toHaveTextContent('€8.49');
    expect(set).toHaveTextContent(i18n.t('skins.bundleSave', { pct: 29 }));
    const buy = within(set).getByRole('button', { name: /buy/i });
    fireEvent.click(buy);
    expect(onPurchase).toHaveBeenCalledWith('bundle');
  });

  it('offers no set to a player who already owns part of it', () => {
    shop();
    expect(screen.queryByRole('region', { name: i18n.t('skins.bundleTitle') })).toBeNull();
  });

  it('says what a look gives, and names the commander the purchase is granted to', () => {
    shop();
    for (const key of ['skins.valueSeen', 'skins.valueYours', 'skins.valueLooks'] as const) {
      expect(screen.getByText(i18n.t(key))).toBeInTheDocument();
    }
    expect(screen.getByText(i18n.t('skins.trust', { commander: 'Samet' }))).toBeInTheDocument();
  });

  it('states the service lifetime beside the price instead of promising permanent access', () => {
    shop({ collection: none });
    expect(screen.getAllByText(/while Astera Online operates/i)).toHaveLength(2);
    expect(screen.queryByText(/yours for good/i)).not.toBeInTheDocument();
  });

  /**
   * SHOPIER BESIDE PADDLE (owner 2026-09-27: "paddle'a alternatif ek olarak"). Shopier is a
   * page elsewhere that knows nothing of the account, so the look is granted by hand once the
   * order is seen — which is why the press always comes with the name to write in the order.
   */
  const shopierLabel = (amount: number) => i18n.t('skins.shopierBuy', { price: priceText(amount, 'TRY', 'en-US') });
  const shopier = (amount = SKIN_PRICE.TRY) => screen.getByRole('link', { name: shopierLabel(amount) });

  it('names Polar as the primary payment and groups Shopier with its manual delivery instructions', () => {
    const { onPurchase } = shop({ countryCode: 'TR', prices: turkishPrices });
    const primary = screen.getByRole('button', { name: /buy with polar.*₺99\.00/i });
    const alternative = screen.getByRole('region', { name: 'You can also pay with Shopier' });
    expect(within(alternative).getByRole('heading', { name: 'You can also pay with Shopier' })).toBeInTheDocument();
    expect(within(alternative).getByRole('link', { name: /pay with shopier/i })).toHaveAttribute('href', SHOPIER_LINKS['planet-toxic']);
    expect(alternative).toHaveTextContent(/manual/i);
    expect(alternative).toHaveTextContent('Samet');
    expect(primary.compareDocumentPosition(alternative) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(primary);
    expect(onPurchase).toHaveBeenCalledWith('planet-toxic');
  });

  it('keeps the bundle Polar payment ahead of a separate Shopier option at the bundle price', () => {
    shop({ collection: none, countryCode: 'TR', prices: turkishPrices });
    const bundle = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    const primary = within(bundle).getByRole('button', { name: /buy all four with polar.*₺279\.00/i });
    const alternative = within(bundle).getByRole('region', { name: 'You can also pay with Shopier' });
    expect(within(alternative).getByRole('link', { name: shopierLabel(BUNDLE_PRICE.TRY) })).toHaveAttribute('href', SHOPIER_LINKS.bundle);
    expect(alternative).toHaveTextContent(/manual/i);
    expect(primary.compareDocumentPosition(alternative) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('explains the alternate Shopier route in Turkish beside the Polar payment', async () => {
    await i18n.changeLanguage('tr');
    shop({ countryCode: 'TR', prices: turkishPrices });
    expect(screen.getByRole('button', { name: /polar ile satın al.*₺99\.00/i })).toBeEnabled();
    const alternative = screen.getByRole('region', { name: 'Shopier ile de ödeyebilirsiniz' });
    expect(within(alternative).getByRole('heading', { name: 'Shopier ile de ödeyebilirsiniz' })).toBeInTheDocument();
    expect(alternative).toHaveTextContent(/manuel/i);
    expect(alternative).toHaveTextContent('Samet');
  });

  it('links only TRY-eligible looks and the set to Shopier products', () => {
    expect(SHOPIER_LINKS).toEqual({
      'planet-lava': 'https://www.shopier.com/asteraonline/51278662',
      'planet-ice': 'https://www.shopier.com/asteraonline/51278677',
      'planet-toxic': 'https://www.shopier.com/asteraonline/51278683',
      'planet-desert': 'https://www.shopier.com/asteraonline/51278652',
      'planet-turkey': 'https://www.shopier.com/asteraonline/51278730',
      'planet-germany': null,
      'planet-france': null,
      'planet-spain': null,
      'planet-japan': null,
      bundle: 'https://www.shopier.com/asteraonline/51278911',
    });
    expect(Object.keys(SHOPIER_LINKS)).toEqual([...PLANET_SKIN_IDS, 'bundle']);
  });

  it('sells the desert look through Shopier too', () => {
    shop();
    fireEvent.click(card(/desert/i));
    expect(shopier()).toHaveAttribute('href', 'https://www.shopier.com/asteraonline/51278652');
  });

  it('offers Shopier beside Paddle for the selected look, in lira, in a new tab', () => {
    const { onPurchase } = shop();
    fireEvent.click(card(/toxic/i));
    const link = shopier();
    expect(link).toHaveAttribute('href', SHOPIER_LINKS['planet-toxic']);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('button', { name: /buy.*€2\.99/i })).toBeEnabled();
    fireEvent.click(link);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('offers Shopier for Turkey while keeping the other country worlds EUR-only', () => {
    shop({ collection: none, countryCode: 'TR', prices: turkishPrices });
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    expect(shopier()).toHaveAttribute('href', SHOPIER_LINKS['planet-turkey']);
    fireEvent.click(card(/germany/i));
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
  });

  it('tells the buyer to write the commander in the Shopier order, where the press is', () => {
    shop();
    expect(screen.getByText(i18n.t('skins.shopierNote', { commander: 'Samet' }))).toBeInTheDocument();
  });

  it('offers no Shopier page for a look already owned', () => {
    shop();
    fireEvent.click(card(/lava/i));
    expect(screen.queryByRole('link', { name: shopierLabel(SKIN_PRICE.TRY) })).toBeNull();
    expect(screen.queryByText(i18n.t('skins.shopierNote', { commander: 'Samet' }))).toBeNull();
    expect(screen.queryByRole('heading', { name: 'You can also pay with Shopier' })).toBeNull();
  });

  it('sells the set through Shopier too', () => {
    shop({ collection: none });
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    expect(within(set).getByRole('link', { name: shopierLabel(BUNDLE_PRICE.TRY) }))
      .toHaveAttribute('href', SHOPIER_LINKS.bundle);
    expect(within(set).getByRole('button', { name: /buy all four/i })).toBeEnabled();
  });

  it('makes Shopier the way to pay, in lira, while Paddle is closed', () => {
    shop({ enabled: false, prices: undefined, collection: none });
    expect(screen.queryByRole('button', { name: /^buy/i })).toBeNull();
    expect(shopier()).toHaveAttribute('href', SHOPIER_LINKS['planet-lava']);
    // Intl spaces "TRY 99" with a no-break space; the matcher reads the page's text collapsed.
    const lira = (amount: number) => priceText(amount, 'TRY', 'en-US').replace(/\s/g, ' ');
    expect(card(/toxic/i)).toHaveTextContent(lira(SKIN_PRICE.TRY));
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    expect(within(set).queryByRole('button', { name: /buy all four/i })).toBeNull();
    expect(within(set).getByRole('link', { name: shopierLabel(BUNDLE_PRICE.TRY) })).toBeInTheDocument();
    expect(set).toHaveTextContent(lira(SKIN_PRICE.TRY * 4));
    // A way to pay is open, so the page says what happens after paying.
    expect(screen.getByText(i18n.t('skins.trust', { commander: 'Samet' }))).toBeInTheDocument();
  });

  it('shows Turkish location prices even in English, with country skins still in euros', () => {
    shop({ collection: none, prices: turkishPrices });
    expect(card(/lava/i)).toHaveTextContent('₺99.00');
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    expect(card(/turkey/i)).toHaveTextContent('₺99.00');
    expect(card(/germany/i)).toHaveTextContent('€2.99');
  });

  it('does not offer a TRY-only Shopier checkout when the visitor sees EUR', () => {
    shop({ collection: none, countryCode: 'DE' });
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
    expect(screen.queryByRole('region', { name: 'You can also pay with Shopier' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
  });

  it('does not offer a TRY-only Shopier checkout for Germany even in Turkey', () => {
    shop({ collection: none, countryCode: 'TR', prices: turkishPrices });
    expect(screen.getAllByRole('link', { name: /shopier/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    fireEvent.click(card(/germany/i));
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
  });

  it('keeps every non-Turkey country look in EUR when location pricing is unavailable', () => {
    shop({ collection: none, prices: {}, enabled: false });
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    for (const name of ['Germany', 'France', 'Spain', 'Japan']) {
      fireEvent.click(card(new RegExp(name, 'i')));
      expect(screen.getByRole('button', { name: new RegExp(`${name}.*€2\\.99`, 'i') })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
    }
  });
});

/**
 * DRESSING A WORLD IS ONE TAP ON THAT WORLD (owner 2026-09-27: "giydirme ve çıkartma …
 * user friendly mi?"). Each world carries its own choices — the default and every owned look —
 * so there is no pick-above-then-scroll-to-apply, and the chip that is lit is what it wears.
 */
describe('skin inventory', () => {
  const inventory = (over: Partial<Parameters<typeof SkinInventoryContent>[0]> = {}) => {
    const onEquip = vi.fn();
    const onOpenShop = vi.fn();
    render(<SkinInventoryContent collection={collection} onEquip={onEquip} pending={null} failure={null}
      onOpenShop={onOpenShop} {...over} />);
    return { onEquip, onOpenShop };
  };
  const world = (name: string) => screen.getByRole('group', { name: i18n.t('skins.looksFor', { name }) });

  it('offers each world the default and the owned looks only', () => {
    inventory();
    const orion = world('Orion');
    expect(within(orion).getAllByRole('button').map((chip) => chip.getAttribute('aria-label'))).toEqual([
      i18n.t('skins.reset', { name: 'Orion' }),
      i18n.t('skins.wear', { look: i18n.t('skins.lava'), world: 'Orion' }),
      i18n.t('skins.wear', { look: i18n.t('skins.ice'), world: 'Orion' }),
    ]);
    expect(screen.getByText(`2/${String(PLANET_SKIN_IDS.length)}`)).toBeInTheDocument();
  });

  it('puts a look on a world in one tap', () => {
    const { onEquip } = inventory();
    fireEvent.click(within(world('Orion')).getByRole('button', { name: i18n.t('skins.wear', { look: i18n.t('skins.ice'), world: 'Orion' }) }));
    expect(onEquip).toHaveBeenCalledWith('one', 'planet-ice');
  });

  it('takes a look off with the default choice', () => {
    const { onEquip } = inventory();
    fireEvent.click(within(world('Vega')).getByRole('button', { name: i18n.t('skins.reset', { name: 'Vega' }) }));
    expect(onEquip).toHaveBeenCalledWith('two', null);
  });

  it('lights what each world wears and never sends it again', () => {
    const { onEquip } = inventory();
    const worn = within(world('Vega')).getByRole('button', { name: i18n.t('skins.wear', { look: i18n.t('skins.lava'), world: 'Vega' }) });
    expect(worn).toHaveAttribute('aria-pressed', 'true');
    expect(worn).toBeDisabled();
    const plain = within(world('Orion')).getByRole('button', { name: i18n.t('skins.reset', { name: 'Orion' }) });
    expect(plain).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(worn);
    fireEvent.click(plain);
    expect(onEquip).not.toHaveBeenCalled();
    expect(within(screen.getByRole('article', { name: 'Vega' })).getByText(i18n.t('skins.current', { name: i18n.t('skins.lava') })))
      .toBeInTheDocument();
  });

  it('holds every choice while one world is being dressed, and shows which', () => {
    const { onEquip } = inventory({ pending: { planetId: 'one', skinId: 'planet-ice' } });
    const saving = within(world('Orion')).getByRole('button', { name: i18n.t('skins.wear', { look: i18n.t('skins.ice'), world: 'Orion' }) });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    for (const chip of screen.getAllByRole('button', { name: /^(put|use default)/i })) expect(chip).toBeDisabled();
    fireEvent.click(within(world('Vega')).getByRole('button', { name: i18n.t('skins.reset', { name: 'Vega' }) }));
    expect(onEquip).not.toHaveBeenCalled();
  });

  it('says why a world could not be dressed, on that world', () => {
    inventory({ failure: { planetId: 'two', message: 'You do not control that world' } });
    expect(within(screen.getByRole('article', { name: 'Vega' })).getByRole('alert')).toHaveTextContent('You do not control that world');
    expect(within(screen.getByRole('article', { name: 'Orion' })).queryByRole('alert')).toBeNull();
  });

  it('sends a commander with nothing to wear to the shop', () => {
    const { onOpenShop } = inventory({ collection: { ownedSkinIds: [], planets: collection.planets } });
    expect(screen.getByText(i18n.t('skins.noOwnedSkins'))).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('skins.openShop') }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
  });

  it('says so when there is no world to dress', () => {
    inventory({ collection: { ownedSkinIds: ['planet-lava'], planets: [] } });
    expect(screen.getByText(i18n.t('skins.empty'))).toBeInTheDocument();
  });
});
