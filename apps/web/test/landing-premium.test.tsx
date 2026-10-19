import { Suspense, use, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { LandingScreen } from '../src/screens/LandingScreen.js';

vi.mock('../src/landing/LandingScene.jsx', () => ({ LandingScene: () => <div data-testid="landing-scene" /> }));
afterEach(() => { vi.unstubAllEnvs(); });
function show() {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'web');
  const loadAsset = vi.fn(() => Promise.resolve());
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Offline fixture')) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  const tree = (waiting: boolean) => <Suspense fallback={<div data-loading-screen />}><LandingScreen onAuthenticate={vi.fn().mockResolvedValue(undefined)} onBegin={vi.fn().mockResolvedValue(undefined)} knownCommander={() => false} loadAsset={loadAsset} /><Pause waiting={waiting} /></Suspense>;
  const view = render(tree(false), { wrapper });
  return { loadAsset, ...view, suspend: () => { view.rerender(tree(true)); } };
}
const never = new Promise<void>(() => undefined);
function Pause({ waiting }: { waiting: boolean }) { if (waiting) use(never); return null; }
it('releases the public viewport when Suspense hides the page to load the game', async () => {
  const { suspend } = show();
  expect(document.documentElement).toHaveAttribute('data-public-surface');
  await act(async () => { suspend(); await Promise.resolve(); });
  expect(document.querySelector('[data-public-landing]')).not.toBeNull();
  expect(document.documentElement).not.toHaveAttribute('data-public-surface');
});
it('explains the actual game through visible semantic chapters before asking for an account', () => {
  const { container } = show();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.queryAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(5);
  for (const id of ['worlds', 'intelligence', 'fleet', 'clans', 'how-to-play']) expect(container.querySelector(`#${id}`)).not.toBeNull();
});
it('lets the web front door work without loading the WebGL scene or its game assets', () => {
  const { loadAsset } = show();
  expect(screen.queryByTestId('landing-scene')).not.toBeInTheDocument();
  expect(loadAsset).not.toHaveBeenCalled();
  expect(screen.getByTestId('landing-primary')).toBeEnabled();
});
