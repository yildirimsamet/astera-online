import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';
import { SkinInventoryContent } from '../src/screens/SkinInventoryScreen.js';

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

  it('keeps payment closed until live checkout is configured', () => {
    shop({ enabled: false });
    expect(screen.getByRole('button', { name: i18n.t('skins.onSaleSoon') })).toBeDisabled();
  });

  it('does not claim that payment opens while live checkout is disabled', () => {
    shop({ enabled: false });
    expect(screen.getByText(i18n.t('skins.trustSoon', { commander: 'Samet' }))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('skins.trust', { commander: 'Samet' }))).toBeNull();
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

  it('shows Turkish location prices even in English, with country skins still in euros', () => {
    shop({ collection: none, prices: turkishPrices });
    expect(card(/lava/i)).toHaveTextContent('₺99.00');
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    expect(card(/turkey/i)).toHaveTextContent('₺99.00');
    expect(card(/germany/i)).toHaveTextContent('€2.99');
  });
});

describe('skin inventory', () => {
  it('lists owned looks only and equips them per planet in inventory', () => {
    const equip = vi.fn();
    render(<SkinInventoryContent collection={collection} onEquip={equip} pendingPlanetId={null} onOpenShop={vi.fn()} />);
    const owned = screen.getByRole('region', { name: /owned skins/i });
    expect(within(owned).getByRole('img', { name: /lava/i })).toHaveAttribute('src', '/assets/images/skins/planet-lava.png');
    expect(within(owned).getByRole('img', { name: /ice/i })).toHaveAttribute('src', '/assets/images/skins/planet-ice.png');
    expect(within(owned).queryByRole('img', { name: /desert/i })).not.toBeInTheDocument();
    fireEvent.click(within(owned).getByRole('button', { name: /ice/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply to orion/i }));
    expect(equip).toHaveBeenCalledWith('one', 'planet-ice');
    fireEvent.click(screen.getByRole('button', { name: /use default on vega/i }));
    expect(equip).toHaveBeenCalledWith('two', null);
  });
});
