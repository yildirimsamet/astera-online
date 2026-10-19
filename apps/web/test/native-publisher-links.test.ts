import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBLISHER_ORIGIN, publisherUrl } from '../src/lib/publisherPages.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('publisher pages are outside the bundled game', () => {
  it.each(['android', 'ios', 'unsupported-native'])('uses the canonical HTTPS publisher from %s', platform => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    expect(publisherUrl('privacy', 'tr-TR')).toBe(`${PUBLISHER_ORIGIN}/gizlilik-politikasi.html`);
    expect(publisherUrl('terms', 'en-GB')).toBe(`${PUBLISHER_ORIGIN}/terms.html`);
    expect(publisherUrl('kvkk', undefined)).toBe(`${PUBLISHER_ORIGIN}/kvkk-aydinlatma-metni.html`);
  });
  it.each(['native-local', 'native-staging', 'native-production'])('keeps the site external even when a %s bundle opens without a bridge', target => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', target);
    vi.stubEnv('VITE_ASTERA_API_URL', 'https://staging.example.test');
    expect(publisherUrl('contact', 'en')).toBe(`${PUBLISHER_ORIGIN}/contact.html`);
  });
  it('preserves same-origin web addresses for the existing publisher and sitemap contract', () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', 'web');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    expect(publisherUrl('privacy', 'tr')).toBe('/gizlilik-politikasi.html');
  });
});
