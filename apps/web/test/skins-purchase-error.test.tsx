import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import SkinsScreen from '../src/screens/SkinsScreen.js';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../src/lib/polarCheckout.js', () => ({ navigateToPolarCheckout: mocks.navigate }));
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div>Skin preview</div> }));
vi.mock('../src/api/queries.js', () => ({
  useSkins: () => ({ data: { ownedSkinIds: [], planets: [] }, isPending: false }),
  usePolarShop: () => ({ data: { enabled: true } }),
  usePolarPricing: () => ({ data: { prices: { 'planet-lava': { formatted: '€2.99', currencyCode: 'EUR', amount: 299 } } } }),
  usePurchasePolarSkin: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  mocks.mutateAsync.mockReset();
  mocks.navigate.mockReset();
});

describe('checkout failure', () => {
  it('shows a retryable error when the transaction cannot be created', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('Polar unavailable'));
    render(<SkinsScreen commander="Samet" onOpenInventory={vi.fn()} />);
    const buy = await screen.findByRole('button', { name: /Buy with Polar · €2\.99/i });
    fireEvent.click(buy);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/checkout could not start/i));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('opens the authenticated Polar checkout URL for the selected skin', async () => {
    mocks.mutateAsync.mockResolvedValueOnce({ checkoutId: '9a046305-84df-4892-8e1f-6869479b9783',
      url: 'https://sandbox.polar.sh/checkout/9a046305-84df-4892-8e1f-6869479b9783' });
    render(<SkinsScreen commander="Samet" onOpenInventory={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Buy with Polar · €2\.99/i }));
    await waitFor(() => { expect(mocks.mutateAsync).toHaveBeenCalledWith('planet-lava'); });
    expect(mocks.navigate).toHaveBeenCalledWith('https://sandbox.polar.sh/checkout/9a046305-84df-4892-8e1f-6869479b9783');
  });
});
