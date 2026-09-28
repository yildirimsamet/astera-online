import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import AdminPanel from '../src/screens/AdminPanel.js';

interface Grant { username: string; skinId: string; orderRef: string }
interface Answer { status: number; body: unknown }

const granted = (grant: Grant): Answer =>
  ({ status: 200, body: { accountId: 'acc-1', skinId: grant.skinId, grantedAt: '2026-09-27T12:00:00.000Z' } });

function setup(respond: (grant: Grant) => Answer = granted) {
  const calls: { url: string; grant: Grant }[] = [];
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const grant = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Grant;
    calls.push({ url, grant });
    const answer = respond(grant);
    return Promise.resolve(new Response(answer.body === null ? '' : JSON.stringify(answer.body), {
      status: answer.status, headers: { 'content-type': 'application/json' },
    }));
  });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  render(<Wrapper><AdminPanel /></Wrapper>);
  fireEvent.click(screen.getByRole('tab', { name: i18n.t('community.admin.skinsTab') }));
  return { calls };
}

const fill = ({ commander = 'Samet', item, order = 'SHP-1001' }: { commander?: string; item: string; order?: string }) => {
  fireEvent.change(screen.getByRole('textbox', { name: i18n.t('community.admin.grantCommander') }), { target: { value: commander } });
  fireEvent.change(screen.getByRole('combobox', { name: i18n.t('community.admin.grantItem') }), { target: { value: item } });
  fireEvent.change(screen.getByRole('textbox', { name: i18n.t('community.admin.grantOrder') }), { target: { value: order } });
};
const submit = () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('community.admin.grantSubmit') })); };
const results = async () => screen.findByRole('list', { name: i18n.t('community.admin.grantResults') });

/**
 * A SHOPIER ORDER, GRANTED BY HAND (owner 2026-09-27: "Manuel + admin formu"). Shopier knows
 * nothing of the account, so the owner reads the commander from the order note and grants the
 * look here; the server records the Shopier order number, and sending it again is harmless.
 */
describe('granting a Shopier order', () => {
  it('grants one look to the named commander against the Shopier order', async () => {
    const { calls } = setup();
    fill({ item: 'planet-turkey' });
    submit();
    const list = await results();
    expect(calls).toEqual([{
      url: '/api/admin/skins/grant',
      grant: { username: 'Samet', skinId: 'planet-turkey', orderRef: 'SHP-1001' },
    }]);
    expect(within(list).getByText(i18n.t('skins.turkey'))).toBeInTheDocument();
    expect(within(list).getByText(i18n.t('community.admin.grantDone'))).toBeInTheDocument();
  });

  it('grants the set as its four looks under one order, and says which were already owned', async () => {
    const { calls } = setup((grant) => grant.skinId === 'planet-ice'
      ? { status: 409, body: { error: 'SKIN_ALREADY_OWNED', message: 'This account already owns the skin' } }
      : granted(grant));
    fill({ item: 'bundle' });
    submit();
    const list = await results();
    await within(list).findByText(i18n.t('skins.desert'));
    expect(calls.map(({ grant }) => grant.skinId)).toEqual(['planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert']);
    expect(new Set(calls.map(({ grant }) => grant.orderRef))).toEqual(new Set(['SHP-1001']));
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      `${i18n.t('skins.lava')}${i18n.t('community.admin.grantDone')}`,
      `${i18n.t('skins.ice')}${i18n.t('community.admin.grantOwned')}`,
      `${i18n.t('skins.toxic')}${i18n.t('community.admin.grantDone')}`,
      `${i18n.t('skins.desert')}${i18n.t('community.admin.grantDone')}`,
    ]);
  });

  it('stops at an unknown commander instead of trying the rest of the set', async () => {
    const { calls } = setup(() => ({ status: 404, body: { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' } }));
    fill({ commander: 'Nobody', item: 'bundle' });
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('community.admin.grantNoAccount', { name: 'Nobody' }));
    expect(calls).toHaveLength(1);
  });

  it('says so on the row when the server cannot be reached', async () => {
    setup(() => ({ status: 502, body: null }));
    fill({ item: 'planet-lava' });
    submit();
    const list = await results();
    expect(within(list).getByRole('listitem')).toHaveTextContent(/lost contact with the server/i);
  });

  it('will not send without a commander and a real order number', () => {
    const { calls } = setup();
    const grant = screen.getByRole('button', { name: i18n.t('community.admin.grantSubmit') });
    expect(grant).toBeDisabled();
    fill({ item: 'planet-lava', order: 'ab' });
    expect(grant).toBeDisabled();
    fill({ commander: ' ', item: 'planet-lava', order: 'SHP-1' });
    expect(grant).toBeDisabled();
    fill({ item: 'planet-lava', order: 'SHP-1' });
    expect(grant).toBeEnabled();
    expect(calls).toHaveLength(0);
  });
});
