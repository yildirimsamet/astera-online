import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderLandingDocument } from '../landingPublication.js';
import { App } from '../src/App.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { rememberCommander } from '../src/lib/returning.js';

vi.mock('../src/lib/music.js', () => ({ useAmbientMusic: () => undefined }));
vi.mock('../src/lib/sound.js', () => ({ useSoundEffects: () => undefined }));
vi.mock('../src/session/useEventStream.js', () => ({ useEventStream: () => undefined }));
vi.mock('../src/session/useLiveAlerts.js', () => ({ useLiveAlerts: () => undefined }));
vi.mock('../src/screens/ServersScreen.jsx', () => ({ ServersScreen: () => <main>Choose your galaxy</main> }));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'web');
});
afterEach(() => {
  document.documentElement.removeAttribute('data-session-restoring');
  vi.unstubAllEnvs();
});

function show() {
  let answer: (response: Response) => void = () => undefined;
  const refresh = new Promise<Response>(resolve => { answer = resolve; });
  const me = { accountId: 'a1', username: 'vantage', displayName: 'Vantage', country: 'TR', placement: null, latestResult: null };
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(input => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    if (path.endsWith('/api/auth/refresh')) return refresh;
    if (path.endsWith('/api/auth/me')) return Promise.resolve(Response.json(me));
    return Promise.resolve(Response.json({ servers: [] }));
  });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={new Api({ fetch })}><App /></ApiProvider></QueryClientProvider>);
  return { answer, me };
}

it('shows loading throughout a returning commander restore, then opens their galaxy selection', async () => {
  rememberCommander();
  const { answer, me } = show();
  expect(document.querySelector('[data-public-landing]')).toBeNull();
  expect(document.querySelector('[data-loading-screen]')).not.toBeNull();
  act(() => {
    answer(Response.json({ ...me, accessToken: 'restored-token' }));
  });
  expect(await screen.findByText('Choose your galaxy')).toBeInTheDocument();
  expect(document.querySelector('[data-public-landing]')).toBeNull();
});

it('reveals the landing when a remembered commander has an expired or missing cookie', async () => {
  rememberCommander();
  const { answer } = show();
  expect(document.querySelector('[data-public-landing]')).toBeNull();
  act(() => { answer(Response.json({ error: 'NO_SESSION', message: 'Expired' }, { status: 401 })); });
  expect(await screen.findByTestId('landing-primary')).toBeInTheDocument();
});

it('keeps the immediate public introduction for a new visitor during restoration', () => {
  show();
  expect(document.querySelector('[data-public-landing]')).not.toBeNull();
});

const template = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
function published() {
  const html = renderLandingDocument(template, 'tr', '/tr/');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const script = doc.querySelector('head script[data-session-boot]');
  expect(script).not.toBeNull();
  expect(script?.getAttribute('nonce')).toBe('__CSP_NONCE__');
  return { html, doc, script: script?.textContent ?? '' };
}

it.each(['commander', 'cached game'])('hides the static landing before the bundle loads for a %s', source => {
  if (source === 'commander') rememberCommander();
  else window.sessionStorage.setItem('astera:ready-session', '{}');
  const { doc, script } = published();
  runInNewContext(script, { document: doc, localStorage: window.localStorage, sessionStorage: window.sessionStorage });
  expect(doc.documentElement.hasAttribute('data-session-restoring')).toBe(true);
  expect(doc.querySelector('style[data-session-boot]')?.textContent).toContain('[data-session-restoring] #root > [data-public-landing]{visibility:hidden}');
});

it('leaves the static introduction visible without a returning hint or with blocked storage', () => {
  const { doc, script } = published();
  runInNewContext(script, { document: doc, localStorage: window.localStorage, sessionStorage: window.sessionStorage });
  expect(doc.documentElement.hasAttribute('data-session-restoring')).toBe(false);
  const blocked = { getItem: () => { throw new Error('Storage blocked'); } };
  expect(() => { runInNewContext(script, { document: doc, localStorage: blocked, sessionStorage: blocked }); }).not.toThrow();
  expect(doc.documentElement.hasAttribute('data-session-restoring')).toBe(false);
});

it('retains exactly one startup guard when a compiled landing is localized again', () => {
  const { html } = published();
  const doc = new DOMParser().parseFromString(renderLandingDocument(html, 'en', '/en/'), 'text/html');
  expect(doc.querySelectorAll('head script[data-session-boot]')).toHaveLength(1);
  expect(doc.querySelectorAll('style[data-session-boot]')).toHaveLength(1);
});
