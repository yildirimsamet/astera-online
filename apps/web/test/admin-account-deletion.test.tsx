import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import AdminPanel from '../src/screens/AdminPanel.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const receipt = { requestId, requestedAt: '2026-10-19T00:00:00.000Z', status: 'requested' as 'requested' | 'approved' };
const base = '/api/admin/account-deletion';
function show(options: { approved?: boolean; busy?: boolean; media?: boolean; fail?: boolean; delay?: boolean; ledger?: boolean } = {}) {
  const posts: { path: string; body: unknown }[] = []; let approved = options.approved ?? false; let completed = options.media ?? false;
  const fetcher: typeof fetch = (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const post = init?.method === 'POST';
    if (post) posts.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null });
    if (post && options.delay) return new Promise(() => undefined);
    if (post && path.endsWith('/approve')) approved = true;
    if (post && path.endsWith('/complete') && !options.busy) completed = true;
    const body = options.fail ? { error: 'UNAVAILABLE', message: 'Fixture' }
      : post ? options.ledger ? { error: 'DELETION_LEDGER_UNAVAILABLE', message: 'Fixture' } : options.busy ? { error: 'WORLD_BUSY', message: 'Fixture' } : path === base ? { request: { ...receipt, status: approved ? 'approved' : 'requested' } } : path.endsWith('/approve') ? { request: { ...receipt, status: 'approved' } } : path.endsWith('/media-cleanup') ? { requestId, mediaCleanupPending: false } : { requestId, status: 'completed' }
        : { requests: completed ? [] : [{ ...receipt, status: approved ? 'approved' : 'requested', accountId: '22222222-2222-4222-8222-222222222222', username: 'policypilot', displayName: 'Policy Pilot' }], mediaPending: options.media ? [{ requestId, files: 1 }] : [] };
    return Promise.resolve(new Response(JSON.stringify(body), { status: options.fail || options.ledger && post ? 503 : options.busy && post ? 409 : 200 }));
  };
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={new Api({ fetch: fetcher })}><AdminPanel /></ApiProvider></QueryClientProvider>);
  fireEvent.click(screen.getByRole('tab', { name: 'Deletion requests' }));
  return posts;
}
async function row() { return screen.findByRole('listitem', { name: 'Policy Pilot @policypilot' }); }

it('requires explicit ownership verification before closing access and then offers completion separately', async () => {
  const posts = show(); const item = await row();
  expect(item).toHaveTextContent(requestId);
  expect(within(item).queryByRole('button', { name: 'Complete deletion' })).toBeNull();
  fireEvent.click(within(item).getByRole('button', { name: 'Approve request' }));
  expect(posts).toHaveLength(0);
  expect(within(item).getByRole('button', { name: 'Confirm approval' })).toBeDisabled();
  fireEvent.click(within(item).getByRole('checkbox'));
  fireEvent.click(within(item).getByRole('button', { name: 'Confirm approval' }));
  await waitFor(() => { expect(posts).toEqual([{ path: `${base}/${requestId}/approve`, body: { confirm: true } }]); });
  expect(await within(item).findByRole('button', { name: 'Complete deletion' })).toBeEnabled();
  expect(within(item).queryByRole('checkbox')).toBeNull();
});
it('requires a new confirmation for deletion, uses the exact request id and reports success only after completion', async () => {
  const posts = show({ approved: true }); const item = await row();
  fireEvent.click(within(item).getByRole('button', { name: 'Complete deletion' }));
  expect(posts).toHaveLength(0);
  fireEvent.click(within(item).getByRole('checkbox'));
  fireEvent.click(within(item).getByRole('button', { name: 'Confirm deletion' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Account deleted');
  expect(posts).toEqual([{ path: `${base}/${requestId}/complete`, body: { confirm: true } }]);
});
it('explains an active-world deferral and keeps the account available for a later retry', async () => {
  show({ approved: true, busy: true }); const item = await row();
  fireEvent.click(within(item).getByRole('button', { name: 'Complete deletion' }));
  fireEvent.click(within(item).getByRole('checkbox'));
  fireEvent.click(within(item).getByRole('button', { name: 'Confirm deletion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Active operations or a world update prevent deletion. Wait and try again.');
  expect(screen.queryByRole('status')).toBeNull();
  expect(await row()).toBeInTheDocument();
});
it('shows anonymous pending media jobs after the account has been removed and allows a safe retry', async () => {
  const posts = show({ media: true });
  const cleanup = await screen.findByRole('button', { name: 'Retry file cleanup' });
  expect(screen.getByText(requestId)).toBeInTheDocument();
  fireEvent.click(cleanup);
  await waitFor(() => { expect(posts).toEqual([{ path: `${base}/${requestId}/media-cleanup`, body: { confirm: true } }]); });
});
it('shows a failed queue as unavailable and provides retry instead of an empty-success state', async () => {
  show({ fail: true });
  expect(await screen.findByRole('alert')).toHaveTextContent('Deletion requests could not be loaded. Try again.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  expect(screen.queryByText('No deletion requests.')).toBeNull();
});
it('blocks repeated confirmations while an approval is in flight', async () => {
  const posts = show({ delay: true }); const item = await row();
  fireEvent.click(within(item).getByRole('button', { name: 'Approve request' }));
  fireEvent.click(within(item).getByRole('checkbox'));
  const submit = within(item).getByRole('button', { name: 'Confirm approval' });
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => { expect(posts).toHaveLength(1); });
  expect(submit).toBeDisabled();
});
it('records a verified email/support request separately from approval using the registration username', async () => {
  const posts = show(); await row();
  fireEvent.click(screen.getByText('Record a support request'));
  fireEvent.change(screen.getByLabelText('Registration username'), { target: { value: 'PolicyPilot' } });
  const submit = screen.getByRole('button', { name: 'Record verified request' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(submit);
  await waitFor(() => { expect(posts).toEqual([{ path: base, body: { username: 'PolicyPilot', locale: 'en', confirm: true } }]); });
  expect(await screen.findByRole('status')).toHaveTextContent('Support request recorded. Access remains open until approval.');
});
it('does not claim access is open when the support request was already approved', async () => {
  show({ approved: true }); await row();
  fireEvent.click(screen.getByText('Record a support request'));
  fireEvent.change(screen.getByLabelText('Registration username'), { target: { value: 'PolicyPilot' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Record verified request' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Access closed');
  expect(screen.queryByText(/Access remains open until approval/)).toBeNull();
});
it('explains a private journal failure without claiming account deletion', async () => {
  show({ approved: true, ledger: true }); const item = await row();
  fireEvent.click(within(item).getByRole('button', { name: 'Complete deletion' }));
  fireEvent.click(within(item).getByRole('checkbox'));
  fireEvent.click(within(item).getByRole('button', { name: 'Confirm deletion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Private deletion records could not be saved. Check storage and retry. The account was not deleted.');
  expect(screen.queryByRole('status')).toBeNull();
});
