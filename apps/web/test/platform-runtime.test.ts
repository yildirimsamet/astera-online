import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capabilities, resolveCapabilities, runtime } from '../src/platform/runtime.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('one platform boundary for web, PWA, Android and iOS', () => {
  it('keeps an installed PWA in the web platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    expect(runtime()).toBe('web');
    expect(capabilities()).toMatchObject({ pwaInstall: true, browserFullscreen: true, webCheckout: true, webAds: true, webAnalytics: true });
  });

  it.each(['android', 'ios'])('uses the real native bridge for %s, even with a web development build', platform => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    expect(runtime()).toBe(platform);
    expect(capabilities()).toMatchObject({ pwaInstall: false, browserFullscreen: false, webCheckout: false, webAds: false, webAnalytics: false });
  });

  it('fails closed for an unrecognised native runtime instead of treating it as a browser', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('future-platform');
    expect(runtime()).toBe('unsupported-native');
    expect(capabilities().webCheckout).toBe(false);
  });

  it.each(['native-local', 'native-staging', 'native-production'])('does not enable web services when a %s bundle opens in a browser', target => {
    expect(resolveCapabilities('web', target)).toMatchObject({ pwaInstall: false, browserFullscreen: false, webCheckout: false, webAds: false, webAnalytics: false });
  });

  it('does not enable store or advertising SDKs just because a native bridge exists', () => {
    for (const platform of ['web', 'android', 'ios', 'unsupported-native'] as const) {
      expect(resolveCapabilities(platform, 'native-production')).toMatchObject({ storeBilling: false, nativeRewardedAds: false, nativePush: false });
    }
  });

  it('opens the Notification Center and its free phone alerts in the Android app only (owner 2026-10-30)', () => {
    expect(resolveCapabilities('android', 'native-production')).toMatchObject({ notificationCenter: true, localNotifications: true });
    for (const platform of ['web', 'ios', 'unsupported-native'] as const) {
      expect(resolveCapabilities(platform, 'native-production').localNotifications).toBe(false);
    }
    for (const platform of ['web', 'ios', 'unsupported-native'] as const) {
      expect(resolveCapabilities(platform, 'native-production').notificationCenter).toBe(false);
    }
    expect(resolveCapabilities('web', 'web').notificationCenter).toBe(false);
  });

  it('does not open web services with an invalid build target', () => {
    expect(resolveCapabilities('web', 'typo')).toMatchObject({ webCheckout: false, webAds: false });
  });
});
