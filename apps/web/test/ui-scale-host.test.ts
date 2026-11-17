import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiScaleHost, type DisplayPlugin } from '../src/platform/display.js';

/**
 * WHO MAY SCALE THE PAGE (owner 2026-11-17). A browser decides for itself (a touch screen);
 * the Android app only once its shell opens the WebView's wide viewport and reports the
 * phone's font size — an older build without it would crop a scaled page, so it is told no.
 */
afterEach(() => { vi.restoreAllMocks(); });

describe('the interface size’s host', () => {
  it('leaves a browser to decide for itself', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    expect(uiScaleHost()).toEqual({});
  });

  it('refuses an app shell that has no display plugin', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false);
    expect(uiScaleHost()).toEqual({ supported: false });
  });

  it('reads the phone’s font size from the shell that has one', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'isPluginAvailable').mockImplementation((name) => name === 'AsteraDisplay');
    const plugin: DisplayPlugin = { fontScale: vi.fn().mockResolvedValue({ value: 1.15 }) };
    const host = uiScaleHost(plugin);
    expect(host.supported).toBeUndefined();
    await expect(host.systemFontScale?.()).resolves.toBe(1.15);
  });
});
