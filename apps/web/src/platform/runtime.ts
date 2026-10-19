import { Capacitor } from '@capacitor/core';

export type Runtime = 'web' | 'android' | 'ios' | 'unsupported-native';

/** PWA display mode and user-agent never prove the presence of a native bridge. */
export function runtime(): Runtime {
  if (!Capacitor.isNativePlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' ? platform : 'unsupported-native';
}

/** Build/runtime disagreement closes optional services, not the game itself. */
export function resolveCapabilities(platform: Runtime, buildTarget: string) {
  const web = platform === 'web' && buildTarget === 'web';
  return {
    pwaInstall: web,
    browserFullscreen: web,
    webCheckout: web,
    webAds: web,
    webAnalytics: web,
    thirdPartyEmbeds: web,
    // A bridge alone does not mean these services have been integrated or configured.
    storeBilling: false,
    nativeRewardedAds: false,
    localNotifications: false,
    nativePush: false,
  };
}

/** Read on use so live-reload still honours its native host. Imports have no native calls. */
export const capabilities = () => resolveCapabilities(runtime(), import.meta.env.VITE_ASTERA_PLATFORM ?? 'web');
