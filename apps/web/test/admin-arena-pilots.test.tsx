import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';

interface Pilot { accountId: string; username: string; name: string; grantedAt: string }
interface Call { url: string; method: string; body: unknown }

/**
 * KOMUTAN GEMISI SEATS, BY NAME (owner 2026-10-20: "Admin panel'e oyuncu isimleri
 * ekleyebilecegim bir alan koysan"). The owner names a commander, the list shows who
 * is seated, and one tap takes a seat back.
 */
function setup(initial: Pilot[] = []) {
  let pilots = [...initial];
  const calls: Call[] = [];
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url, method: init?.method ?? 'GET', body });
    const json = (status: number, value: unknown) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }));
    if (url === '/api/admin/arena-pilots' && (init?.method ?? 'GET') === 'GET') return json(200, { pilots });
    const { username, pilot } = body as { username: string; pilot: boolean };
    if (username.toLowerCase() === 'ghost') return json(404, { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    const row = { accountId: `acc-${username.toLowerCase()}`, username: username.toLowerCase(), name: username, grantedAt: '2026-10-20T20:00:00.000Z' };
    pilots = pilot ? [row, ...pilots.filter(p => p.accountId !== row.accountId)] : pilots.filter(p => p.accountId !== row.accountId);
    return json(200, { accountId: row.accountId, username: row.name, pilot });
  });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><AdminPanel /></Wrapper>);
  fireEvent.click(screen.getByRole('tab', { name: i18n.t('community.admin.arena.tab') }));
  return { calls };
}

const field = () => screen.getByRole('textbox', { name: i18n.t('community.admin.arena.commander') });
const add = (name: string) => {
  fireEvent.change(field(), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.arena.add') }));
};
const seats = () => screen.findByRole('list', { name: i18n.t('community.admin.arena.listLabel') });

beforeEach(async () => { if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en'); });

describe('the arena pilot desk', () => {
  it('says the arena is closed to everyone while the list is empty', async () => {
    setup();
    expect(await screen.findByText(i18n.t('community.admin.arena.empty'))).toBeInTheDocument();
  });

  it('seats a named commander and shows them on the list', async () => {
    const { calls } = setup();
    await screen.findByText(i18n.t('community.admin.arena.empty'));
    add('  Samet ');
    expect(await screen.findByRole('status')).toHaveTextContent(i18n.t('community.admin.arena.added', { name: 'Samet' }));
    expect(calls).toContainEqual({ url: '/api/admin/arena-pilots', method: 'POST', body: { username: 'Samet', pilot: true } });
    expect(within(await seats()).getByText('Samet')).toBeInTheDocument();
    expect(field()).toHaveValue('');
  });

  it('names an unknown commander instead of failing quietly', async () => {
    setup();
    await screen.findByText(i18n.t('community.admin.arena.empty'));
    add('Ghost');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('community.admin.arena.noAccount', { name: 'Ghost' }));
  });

  it('takes a seat back from the list', async () => {
    const { calls } = setup([{ accountId: 'acc-ayse', username: 'ayse', name: 'Ayse', grantedAt: '2026-10-20T19:00:00.000Z' }]);
    const list = await seats();
    fireEvent.click(within(list).getByRole('button', { name: i18n.t('community.admin.arena.remove', { name: 'Ayse' }) }));
    expect(await screen.findByText(i18n.t('community.admin.arena.empty'))).toBeInTheDocument();
    expect(calls).toContainEqual({ url: '/api/admin/arena-pilots', method: 'POST', body: { username: 'ayse', pilot: false } });
  });
});
