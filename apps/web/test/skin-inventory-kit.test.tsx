import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { SkinInventoryContent } from '../src/screens/SkinInventoryScreen.js';

vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => <div /> }));
const { heard, buzz } = vi.hoisted(() => ({ heard: vi.fn(), buzz: vi.fn() }));
vi.mock('../src/lib/sound.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), playSound: heard }));
vi.mock('../src/lib/haptics.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), haptic: buzz }));

beforeEach(async () => { heard.mockClear(); buzz.mockClear(); await i18n.changeLanguage('en'); });

const V2_LOOK = /(^|\s)(text|bg|border|font|outline|decoration)-v2-|rounded-control|rounded-pill|(^|\s)text-(micro|body|caption|figure|dim)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

type Owned = ('planet-lava' | 'planet-ice')[];
const dressed = (vega: 'planet-lava' | 'planet-ice' | null) => ({
  ownedSkinIds: ['planet-lava', 'planet-ice'] as Owned,
  planets: [{ id: 'one', name: 'Orion', skinId: null }, { id: 'two', name: 'Vega', skinId: vega }],
});

function closet(over: Partial<Parameters<typeof SkinInventoryContent>[0]> = {}) {
  const onEquip = vi.fn();
  const onOpenShop = vi.fn();
  const view = render(<SkinInventoryContent collection={dressed('planet-lava')} onEquip={onEquip} pending={null} failure={null} onOpenShop={onOpenShop} {...over} />);
  const planets = (): HTMLElement => {
    const found = view.container.querySelector<HTMLElement>('.gk-closet');
    if (!found) throw new Error('the closet is not on the kit');
    return found;
  };
  return { onEquip, onOpenShop, planets, view };
}

/**
 * C36 (2026-11-16): THE INVENTORY ON THE KIT. "Which world wears which look?" Each world is a kit
 * plate carrying its own looks as kit chips: the worn one lit with a tick, a press answers at once,
 * and a look that lands is heard and felt. One tap still dresses, Default still undresses, and
 * every chip still waits while a world is being dressed.
 */
describe('the inventory on the kit', () => {
  it('draws the worlds in the kit with no old paint left', () => {
    const { planets } = closet();
    expect(planets().closest('.gk')).not.toBeNull();
    expect(oldPaint(planets())).toEqual([]);
  });

  it('counts the owned looks in glass on one line, the Store tab above being the way to more', () => {
    const { planets } = closet();
    const owned = within(planets()).getByRole('region', { name: i18n.t('skins.ownedSkins') });
    expect(owned).toHaveClass('gk-well');
    expect(owned).toHaveTextContent('2/9');
    expect(within(owned).queryByRole('button')).toBeNull();
  });

  it('puts each world on a kit plate with its looks as kit chips that answer the thumb', () => {
    const { onEquip } = closet();
    const orion = screen.getByRole('article', { name: 'Orion' });
    expect(orion).toHaveClass('gk-cut', 'gk-closet__world');
    const ice = within(orion).getByRole('button', { name: i18n.t('skins.wear', { look: i18n.t('skins.ice'), world: 'Orion' }) });
    expect(ice).toHaveClass('gk-closet__look');
    fireEvent.pointerDown(ice);
    fireEvent.click(ice);
    expect(heard).toHaveBeenCalledWith('tap');
    expect(buzz).toHaveBeenCalledWith('tap');
    expect(onEquip).toHaveBeenCalledWith('one', 'planet-ice');
  });

  it('is heard and felt when a look lands on a world, and quiet when nothing changed', () => {
    const { view } = closet();
    expect(heard).not.toHaveBeenCalled();
    view.rerender(<SkinInventoryContent collection={dressed('planet-ice')} onEquip={vi.fn()} pending={null} failure={null} onOpenShop={vi.fn()} />);
    expect(heard).toHaveBeenCalledWith('confirm');
    expect(buzz).toHaveBeenCalledWith('commit');
  });

  it('says why a world could not be dressed on a warning banner on that world', () => {
    closet({ failure: { planetId: 'two', message: 'You do not control that world' } });
    const alert = within(screen.getByRole('article', { name: 'Vega' })).getByRole('alert');
    expect(alert).toHaveClass('gk-banner', 'gk-banner--warn');
    expect(alert).toHaveTextContent('You do not control that world');
  });
});
