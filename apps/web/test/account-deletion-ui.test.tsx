import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ServersScreen } from '../src/screens/ServersScreen.js';

const receipt = { requestId: '11111111-1111-4111-8111-111111111111', requestedAt: '2026-10-19T00:00:00.000Z', status: 'requested' };
function show(options: { pending?: boolean; fail?: boolean; delay?: boolean } = {}) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    requests.push({ method, path, body });
    if (path.endsWith('/account-deletion') && method === 'POST' && options.delay) return new Promise(() => undefined);
    const result = path.endsWith('/servers') ? { servers: [], placement: null } : path.endsWith('/security') ? { enabled: false, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null, pending: null }
      : { request: method === 'POST' || options.pending ? receipt : null };
    return Promise.resolve(new Response(JSON.stringify(options.fail && method === 'POST' ? { error: 'BAD_CREDENTIALS', message: 'Fixture' } : result), { status: options.fail && method === 'POST' ? 401 : 200 }));
  };
  const api = new Api({ fetch: fetcher }); const ended = vi.fn(); api.onSessionEnded(ended);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ServersScreen displayName="PolicyPilot" onChoose={vi.fn()} onSignOut={vi.fn()} /></ApiProvider></QueryClientProvider>);
  return { requests, ended };
}
async function open() { fireEvent.click(screen.getByRole('button', { name: 'Delete account' })); await screen.findByLabelText('Current password'); }
/** The request is the kit's final hold (C25): 1.5 s on the red face. */
async function holdDelete(): Promise<void> {
  const hold = screen.getByRole('button', { name: /Request account deletion/ });
  vi.useFakeTimers();
  try {
    fireEvent.pointerDown(hold, { button: 0 });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    fireEvent.pointerUp(hold);
  } finally { vi.useRealTimers(); }
}
async function confirm() {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'fixture-current-password' } });
  fireEvent.click(screen.getByRole('switch'));
  await holdDelete();
}

it('offers deletion even without a recovery email and explains the shared-account consequence', async () => {
  show(); await open();
  expect(screen.getByText(/web, Android and iOS/i)).toBeInTheDocument();
  expect(screen.getByText(/when the request is approved/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Deletion details and retained data' })).toHaveAttribute('href', '/account-deletion.html');
  expect(screen.getByRole('button', { name: /Enter your current password first/ })).toBeDisabled();
});
it('records a request using only the password and locale, and does not claim completion or sign out', async () => {
  const fixture = show(); await open(); await confirm();
  expect(await screen.findByRole('status')).toHaveTextContent('Deletion request received');
  expect(screen.getByText(receipt.requestId)).toBeInTheDocument();
  expect(screen.queryByLabelText('Current password')).toBeNull();
  expect(fixture.requests.find(request => request.method === 'POST')?.body).toEqual({ currentPassword: 'fixture-current-password', locale: 'en' });
  expect(fixture.ended).not.toHaveBeenCalled();
});
it('shows the existing durable request after reopening without submitting a second request', async () => {
  const fixture = show({ pending: true });
  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Deletion request received');
  expect(screen.queryByLabelText('Current password')).toBeNull();
  expect(fixture.requests.some(request => request.method === 'POST')).toBe(false);
});
it('keeps a failed request editable with a useful error instead of showing success', async () => {
  show({ fail: true }); await open(); await confirm();
  expect(await screen.findByRole('alert')).toHaveTextContent('The current password does not match');
  expect(screen.getByLabelText('Current password')).toBeEnabled();
  expect(screen.queryByRole('status')).toBeNull();
});
it('coalesces repeated taps while a request is in flight', async () => {
  const fixture = show({ delay: true }); await open(); await confirm();
  await waitFor(() => { expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1); });
  const busy = screen.getByRole('button', { name: /Checking your deletion request/ });
  expect(busy).toBeDisabled();
  fireEvent.pointerDown(busy, { button: 0 });
  expect(fixture.requests.filter(request => request.method === 'POST')).toHaveLength(1);
});
