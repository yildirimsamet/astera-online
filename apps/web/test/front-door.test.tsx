import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LandingScreen } from '../src/screens/LandingScreen.js';
import { AuthDialog } from '../src/screens/LandingAuthDialog.js';
import { LoadingScreen } from '../src/shell/LoadingScreen.js';
import { FRONT_DOOR_ART, LOGO } from '../src/ui/assets.js';
import { LANDING_ASSETS } from '../src/lib/preload.js';
import { nativeStartupHtml } from '../nativeStartupPage.js';

/**
 * THE APP'S FRONT DOOR (owner, 2026-11-28): one painted key art that moves, the flat turquoise mark
 * over the wordmark, one lit press. The app icon and the system splash keep the astronaut; every
 * mark drawn inside the app is the flat one.
 */

const served = (url: string): string => resolve(process.cwd(), 'public', url.replace(/^\//, ''));

beforeEach(async () => { if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en'); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

const show = () => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(() => undefined)) });
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={queries}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  render(<LandingScreen onAuthenticate={vi.fn(() => Promise.resolve())} onBegin={vi.fn(() => Promise.resolve())}
    loadAsset={() => Promise.resolve()} knownCommander={() => false} />, { wrapper });
  return document.querySelector('main')!;
};

const layers = (): HTMLImageElement[] => [...document.querySelectorAll<HTMLImageElement>('.gk-frontdoor__art img')];

describe('the front door', () => {
  it('names the game with the flat mark and the wordmark, not the square artwork', () => {
    const main = show();
    const title = main.querySelector('h1')!;
    expect(title).toHaveAccessibleName('Astera Online');
    expect(title.querySelector('img')).toHaveAttribute('src', LOGO.mark);
    expect(title.querySelector('.gk-frontdoor__word svg')).not.toBeNull();
    expect(main.querySelector(`img[src="${LOGO.lockup}"]`)).toBeNull();
  });

  it('is one painted picture in layers, out of the reading order, with no 3D canvas', () => {
    const main = show();
    expect(layers().map((img) => img.getAttribute('src')).sort()).toEqual(Object.values(FRONT_DOOR_ART).sort());
    for (const img of layers()) expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(main.querySelector('canvas')).toBeNull();
  });

  it('waits for exactly the layers and the mark, all committed files', () => {
    expect(LANDING_ASSETS).toEqual([...Object.values(FRONT_DOOR_ART), LOGO.mark]);
    for (const url of LANDING_ASSETS) expect(existsSync(served(url)), url).toBe(true);
  });

  it.each(['load', 'error'] as const)('lifts the cover only once every layer settles, the last on %s', async (event) => {
    vi.useFakeTimers();
    show();
    await act(async () => { await Promise.resolve(); });
    const cover = (): Element | null => document.querySelector('[data-loading-screen]:not([data-departing="true"])');
    const [last, ...rest] = layers();
    act(() => { for (const img of rest) fireEvent.load(img); });
    expect(cover()).not.toBeNull();
    act(() => { fireEvent[event](last!); });
    expect(cover()).toBeNull();
  });
});

describe('the flat mark inside the app', () => {
  it('is the turquoise vector, and nothing else', () => {
    expect(LOGO.mark).toMatch(/logo-mark\.svg$/);
    const svg = readFileSync(served(LOGO.mark), 'utf8');
    expect([...svg.matchAll(/fill="([^"]+)"/g)].map((found) => found[1])).toEqual(['#0ce2ef']);
  });

  it('sits in the centre of the loading seal, drawn inline so the first frame has it', () => {
    render(<LoadingScreen caption="Preparing" />);
    expect(document.querySelector('.opening-stage svg.opening-mark path')).not.toBeNull();
  });

  it('heads the recovery page an old renderer is given', () => {
    expect(nativeStartupHtml()).toContain(`<img src="${LOGO.mark}"`);
  });
});

describe('the sign-in sheet', () => {
  const open = () => render(<AuthDialog onBegin={vi.fn()} onClose={vi.fn()} onSubmit={vi.fn(() => Promise.resolve())} />);

  it('opens under the mark', () => {
    open();
    expect(screen.getByRole('dialog').querySelector('.gk-authsheet__head img')).toHaveAttribute('src', LOGO.mark);
  });

  it('offers a forgotten password after the password it is about, before the sign-in press', () => {
    open();
    const follows = (a: Element, b: Element): boolean => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const password = screen.getByLabelText(i18n.t('landing.form.passwordLabel'));
    const forgot = screen.getByRole('button', { name: i18n.t('accountSecurity.forgot') });
    expect(follows(password, forgot)).toBe(true);
    expect(follows(forgot, screen.getByRole('button', { name: i18n.t('landing.form.submitLogin') }))).toBe(true);
  });
});

describe('the words at the door', () => {
  // The same line greets the app and the web, so it names neither.
  it.each(['en', 'tr', 'fr', 'de', 'es', 'ja'])('greets a returning commander without naming a browser in %s', async (language) => {
    await i18n.changeLanguage(language);
    expect(i18n.t('landing.returningHint')).not.toMatch(/browser|tarayıcı|navigateur|navegador|ブラウザ/i);
  });
});
