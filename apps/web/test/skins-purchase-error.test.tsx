import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import SkinsScreen from '../src/screens/SkinsScreen.js';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  checkoutOpen: vi.fn(),
  update: vi.fn(),
  customerId: '',
}));

vi.mock('@paddle/paddle-js', () => ({ initializePaddle: () => Promise.resolve({
  Checkout: { open: mocks.checkoutOpen }, Update: mocks.update,
}) }));
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => <div>Skin preview</div> }));
vi.mock('../src/api/queries.js', () => ({
  useSkins: () => ({ data: { ownedSkinIds: [], planets: [] }, isPending: false }),
  useSkinShop: () => ({ data: { enabled: true, clientToken: 'live_test', priceIds: {}, paddleCustomerId: mocks.customerId || null } }),
  useSkinPricing: () => ({ data: { prices: { 'planet-lava': { formatted: '€2.99', currencyCode: 'EUR' } } } }),
  usePurchaseSkin: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  mocks.mutateAsync.mockReset();
  mocks.checkoutOpen.mockReset();
  mocks.update.mockReset();
  mocks.customerId = '';
});

describe('checkout failure', () => {
  it('shows a retryable error when the transaction cannot be created', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('Paddle unavailable'));
    render(<SkinsScreen commander="Samet" onOpenInventory={vi.fn()} />);
    const buy = await screen.findByRole('button', { name: /Buy · €2\.99/i });
    fireEvent.click(buy);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/checkout could not start/i));
    expect(mocks.checkoutOpen).not.toHaveBeenCalled();
  });

  it('clears Retain identity when a different signed-in account has no Paddle customer', async () => {
    mocks.customerId = 'ctm_01m3fxlive000000000000000';
    const view = render(<SkinsScreen commander="First" onOpenInventory={vi.fn()} />);
    await waitFor(() => { expect(mocks.update).toHaveBeenCalledWith({ pwCustomer: { id: mocks.customerId } }); });
    mocks.customerId = '';
    view.rerender(<SkinsScreen commander="Second" onOpenInventory={vi.fn()} />);
    await waitFor(() => { expect(mocks.update).toHaveBeenLastCalledWith({ pwCustomer: {} }); });
  });
});
