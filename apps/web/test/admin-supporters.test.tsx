import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import AdminPanel from '../src/screens/AdminPanel.js';

const request = z.object({ username: z.string(), supporter: z.boolean() });
type Request = z.infer<typeof request>;
interface Answer { status: number; body: unknown }
const success = (body: Request): Answer => ({ status: 200, body: {
  accountId: 'account-1', username: body.username, supporter: body.supporter,
  grantedAt: body.supporter ? '2026-10-05T12:00:00Z' : null,
} });

function show(respond: (body: Request) => Answer | Promise<Answer> = success) {
  const calls: { url: string; body: Request }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const body = request.parse(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));
    calls.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, body });
    const response = await respond(body);
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'content-type': 'application/json' } });
  };
  const api = new Api({ fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><AdminPanel /></ApiProvider></QueryClientProvider>);
  fireEvent.click(screen.getByRole('tab', { name: 'Supporters' }));
  return { calls };
}
const name = (value = '  Oguz  ') => fireEvent.change(screen.getByRole('textbox', { name: 'Commander username' }), { target: { value } });

describe('manual supporter administration', () => {
  it('grants the named account, then lets the operator revoke it', async () => {
    const { calls } = show();
    expect(screen.getByRole('button', { name: 'Give supporter badge' })).toBeDisabled();
    name();
    fireEvent.click(screen.getByRole('button', { name: 'Give supporter badge' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Oguz now has the supporter badge');
    fireEvent.click(screen.getByRole('button', { name: 'Remove supporter badge' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Supporter badge removed from Oguz'));
    expect(calls).toEqual([
      { url: '/api/admin/supporters', body: { username: 'Oguz', supporter: true } },
      { url: '/api/admin/supporters', body: { username: 'Oguz', supporter: false } },
    ]);
  });

  it('explains an unknown account and allows a corrected retry', async () => {
    const { calls } = show((body) => body.username === 'Nobody'
      ? { status: 404, body: { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } }
      : success(body));
    name('Nobody');
    fireEvent.click(screen.getByRole('button', { name: 'Give supporter badge' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Nobody/);
    name('CaptainZovi');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Give supporter badge' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/CaptainZovi/);
    expect(calls).toHaveLength(2);
  });

  it('blocks duplicate or opposite submissions while the server is responding', async () => {
    let resolve: ((answer: Answer) => void) | undefined;
    const { calls } = show(() => new Promise<Answer>((done) => { resolve = done; }));
    name();
    fireEvent.click(screen.getByRole('button', { name: 'Give supporter badge' }));
    expect(screen.getByRole('button', { name: 'Remove supporter badge' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Commander username' })).toBeDisabled();
    expect(calls).toHaveLength(1);
    resolve?.(success({ username: 'Oguz', supporter: true }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Oguz/);
  });

  it('does not falsely report a grant after a server failure', async () => {
    show(() => ({ status: 503, body: { error: 'UNAVAILABLE', message: 'Service unavailable' } }));
    name();
    fireEvent.click(screen.getByRole('button', { name: 'Give supporter badge' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give supporter badge' })).toBeEnabled();
  });
});
