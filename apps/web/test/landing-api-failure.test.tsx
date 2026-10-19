import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';

vi.mock('../src/lib/music.js', () => ({ useAmbientMusic: () => undefined }));
vi.mock('../src/lib/sound.js', () => ({ useSoundEffects: () => undefined }));
vi.mock('../src/session/useEventStream.js', () => ({ useEventStream: () => undefined }));
vi.mock('../src/session/useLiveAlerts.js', () => ({ useLiveAlerts: () => undefined }));
vi.mock('../src/onboarding/Academy.jsx', () => ({ Academy: () => <main>Private Academy</main> }));

beforeEach(() => { window.sessionStorage.clear(); window.localStorage.clear(); vi.stubEnv('VITE_ASTERA_PLATFORM', 'web'); });
afterEach(() => { vi.unstubAllEnvs(); });

function show() {
  let offline = true;
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: offline ? 'UNREACHABLE' : 'UNAUTHENTICATED', message: 'Fixture' }), { status: offline ? 503 : 401 })));
  const api = new Api({ fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><App /></ApiProvider></QueryClientProvider>);
  return { fetch, recover: () => { offline = false; } };
}

it('keeps the web game explanation visible through a failed restore and a successful retry', async () => {
  const fixture = show();
  await screen.findByRole('button', { name: 'Try again' });
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  expect(document.querySelector('#worlds')).not.toBeNull();
  expect(document.documentElement).toHaveAttribute('data-public-surface');
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fixture.recover();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  await waitFor(() => { expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull(); });
  expect(screen.getByTestId('landing-primary')).toBeEnabled();
});

it('offers the existing account-free Academy after a cold API outage', async () => {
  show();
  await screen.findByRole('button', { name: 'Try again' });
  fireEvent.click(screen.getByTestId('landing-primary'));
  expect(await screen.findByText('Private Academy')).toBeInTheDocument();
  expect(document.documentElement).not.toHaveAttribute('data-public-surface');
});

it('keeps the compact native connection recovery screen', async () => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  show();
  await screen.findByRole('button', { name: 'Try again' });
  expect(document.querySelector('[data-public-landing]')).toBeNull();
});
