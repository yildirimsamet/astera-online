import { Capacitor, registerPlugin } from '@capacitor/core';
import type { UiScaleHost } from '../lib/uiScale.js';

/** `AsteraDisplayPlugin` in the Android shell: the phone's font size, 1 = normal. */
export interface DisplayPlugin {
  fontScale: () => Promise<{ value: number }>;
}

/**
 * Who may scale the page. A browser decides for itself; the Android app only when its shell
 * carries `AsteraDisplay`, which also opens the WebView's wide viewport and holds its text
 * zoom at 100 % — an older build would crop a scaled page, so it is told no.
 */
export function uiScaleHost(plugin?: DisplayPlugin): UiScaleHost {
  if (!Capacitor.isNativePlatform()) return {};
  if (!Capacitor.isPluginAvailable('AsteraDisplay')) return { supported: false };
  const display = plugin ?? registerPlugin<DisplayPlugin>('AsteraDisplay');
  return { systemFontScale: async () => (await display.fontScale()).value };
}
