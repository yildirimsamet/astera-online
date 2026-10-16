import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';

vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));

beforeEach(async () => { await i18n.changeLanguage('en'); });

const collection = { ownedSkinIds: ['planet-lava' as const], planets: [] };
const prices = { 'planet-desert': { formatted: '€2.99', currencyCode: 'EUR' as const } };

/**
 * A LOOK WITH NO SHOPIER PRODUCT YET SAYS SO, rather than drawing a press that goes nowhere:
 * Polar alone while it is open, and "on sale soon" while it is closed.
 */
describe('a look without a Shopier product', () => {
  const pick = () => { fireEvent.click(screen.getByRole('button', { name: /desert/i })); };

  it('is sold through Polar alone, even in Turkey', () => {
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} prices={prices} enabled onPurchase={vi.fn()}
      countryCode="TR" shopier={{ prices: { 'planet-lava': 9900 }, requestCode: vi.fn() }} />);
    pick();
    expect(screen.queryByRole('button', { name: /shopier/i })).toBeNull();
    expect(screen.getByRole('button', { name: /buy.*€2\.99/i })).toBeEnabled();
  });

  it('is not yet for sale while Polar is closed', () => {
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} />);
    pick();
    expect(screen.queryByRole('button', { name: /shopier/i })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('skins.onSaleSoon') })).toBeDisabled();
    expect(screen.getByText(i18n.t('skins.trustSoon', { commander: 'Samet' }))).toBeInTheDocument();
  });
});
