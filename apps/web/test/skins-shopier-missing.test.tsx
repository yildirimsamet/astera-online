import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import type * as SkinStore from '../src/lib/skinStore.js';
import { SkinShopContent } from '../src/screens/SkinsScreen.js';

vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div /> }));
// A look added to the store before its Shopier product exists.
vi.mock('../src/lib/skinStore.js', async (original) => {
  const actual = await original<typeof SkinStore>();
  return { ...actual, SHOPIER_LINKS: { ...actual.SHOPIER_LINKS, 'planet-desert': null } };
});

beforeEach(async () => { await i18n.changeLanguage('en'); });

const collection = { ownedSkinIds: ['planet-lava' as const], planets: [] };
const prices = { 'planet-desert': { formatted: '€2.99', currencyCode: 'EUR' as const } };

/**
 * A LOOK WITH NO SHOPIER PAGE YET SAYS SO, rather than drawing a press that goes nowhere:
 * Paddle alone while it is open, and "on sale soon" while it is closed.
 */
describe('a look without a Shopier page', () => {
  const pick = () => { fireEvent.click(screen.getByRole('button', { name: /desert/i })); };

  it('is sold through Paddle alone', () => {
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} prices={prices} enabled onPurchase={vi.fn()} />);
    pick();
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
    expect(screen.queryByText(i18n.t('skins.shopierNote', { commander: 'Samet' }))).toBeNull();
    expect(screen.getByRole('button', { name: /buy.*€2\.99/i })).toBeEnabled();
  });

  it('is not yet for sale while Paddle is closed', () => {
    render(<SkinShopContent collection={collection} commander="Samet" onOpenInventory={vi.fn()} />);
    pick();
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
    expect(screen.getByRole('button', { name: i18n.t('skins.onSaleSoon') })).toBeDisabled();
    expect(screen.getByText(i18n.t('skins.trustSoon', { commander: 'Samet' }))).toBeInTheDocument();
  });
});
