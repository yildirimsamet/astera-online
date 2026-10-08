import { afterEach, describe, expect, it, vi } from 'vitest';
import { findsInstalledPwa, forgetInstalledPwa, INSTALLED_PWA_KEY, rememberInstalledPwa, remembersInstalledPwa, runningAsPwa } from '../src/brand/installedPwa.js';

const relatedApps = (answer: () => Promise<unknown>) => {
  Object.defineProperty(window.navigator, 'getInstalledRelatedApps', { configurable: true, value: answer });
};
const identity = `${window.location.origin}/`;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  Reflect.deleteProperty(window.navigator, 'getInstalledRelatedApps');
  Reflect.deleteProperty(window.navigator, 'standalone');
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('current installation proof', () => {
  it('recognises a standalone display or iOS standalone launch only', () => {
    expect(runningAsPwa()).toBe(false);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: query === '(display-mode: standalone)' }) });
    expect(runningAsPwa()).toBe(true);
    Reflect.deleteProperty(window, 'matchMedia');
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true });
    expect(runningAsPwa()).toBe(true);
  });
});

describe('remembered installation on this browser', () => {
  it('remembers and forgets a confirmed installation', () => {
    expect(remembersInstalledPwa()).toBe(false);
    rememberInstalledPwa();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBe('1');
    expect(remembersInstalledPwa()).toBe(true);
    forgetInstalledPwa();
    expect(remembersInstalledPwa()).toBe(false);
  });

  it('survives blocked storage without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => { rememberInstalledPwa(); forgetInstalledPwa(); }).not.toThrow();
    expect(remembersInstalledPwa()).toBe(false);
  });
});

describe('the related-app check', () => {
  it('is false when the browser has no API', async () => {
    expect(await findsInstalledPwa()).toBe(false);
  });

  it('matches this site by app ID or by one of its own language manifests', async () => {
    relatedApps(() => Promise.resolve([{ platform: 'webapp', id: identity, url: '/manifest.tr.webmanifest' }]));
    expect(await findsInstalledPwa()).toBe(true);
    relatedApps(() => Promise.resolve([{ platform: 'webapp', url: '/manifest.ja.webmanifest' }]));
    expect(await findsInstalledPwa()).toBe(true);
    relatedApps(() => Promise.resolve([{ platform: 'webapp', url: `${window.location.origin}/manifest.webmanifest`, version: '1' }]));
    expect(await findsInstalledPwa()).toBe(true);
  });

  it.each([
    ['another app ID', [{ platform: 'webapp', id: 'https://example.com/', url: '/manifest.webmanifest' }]],
    ['another origin', [{ platform: 'webapp', url: 'https://example.com/manifest.webmanifest' }]],
    ['another manifest', [{ platform: 'webapp', url: '/other.webmanifest' }]],
    ['a store app', [{ platform: 'play', id: 'com.astera', url: '/manifest.webmanifest' }]],
    ['an unparsable ID', [{ platform: 'webapp', id: 'http://[' }]],
    ['no ID or address', [{ platform: 'webapp' }]],
    ['an empty list', []],
    ['a malformed answer', { platform: 'webapp' }],
  ])('does not treat %s as proof', async (_name, answer) => {
    relatedApps(() => Promise.resolve(answer));
    expect(await findsInstalledPwa()).toBe(false);
  });

  it('is false when the API rejects', async () => {
    relatedApps(() => Promise.reject(new Error('not allowed')));
    expect(await findsInstalledPwa()).toBe(false);
  });
});
