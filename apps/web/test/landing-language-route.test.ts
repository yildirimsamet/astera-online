import { afterEach, expect, it, vi } from 'vitest';
import { detectLanguage, LANGUAGES, LANGUAGE_STORAGE_KEY } from '../src/i18n/languages.js';
import { setLanguage } from '../src/i18n/document.js';
import { LANDING_COPY } from '../src/landing/public/content.js';

afterEach(() => { vi.unstubAllEnvs(); delete document.documentElement.dataset.publicSurface; window.history.replaceState(null, '', '/'); localStorage.removeItem(LANGUAGE_STORAGE_KEY); });
it('does not rewrite a bundled native app URL as a public website when changing language', async () => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  document.documentElement.dataset.publicSurface = '';
  document.title = 'Astera Online';
  window.history.replaceState(null, '', '/?security=email');
  await setLanguage('tr');
  expect(location.pathname + location.search).toBe('/?security=email');
  expect(document.title).toBe('Astera Online');
});
it('keeps a public language choice, visible metadata and share URL together while retaining recovery parameters', async () => {
  document.documentElement.dataset.publicSurface = '';
  document.head.innerHTML = '<title>Astera Online</title><link rel="canonical" href="https://asteraonline.space/"><meta name="description"><meta property="og:title"><meta property="og:description"><meta property="og:url">';
  window.history.replaceState(null, '', '/en/?security=email#start');
  await setLanguage('tr');
  expect(location.pathname + location.search + location.hash).toBe('/tr/?security=email#start');
  expect(document.title).toBe(LANDING_COPY.tr.title);
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://asteraonline.space/tr/');
  expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(LANDING_COPY.tr.description);
});
it.each(LANGUAGES)('honours an explicit /%s/ landing link before browser and saved preferences', language => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  window.history.replaceState(null, '', `/${language}/?campaign=first#start`);
  expect(detectLanguage({ language: 'de-DE', languages: ['de-DE'] })).toBe(language);
});
it('does not treat a Wiki route as a game language route', () => {
  window.history.replaceState(null, '', '/wiki/tr/fleet');
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  expect(detectLanguage({ language: 'tr', languages: ['tr'] })).toBe('en');
});
