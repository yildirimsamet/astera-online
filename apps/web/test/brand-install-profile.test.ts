import { afterEach, describe, expect, it } from 'vitest';
import { installProfile, isBraveBrowser } from '../src/brand/installProfile.js';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  iphoneTwitter: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.60',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  androidInstagram: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  windowsOpera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

afterEach(() => { Reflect.deleteProperty(window.navigator, 'brave'); });

describe('choosing which installation help to show', () => {
  it.each([
    ['iphone', 0, { kind: 'ios', os: 'ios', browser: 'safari' }],
    ['iphoneChrome', 0, { kind: 'ios', os: 'ios', browser: 'chrome' }],
    ['iphoneTwitter', 0, { kind: 'inApp', os: 'ios' }],
    ['macSafari', 5, { kind: 'ios', os: 'ios', browser: 'safari' }],
    ['macSafari', 0, { kind: 'desktop', os: 'mac', browser: 'safari' }],
    ['android', 0, { kind: 'android', os: 'android', browser: 'chrome' }],
    ['androidInstagram', 0, { kind: 'inApp', os: 'android' }],
    ['samsung', 0, { kind: 'android', browser: 'samsung' }],
    ['firefoxAndroid', 0, { kind: 'android', browser: 'firefox', firefoxVersion: 131 }],
    ['windowsChrome', 0, { kind: 'desktop', os: 'windows', browser: 'chrome' }],
    ['windowsEdge', 0, { kind: 'desktop', browser: 'edge' }],
    ['windowsOpera', 0, { kind: 'desktop', browser: 'opera' }],
    ['windowsFirefox', 0, { kind: 'desktop', os: 'windows', browser: 'firefox', firefoxVersion: 143 }],
    ['linuxFirefox', 0, { kind: 'desktop', os: 'linux', browser: 'firefox' }],
  ] as const)('reads %s (touch %i)', (name, touch, expected) => {
    expect(installProfile(UA[name], touch, undefined)).toMatchObject(expected);
  });

  it('prefers valid client hints, including a desktop-mode Android tablet and Brave', () => {
    expect(installProfile(UA.linuxChrome, 5, { platform: 'Android', brands: [] })).toMatchObject({ kind: 'android', os: 'android' });
    expect(installProfile(UA.windowsChrome, 0, { platform: 'Windows', brands: [{ brand: 'Brave', version: '130' }] })).toMatchObject({ browser: 'brave' });
  });

  it('ignores malformed client hints and falls back to the user agent', () => {
    expect(installProfile(UA.windowsChrome, 0, { platform: 7, brands: 'Brave' })).toMatchObject({ os: 'windows', browser: 'chrome' });
    expect(installProfile(UA.android, 0, null)).toMatchObject({ kind: 'android' });
  });

  it('accepts verified Brave even though its user agent is Chrome', () => {
    expect(installProfile(UA.windowsChrome, 0, undefined, true).browser).toBe('brave');
  });

  it('has no Firefox version for other browsers', () => {
    expect(installProfile(UA.windowsChrome, 0, undefined).firefoxVersion).toBeNull();
  });
});

describe('Brave identification', () => {
  const brave = (isBrave: unknown) => { Object.defineProperty(window.navigator, 'brave', { configurable: true, value: { isBrave } }); };

  it('is true only for the official API answering true', async () => {
    expect(await isBraveBrowser()).toBe(false);
    brave(() => Promise.resolve(true));
    expect(await isBraveBrowser()).toBe(true);
    brave(() => Promise.resolve('yes'));
    expect(await isBraveBrowser()).toBe(false);
    brave('not a function');
    expect(await isBraveBrowser()).toBe(false);
    brave(() => Promise.reject(new Error('blocked')));
    expect(await isBraveBrowser()).toBe(false);
  });
});
