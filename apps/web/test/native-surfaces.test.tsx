import { Capacitor } from '@capacitor/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallButton, InstallProvider } from '../src/brand/Install.js';
import { BrandMasthead } from '../src/brand/Identity.js';
import { FullscreenButton } from '../src/brand/FullscreenButton.js';
import { ShopShowcase } from '../src/shell/ShopShowcase.js';
import SkinsScreen from '../src/screens/SkinsScreen.js';
import { DonateScreen } from '../src/screens/DonateScreen.js';
import { ConsentNotice } from '../src/shell/ConsentNotice.js';
import { CONSENT_EVENT } from '../src/lib/consent.js';

const mocks = vi.hoisted(() => ({
  webShop: vi.fn(() => ({ data: { enabled: true, prices: {} }, isPending: false })),
  collection: { ownedSkinIds: ['planet-lava'], planets: [{ id: 'p1', name: 'Home', skinId: null }] },
  equip: vi.fn(),
}));
vi.mock('../src/api/queries.js', () => ({
  useSkins: () => ({ data: mocks.collection, isPending: false }),
  useEquipSkin: () => ({ mutate: mocks.equip, isPending: false, isError: false }),
  useEquipCosmetic: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  usePolarShop: mocks.webShop,
  usePolarPricing: mocks.webShop,
  usePurchasePolarSkin: mocks.webShop,
  useShopierShop: mocks.webShop,
  useShopierCode: mocks.webShop,
}));
vi.mock('../src/screens/SkinPreview.js', () => ({ SkinPreview: () => null }));
vi.mock('../src/screens/CosmeticPreview.js', () => ({ CosmeticPreview: () => null }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe.each(['android', 'ios'])('%s native surfaces', platform => {
  function native() {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
  }

  it('mounts children without PWA listeners, related-app queries or install instructions', () => {
    native();
    const events = vi.spyOn(window, 'addEventListener');
    render(<InstallProvider><p>Game</p><InstallButton /></InstallProvider>);
    expect(screen.getByText('Game')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(events.mock.calls.map(([event]) => event)).not.toContain('beforeinstallprompt');
    expect(events.mock.calls.map(([event]) => event)).not.toContain('appinstalled');
    act(() => { window.dispatchEvent(new Event('beforeinstallprompt')); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('also suppresses a standalone InstallButton and fullscreen listeners', () => {
    native();
    const events = vi.spyOn(document, 'addEventListener');
    render(<><InstallButton /><FullscreenButton /><BrandMasthead onShop={vi.fn()} /></>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(events.mock.calls.map(([event]) => event)).not.toContain('fullscreenchange');
    expect(document.querySelector('.brand-masthead-actions')).toBeNull();
  });

  it('retains the inventory entrance without a shop promotion', () => {
    native();
    const inventory = vi.fn();
    render(<ShopShowcase onShop={vi.fn()} onInventory={inventory} />);
    expect(screen.queryByRole('button', { name: /^Shop\./ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Inventory\./ }));
    expect(inventory).toHaveBeenCalledOnce();
  });

  it('routes a stale shop entry to owned cosmetics without calling web purchase hooks', () => {
    native(); mocks.webShop.mockClear(); mocks.equip.mockClear();
    render(<SkinsScreen commander="Pilot" onOpenInventory={vi.fn()} />);
    expect(mocks.webShop).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /shop|buy|Polar|Shopier/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Shop' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Put Lava on Home' }));
    expect(mocks.equip).toHaveBeenCalledWith({ planetId: 'p1', skinId: 'planet-lava' });
  });

  it('never renders external support payments or web consent, even on explicit reopen', () => {
    native();
    render(<><DonateScreen /><ConsentNotice /></>);
    act(() => { window.dispatchEvent(new Event(CONSENT_EVENT)); });
    expect(document.querySelector('a[href*="shopier"]')).toBeNull();
    expect(document.querySelector('[data-consent-notice]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
