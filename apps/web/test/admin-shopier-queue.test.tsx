import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';

interface Call { method: string; url: string; body: unknown }
const order = (over: Record<string, unknown>) => ({ orderId: '501', status: 'UNMATCHED', reason: 'ACCOUNT_MISSING', itemId: 'planet-lava',
  username: null, note: 'samet', total: '99.00', currency: 'TRY', receivedAt: '2026-10-16T10:00:00.000Z', closed: false, ...over });
const queue = [
  order({}),
  order({ orderId: '502', reason: 'UNKNOWN_PRODUCT', itemId: null, note: '', total: '499.00' }),
  order({ orderId: '504', reason: 'UNREADABLE', itemId: null, note: 'okunmaz', total: null, currency: null }),
  order({ orderId: '503', status: 'MATCHED', reason: null, itemId: 'ring-aurora', username: 'ada',
    note: '', total: '49.00', closed: true }),
];

function setup(respond: (call: Call) => { status: number; body: unknown } | undefined = () => undefined) {
  const calls: Call[] = [];
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const call = { method: init?.method ?? 'GET', url, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined };
    calls.push(call);
    const answer = respond(call) ?? (call.method === 'GET' ? { status: 200, body: { orders: queue } }
      : url.endsWith('/sync') ? { status: 200, body: { recorded: 1, closed: 2 } }
        : { status: 200, body: { orderId: '501', accountId: 'acc', closed: true } });
    return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><AdminPanel /></Wrapper>);
  fireEvent.click(screen.getByRole('tab', { name: i18n.t('community.admin.shopierTab') }));
  return { calls, posts: () => calls.filter(call => call.method === 'POST') };
}
const row = async (orderId: string) => screen.findByRole('listitem', { name: new RegExp(`#${orderId}`) });

beforeEach(async () => { await i18n.changeLanguage('en'); });

/**
 * THE SHOPIER QUEUE (owner 2026-10-16, 2026-10-29). A paid order no product of the game binds
 * is never granted by itself: it waits here with its reason and note until the operator names
 * the commander, closes it (a support card, a manual refund) or takes back a chargeback.
 */
describe('the Shopier order queue', () => {
  it('lists each order with its look, amount, reason and note', async () => {
    setup();
    const waiting = await row('501');
    expect(waiting).toHaveTextContent(i18n.t('skins.lava'));
    expect(waiting).toHaveTextContent('₺99');
    expect(waiting).toHaveTextContent(i18n.t('community.admin.shopier.reason.ACCOUNT_MISSING'));
    expect(waiting).toHaveTextContent('samet');
    expect(await row('504')).toHaveTextContent(i18n.t('community.admin.shopier.reason.UNREADABLE'));
    expect(await row('502')).toHaveTextContent(i18n.t('community.admin.shopier.reason.UNKNOWN_PRODUCT'));
    const delivered = await row('503');
    expect(delivered).toHaveTextContent(i18n.t('community.admin.shopier.status.MATCHED'));
    expect(delivered).toHaveTextContent('ada');
  });

  it('grants a waiting order to the named commander', async () => {
    const { posts } = setup();
    const waiting = await row('501');
    fireEvent.change(within(waiting).getByRole('textbox', { name: i18n.t('community.admin.shopier.commander') }), { target: { value: 'Samet' } });
    fireEvent.click(within(waiting).getByRole('button', { name: i18n.t('community.admin.shopier.grant') }));
    await waitFor(() => { expect(posts()).toEqual([{ method: 'POST', url: '/api/admin/shopier/orders/501/grant', body: { username: 'Samet' } }]); });
  });

  it('says why a grant was refused', async () => {
    setup(call => call.method === 'POST' ? { status: 404, body: { error: 'ACCOUNT_NOT_FOUND', message: 'x' } } : undefined);
    const waiting = await row('501');
    fireEvent.change(within(waiting).getByRole('textbox', { name: i18n.t('community.admin.shopier.commander') }), { target: { value: 'nobody' } });
    fireEvent.click(within(waiting).getByRole('button', { name: i18n.t('community.admin.shopier.grant') }));
    expect(await within(waiting).findByRole('alert')).toHaveTextContent(i18n.t('errors.ACCOUNT_NOT_FOUND'));
  });

  it('closes an order of another product without granting', async () => {
    const { posts } = setup();
    const donation = await row('502');
    expect(within(donation).queryByRole('button', { name: i18n.t('community.admin.shopier.grant') })).toBeNull();
    fireEvent.click(within(donation).getByRole('button', { name: i18n.t('community.admin.shopier.dismiss') }));
    await waitFor(() => { expect(posts()).toEqual([{ method: 'POST', url: '/api/admin/shopier/orders/502/dismiss', body: {} }]); });
  });

  it('takes back a delivered order only after a second press', async () => {
    const { posts } = setup();
    const delivered = await row('503');
    fireEvent.click(within(delivered).getByRole('button', { name: i18n.t('community.admin.shopier.revoke') }));
    expect(posts()).toEqual([]);
    fireEvent.click(within(delivered).getByRole('button', { name: i18n.t('community.admin.shopier.revokeConfirm') }));
    await waitFor(() => { expect(posts()).toEqual([{ method: 'POST', url: '/api/admin/shopier/orders/503/revoke', body: {} }]); });
  });

  it('pulls open orders from Shopier and reports what it did', async () => {
    const { posts } = setup();
    await row('501');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.shopier.sync') }));
    expect(await screen.findByText(i18n.t('community.admin.shopier.synced', { recorded: 1, closed: 2 }))).toBeInTheDocument();
    expect(posts()).toEqual([{ method: 'POST', url: '/api/admin/shopier/sync', body: {} }]);
  });
});
