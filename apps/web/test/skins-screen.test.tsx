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

describe('skin shop and inventory', () => {
  it('shows actual product images and inspection in the shop, without equipment controls', () => {
    render(<SkinShopContent collection={collection} onOpenInventory={vi.fn()} />);
    expect(screen.getByTestId('preview')).toHaveTextContent('planet-lava:NORMAL');
    for (const id of ['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert']) {
      expect(screen.getByRole('img', { name: new RegExp(id.replace('planet-', ''), 'i') }))
        .toHaveAttribute('src', `/assets/images/skins/${id}.png`);
    }
    fireEvent.click(screen.getByRole('button', { name: /recovery shield/i }));
    expect(screen.getByTestId('preview')).toHaveTextContent('planet-lava:RECOVERY_SHIELD');
    expect(screen.queryByRole('button', { name: /apply to orion/i })).not.toBeInTheDocument();
  });

  it('announces the unowned looks as coming soon, with no price or payment wording', async () => {
    for (const language of ['en', 'tr']) {
      await i18n.changeLanguage(language);
      const { container, unmount } = render(<SkinShopContent collection={collection} onOpenInventory={vi.fn()} />);
      const text = container.textContent;
      expect(text).not.toMatch(/₺|\bprice\b|fiyat|payment|ödeme/i);
      // Lava and Ice are owned; Toxic and Desert are the ones still on the way.
      expect(screen.getAllByText(i18n.t('skins.comingSoon'))).toHaveLength(2);
      expect(screen.getAllByText(i18n.t('skins.owned'))).toHaveLength(2);
      unmount();
    }
  });

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
