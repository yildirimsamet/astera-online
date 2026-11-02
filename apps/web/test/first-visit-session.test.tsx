import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useSession } from '../src/session/useSession.js';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '/'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function show() {
  let answer: (response: Response) => void = () => undefined;
  const refresh = new Promise<Response>(resolve => { answer = resolve; });
  const me = { accountId: 'a1', username: 'vantage', displayName: 'Vantage', country: 'TR', placement: null, latestResult: null };
  const fetch = vi.fn<typeof globalThis.fetch>(input => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    if (path.endsWith('/api/auth/refresh')) return refresh;
    if (path.endsWith('/api/auth/me')) return Promise.resolve(Response.json(me));
    throw new Error('Unexpected network request: ' + path);
  });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch });
  const wrapper = ({ children }: { children: ReactNode }) => <StrictMode><QueryClientProvider client={queries}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider></StrictMode>;
  const hook = renderHook(() => useSession({ autoTraining: true }), { wrapper });
  return { ...hook, answer, me, fetch };
}

it('starts first-visit training immediately while the cookie check is still pending', async () => {
  const { result, answer, fetch } = show();
  expect(result.current.session.phase).toBe('rehearsing');
  await act(async () => { answer(Response.json({}, { status: 401 })); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('rehearsing');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('restores a real existing account even if this browser has no commander hint', async () => {
  const { result, answer, me } = show();
  expect(result.current.session.phase).toBe('rehearsing');
  act(() => { answer(Response.json({ ...me, accessToken: 'restored' })); });
  await waitFor(() => { expect(result.current.session.phase).toBe('servers'); });
});

it('keeps a known commander on restoration and sign-in rather than restarting training', async () => {
  localStorage.setItem('astera.commander', '1');
  const { result, answer } = show();
  expect(result.current.session.phase).toBe('starting');
  await act(async () => { answer(Response.json({}, { status: 401 })); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('landing');
});

it('does not let a failed background restoration replace the playable local training', async () => {
  const { result, answer } = show();
  await act(async () => { answer(Response.json({}, { status: 503 })); await Promise.resolve(); });
  expect(result.current.session.phase).toBe('rehearsing');
});

it('honors leaving training, including a late restoration response and a fresh page mount', async () => {
  const first = show();
  act(() => { first.result.current.leaveRehearsal(); });
  expect(first.result.current.session.phase).toBe('landing');
  await act(async () => { first.answer(Response.json({}, { status: 503 })); await Promise.resolve(); });
  expect(first.result.current.session.phase).toBe('landing');
  first.unmount();
  const next = show();
  await act(async () => { next.answer(Response.json({}, { status: 401 })); await Promise.resolve(); });
  expect(next.result.current.session.phase).toBe('landing');
  await act(async () => { await next.result.current.rehearse(); });
  expect(next.result.current.session.phase).toBe('rehearsing');
});

it('keeps the existing-player sign-in door available during automatic training', async () => {
  const { result, answer } = show();
  act(() => { result.current.signInInstead(); });
  await act(async () => { answer(Response.json({}, { status: 401 })); await Promise.resolve(); });
  expect(result.current.session).toMatchObject({ phase: 'landing', open: 'login' });
});

it('still starts training when local storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  const { result } = show();
  expect(result.current.session.phase).toBe('rehearsing');
});

it('honors an early static Play click and consumes that intent when the lesson is left', () => {
  localStorage.setItem('astera.training-entry.dismissed', '1');
  history.replaceState(null, '', '/?utm_source=x#play');
  const { result } = show();
  expect(result.current.session.phase).toBe('rehearsing');
  act(() => { result.current.leaveRehearsal(); });
  expect(location.hash).toBe('');
  expect(location.search).toBe('?utm_source=x');
});

it('consumes the early Play intent on entry so a later commander return does not restart training', () => {
  history.replaceState(null, '', '/?utm_source=x#play');
  const first = show();
  expect(first.result.current.session.phase).toBe('rehearsing');
  expect(location.hash).toBe('');
  expect(location.search).toBe('?utm_source=x');
  localStorage.setItem('astera.commander', '1');
  first.unmount();
  const next = show();
  expect(next.result.current.session.phase).toBe('starting');
});
