import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { CosmeticCategories, CosmeticCollection } from '../src/screens/CosmeticCollection.js';
import { CosmeticNavigation } from '../src/screens/CosmeticNavigation.js';
import { skins as tr } from '../src/i18n/locales/tr/skins.js';
import { skins as en } from '../src/i18n/locales/en/skins.js';
import { skins as de } from '../src/i18n/locales/de/skins.js';
import { skins as es } from '../src/i18n/locales/es/skins.js';
import { skins as fr } from '../src/i18n/locales/fr/skins.js';
import { skins as ja } from '../src/i18n/locales/ja/skins.js';

vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: ({ id }: { id: string }) => <div data-testid="cosmetic-preview">{id}</div> }));
const { heard, buzz } = vi.hoisted(() => ({ heard: vi.fn(), buzz: vi.fn() }));
vi.mock('../src/lib/sound.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), playSound: heard }));
vi.mock('../src/lib/haptics.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), haptic: buzz }));

beforeEach(async () => { heard.mockClear(); buzz.mockClear(); await i18n.changeLanguage('en'); });

const V2_LOOK = /(^|\s)(text|bg|border|font|from|via|to)-v2-|rounded-control|(^|\s)text-(micro|body|caption|figure|dim)(\s|$)|cosmetic-stage-glow|cosmetic-collection|cosmetic-navigation/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const wardrobe = (over: Partial<Parameters<typeof CosmeticCollection>[0]> = {}) => {
  const onEquip = vi.fn();
  const onOpenOther = vi.fn();
  const view = render(<CosmeticCollection category="RING" inventory owned={['ring-aurora']} equipment={{}} onOpenOther={onOpenOther} onEquip={onEquip} {...over} />);
  return { onEquip, onOpenOther, view };
};

/**
 * C37 (2026-11-16): THE COSMETIC SHELVES ON THE KIT. The store/inventory switch is the kit's tabs,
 * each category a plate with its own painting and count, every product a kit card that answers
 * the thumb, the stage a lit plate, and putting a look on is the kit's one lit press. What is
 * sold, owned, worn and who may wear a clan standard are unchanged.
 */
describe('the cosmetic shelves on the kit', () => {
  it('switches between the store and the inventory on the kit tabs', () => {
    const onInventory = vi.fn();
    render(<CosmeticNavigation active="shop" onShop={vi.fn()} onInventory={onInventory} />);
    const inventory = screen.getByRole('tab', { name: i18n.t('menu.skinsInventoryLabel') });
    expect(inventory).toHaveClass('gk-tab');
    expect(screen.getByRole('tab', { name: i18n.t('menu.skinsShopLabel') })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(inventory);
    expect(onInventory).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith('tab');
  });

  it('draws each category as a plate with its painting and count that answers the thumb', () => {
    const onChange = vi.fn();
    render(<CosmeticCategories active="PLANET" onChange={onChange} owned={[]} inventory={false} />);
    const nav = screen.getByRole('navigation', { name: i18n.t('skins.categories') });
    expect(oldPaint(nav)).toEqual([]);
    const rings = within(nav).getByRole('button', { name: /^planet rings/i });
    expect(rings).toHaveClass('gk-cosmo__cat');
    expect(rings.querySelector('img')).toHaveAttribute('src', expect.stringContaining('cos-ring'));
    fireEvent.pointerDown(rings);
    fireEvent.click(rings);
    expect(onChange).toHaveBeenCalledWith('RING');
    expect(heard).toHaveBeenCalledWith('tab');
    expect(within(nav).getByRole('button', { name: /^planets/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a product on a lit stage with kit cards and no old paint', () => {
    const { view } = wardrobe({ inventory: false, owned: [], prices: { 'ring-aurora': { formatted: '€1.49' } } });
    const shelf = view.container.querySelector('.gk-cosmo');
    if (!shelf) throw new Error('the shelf is not on the kit');
    expect(shelf.closest('.gk')).not.toBeNull();
    expect(oldPaint(shelf)).toEqual([]);
    expect(shelf.querySelector('.gk-cosmo__stage')).not.toBeNull();
    const helios = screen.getByRole('button', { name: /^helios/i });
    expect(helios).toHaveClass('gk-shop__card');
    fireEvent.pointerDown(helios);
    fireEvent.click(helios);
    expect(helios).toHaveAttribute('aria-pressed', 'true');
    expect(heard).toHaveBeenCalledWith('tap');
    expect(screen.getByTestId('cosmetic-preview')).toHaveTextContent('ring-helios');
  });

  it('puts a look on with the one lit press, and says when it is already worn', () => {
    const { onEquip } = wardrobe();
    const equip = screen.getByRole('button', { name: i18n.t('skins.equip') });
    expect(equip).toHaveClass('gk-btn', 'gk-btn--action');
    fireEvent.click(equip);
    expect(onEquip).toHaveBeenCalledWith('RING', 'ring-aurora');
    expect(screen.getByRole('button', { name: i18n.t('skins.restoreDefault') })).toBeDisabled();
  });

  it('is heard and felt when the look lands on the one being looked at', () => {
    const { view } = wardrobe();
    expect(heard).not.toHaveBeenCalledWith('confirm');
    view.rerender(<CosmeticCollection category="RING" inventory owned={['ring-aurora']} equipment={{ RING: 'ring-aurora' }} onOpenOther={vi.fn()} onEquip={vi.fn()} />);
    expect(heard).toHaveBeenCalledWith('confirm');
    expect(buzz).toHaveBeenCalledWith('commit');
  });

  it('takes a worn look off with the steel press', () => {
    const { onEquip } = wardrobe({ equipment: { RING: 'ring-aurora' } });
    expect(screen.getByRole('button', { name: i18n.t('skins.equipped') })).toBeDisabled();
    const restore = screen.getByRole('button', { name: i18n.t('skins.restoreDefault') });
    expect(restore).toHaveClass('gk-btn');
    expect(restore).not.toHaveClass('gk-btn--action');
    fireEvent.click(restore);
    expect(onEquip).toHaveBeenCalledWith('RING', null);
  });

  it('tells a commander who does not lead a clan why a standard cannot be worn, and a refusal on a banner', () => {
    wardrobe({ category: 'FLAG', owned: [], canEquipFlag: false, error: 'Refused' });
    expect(screen.getByText(i18n.t('skins.flagLeaderOnly')).closest('.gk-note')).not.toBeNull();
    expect(screen.getByRole('alert')).toHaveClass('gk-banner', 'gk-banner--warn');
  });

  it('sends an owned product in the store to the inventory on a kit press', () => {
    const { onOpenOther } = wardrobe({ inventory: false, owned: ['ring-aurora'] });
    const go = screen.getByRole('button', { name: i18n.t('menu.skinsInventoryLabel') });
    expect(go).toHaveClass('gk-btn--self');
    fireEvent.click(go);
    expect(onOpenOther).toHaveBeenCalledTimes(1);
  });

  it('keeps every word of the try-on strip\'s compare press short enough for its half of a phone (G6 close, 2026-11-16)', () => {
    for (const [lng, copy] of Object.entries({ tr, en, de, es, fr, ja })) {
      const words = copy.trialCompare.split(/\s+/);
      expect(words.filter((word) => word.length > 12), lng).toEqual([]);
    }
  });
});
