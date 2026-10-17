import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe.each(['android', 'ios'])('%s web service isolation', platform => {
  it('blocks every public web pricing/checkout endpoint before making a request', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    const fetcher = vi.fn<typeof fetch>();
    const api = new Api({ fetch: fetcher });
    for (const operation of [
      () => api.skinShop(), () => api.skinPricing(), () => api.purchaseSkin('planet-lava'),
      () => api.polarShop(), () => api.polarPricing(), () => api.purchasePolarSkin('planet-lava'),
      () => api.shopierShop(), () => api.shopierCode('planet-lava'),
    ]) await expect(operation()).rejects.toThrow(/checkout/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not initialise GA, track events or touch a preloaded H5 bridge', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    vi.stubEnv('VITE_GA_ID', 'G-NATIVE-TEST');
    vi.resetModules();
    const gtag = vi.fn(); const adConfig = vi.fn();
    window.gtag = gtag; window.adConfig = adConfig;
    const { startAnalytics, track, analyticsConfigured } = await import('../src/lib/analytics.js');
    const { configureH5Ads, syncH5Sound, resetH5AdsForTests } = await import('../src/lib/h5.js');
    startAnalytics(); track('login'); configureH5Ads(); syncH5Sound();
    expect(analyticsConfigured()).toBe(false);
    expect(gtag).not.toHaveBeenCalled(); expect(adConfig).not.toHaveBeenCalled();
    resetH5AdsForTests(); delete window.gtag; delete window.adConfig;
  });
});
