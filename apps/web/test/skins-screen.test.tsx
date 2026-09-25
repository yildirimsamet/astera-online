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
 * a look through a payment link the owner pastes in, the four together for less, and only true
 * claims on the page — no invented counts, no invented scarcity.
 */
const links = {
  'planet-lava': 'https://buy.example.com/lava?ref={commander}',
  'planet-ice': 'https://buy.example.com/ice?ref={commander}',
  'planet-toxic': 'https://buy.example.com/toxic?ref={commander}',
  'planet-desert': 'https://buy.example.com/desert?ref={commander}',
  bundle: 'https://buy.example.com/all?ref={commander}',
};
const none = { ownedSkinIds: [] as ('planet-lava' | 'planet-ice')[], planets: collection.planets };

describe('the skin store', () => {
  const shop = (over: Partial<Parameters<typeof SkinShopContent>[0]> = {}) => {
    const onOpenInventory = vi.fn();
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={onOpenInventory} checkout={links} {...over} />);
    return { onOpenInventory };
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

  it('prices each look the player lacks in the reader’s money, and marks the ones they own', async () => {
    shop();
    expect(card(/toxic/i)).toHaveTextContent('$2.99');
    expect(card(/desert/i)).toHaveTextContent('$2.99');
    expect(card(/lava/i)).toHaveTextContent(i18n.t('skins.owned'));
    await i18n.changeLanguage('tr');
    expect(card(/zehir/i)).toHaveTextContent('₺99');
  });

  it('buys through the look’s own link, with the commander on it, in a new tab', () => {
    shop();
    fireEvent.click(card(/desert/i));
    const buy = screen.getByRole('link', { name: /buy.*\$2\.99/i });
    expect(buy).toHaveAttribute('href', 'https://buy.example.com/desert?ref=Samet');
    expect(buy).toHaveAttribute('target', '_blank');
    expect(buy).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('says on sale very soon rather than offering a dead press, until a link is pasted', () => {
    shop({ checkout: { ...links, 'planet-toxic': '' } });
    expect(screen.queryByRole('link', { name: /buy/i })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('skins.onSaleSoon') })).toBeDisabled();
  });

  it('sends a look the player owns to the collection to put it on', () => {
    const { onOpenInventory } = shop();
    fireEvent.click(card(/lava/i));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('skins.wearIt') }));
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
  });

  it('offers the four together to a player who owns none, set against the four apart', () => {
    shop({ collection: none });
    const set = screen.getByRole('region', { name: i18n.t('skins.bundleTitle') });
    expect(set).toHaveTextContent('$11.96');
    expect(set).toHaveTextContent('$8.49');
    expect(set).toHaveTextContent(i18n.t('skins.bundleSave', { pct: 29 }));
    expect(within(set).getByRole('link', { name: /buy/i })).toHaveAttribute('href', 'https://buy.example.com/all?ref=Samet');
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
