import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LandingScreen } from '../src/screens/LandingScreen.js';


/**
 * G13-c (2026-11-16): THE APP'S FRONT DOOR ON THE GAME KIT. The picture keeps the middle; the foot
 * holds the one lit press (training, or signing back in on
 * a device that has held a commander), the other door as steel or a quiet press, a refusal on a
 * kit banner, and the publisher's pages as quiet kit links.
 */

const OLD = /(^|\s)(text|bg|border|font|decoration|outline)-v2-|rounded-control|(^|\s)text-(micro|body|caption|label|title)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));

afterEach(() => { vi.unstubAllEnvs(); });

const show = (props: { known?: boolean; error?: string; fetch?: typeof globalThis.fetch } = {}) => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: props.fetch ?? vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(() => undefined)) });
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={queries}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  render(<LandingScreen onAuthenticate={vi.fn(() => Promise.resolve())} onBegin={vi.fn(() => Promise.resolve())} loadAsset={() => Promise.resolve()}
    knownCommander={() => props.known ?? false} {...(props.error === undefined ? {} : { error: props.error })} />, { wrapper });
  return document.querySelector('main')!;
};

describe('the app’s front door on the kit', () => {
  it('draws none of the old look and leads with one lit press', () => {
    const main = show();
    expect(main).toHaveClass('gk-frontdoor');
    expect(oldPaint(main)).toEqual([]);
    expect(screen.getByTestId('landing-primary')).toHaveClass('gk-btn', 'gk-btn--action', 'gk-btn--lg');
    expect(screen.getByRole('button', { name: /already have a commander/i })).toHaveClass('gk-btn--ghost');
    expect(screen.getByRole('combobox')).toHaveClass('gk-langselect');
  });

  it('gives a returning device the way back in lit and training as an equal steel door', () => {
    show({ known: true });
    expect(screen.getByTestId('landing-primary')).toHaveTextContent(/sign in/i);
    expect(screen.getByRole('button', { name: /start a new commander/i })).toHaveClass('gk-btn', 'gk-btn--lg');
    expect(screen.getByRole('button', { name: /start a new commander/i })).not.toHaveClass('gk-btn--action');
  });

  // Owner, 2026-11-28: no live count on the app's door, and no request for one.
  it('shows no live count and asks the API for none', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(() => undefined));
    const main = show({ fetch });
    await act(async () => { await Promise.resolve(); });
    expect(main.querySelector('.gk-frontdoor__people')).toBeNull();
    expect(fetch.mock.calls.map(([url]) => (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url)).filter((url) => url.includes('/api/servers'))).toEqual([]);
  });

  it('says a refusal on a kit banner', () => {
    show({ error: 'The galaxy could not be reached.' });
    expect(screen.getByRole('alert')).toHaveClass('gk-banner', 'gk-banner--hostile');
  });

  it('keeps the publisher’s pages as quiet kit links', () => {
    show({ known: true });
    const nav = screen.getByRole('navigation', { name: i18n.t('landing.publicLinksLabel') });
    expect(nav).toHaveClass('gk-frontdoor__links');
    expect(screen.getByRole('link', { name: 'Wiki' })).toHaveClass('gk-frontdoor__link');
  });
});
