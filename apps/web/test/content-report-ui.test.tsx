import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { ChatScreen, type ChatChannel } from '../src/screens/ChatScreen.js';
import AdminPanel from '../src/screens/AdminPanel.js';

const id = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const at = new Date('2026-10-19T00:00:00Z');
const message = { id, authorPlayerId: peer, username: 'Scout', content: 'Visible message', self: false, createdAt: at, language: 'en' };
function show(channel: ChatChannel = 'general', options: { delay?: boolean; fail?: boolean; blocked?: boolean; admin?: boolean; profile?: boolean; loadFail?: boolean } = {}) {
  const posts: { path: string; body: unknown }[] = []; let closed = false;
  const fetcher: typeof fetch = (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const post = init?.method === 'POST';
    if (post) posts.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null });
    if (post && options.delay) return new Promise(() => undefined);
    if (post && path.includes('/resolve')) closed = true;
    if (options.loadFail && !post) return Promise.resolve(new Response('{}', { status: 503 }));
    const lastPost = posts.at(-1)?.body;
    const dismissed = typeof lastPost === 'object' && lastPost !== null && 'action' in lastPost && lastPost.action === 'DISMISS';
    const result = path.startsWith('/api/admin/content-reports') ? post ? { id, status: dismissed ? 'DISMISSED' : 'RESOLVED' } : { reports: closed ? [] : [{ id, kind: options.profile ? 'player' : 'message', channel: options.profile ? null : 'general', messageId: options.profile ? null : id, reason: 'SPAM', details: 'Please review', evidence: { username: 'Scout', playerId: peer, content: '<script>not executable</script>', media: null }, status: 'PENDING', createdAt: at, targetUsername: 'scout' }] }
      : { report: { id, createdAt: at.toISOString(), status: 'received' } };
    return Promise.resolve(new Response(JSON.stringify(post && options.fail ? { error: 'RATE_LIMITED', message: 'Fixture' } : result), { status: post && options.fail ? 429 : 200 }));
  };
  const api = new Api({ fetch: fetcher });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  vi.spyOn(api, 'markClanChatRead').mockResolvedValue({ readAt: at });
  vi.spyOn(api, 'markDmRead').mockResolvedValue({ readAt: at });
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  q.setQueryData(keys.communityPolicy, { version: COMMUNITY_POLICY_VERSION, acceptedAt: new Date('2026-10-19T00:00:00Z') });
  const page = { pages: [{ messages: [message, { ...message, id: 'mine', self: true }], nextBefore: null }], pageParams: [null] };
  q.setQueryData(keys.chatMessagesFor('en'), page); q.setQueryData(keys.chatUnreadFor('en'), { count: 0 });
  q.setQueryData(keys.clanBadge, { membership: { clanId: 'clan', role: 'MEMBER' }, clanChatUnread: 0 }); q.setQueryData(keys.clanChat, page);
  q.setQueryData(keys.dmUnread, { count: 0 });
  const conversations = { conversations: [{ id: 'thread', peer: { playerId: peer, username: 'Scout', country: 'TR' }, unreadCount: 0, blockedByMe: options.blocked ?? false, blockedMe: false, canSend: !options.blocked, unavailableReason: options.blocked ? 'BLOCKED' as const : null, lastMessage: { id, createdAt: at, content: message.content } }], totalUnread: 0 };
  q.setQueryData(keys.dmConversations, conversations);
  vi.spyOn(api, 'dmConversations').mockResolvedValue(conversations);
  vi.spyOn(api, 'dmUnread').mockResolvedValue({ count: 0 });
  q.setQueryData(keys.dmMessagesFor('thread'), page);
  render(<QueryClientProvider client={q}><ApiProvider api={api}>{options.admin ? <AdminPanel /> : <ChatScreen initialChannel={channel} onFocusPlanet={vi.fn()} />}</ApiProvider></QueryClientProvider>);
  return posts;
}
async function open() {
  const bubble = document.querySelector(`[data-chat-message="${id}"]`); if (!bubble) throw new Error('Missing fixture bubble');
  fireEvent.contextMenu(bubble); fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  return screen.findByRole('dialog', { name: 'Report content or player' });
}
it.each(['general', 'clan', 'dm'] as const)('submits the exact %s message selector without client evidence and displays only a receipt', async channel => {
  const posts = show(channel); const dialog = await open();
  expect(within(dialog).getByRole('button', { name: 'Send report' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'SPAM' } });
  fireEvent.change(within(dialog).getByLabelText('Additional details (optional)'), { target: { value: 'Please review' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Report received');
  expect(posts).toEqual([{ path: '/api/community/reports', body: { kind: 'message', channel, messageId: id, reason: 'SPAM', details: 'Please review' } }]);
  expect(within(dialog).getByText(id)).toBeInTheDocument();
});
it('can report a player from the same context and preserves the editable form after failure', async () => {
  const posts = show('general', { fail: true }); const dialog = await open();
  fireEvent.change(within(dialog).getByLabelText('What are you reporting?'), { target: { value: 'player' } });
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'INAPPROPRIATE_NAME' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Too many reports');
  expect(within(dialog).queryByRole('status')).toBeNull();
  expect(posts[0]?.body).toEqual({ kind: 'player', playerId: peer, reason: 'INAPPROPRIATE_NAME', details: '' });
});
it('coalesces repeated taps and never offers a self-report', async () => {
  const posts = show('general', { delay: true });
  const own = document.querySelector('[data-chat-message="mine"]'); if (!own) throw new Error('Missing self fixture');
  fireEvent.contextMenu(own); expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();
  const dialog = await open(); fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'SPAM' } });
  const submit = within(dialog).getByRole('button', { name: 'Send report' }); fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => { expect(posts).toHaveLength(1); }); expect(submit).toBeDisabled();
});
it('keeps reporting available on retained blocked DM history without enabling reply or reaction', async () => {
  show('dm', { blocked: true }); await open();
  expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add emoji reaction' })).toBeNull();
});
it('opens the operator queue, renders untrusted evidence as text and requires an explicit exact-message decision', async () => {
  const posts = show('general', { admin: true });
  fireEvent.click(screen.getByRole('tab', { name: 'Content reports' }));
  expect(await screen.findByText('<script>not executable</script>')).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
  const mask = screen.getByRole('button', { name: 'Remove reported message' }); expect(mask).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(mask);
  expect(await screen.findByRole('status')).toHaveTextContent('Decision saved');
  expect(posts).toEqual([{ path: `/api/admin/content-reports/${id}/resolve`, body: { action: 'MASK', confirm: true } }]);
});
it('does not offer message removal for a player report and records dismissal as a separate decision', async () => {
  const posts = show('general', { admin: true, profile: true }); fireEvent.click(screen.getByRole('tab', { name: 'Content reports' }));
  const dismiss = await screen.findByRole('button', { name: 'Dismiss report' });
  expect(screen.queryByRole('button', { name: 'Remove reported message' })).toBeNull();
  expect(screen.getByText(/This report concerns a player/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(dismiss);
  expect(await screen.findByRole('status')).toHaveTextContent('Decision saved');
  expect(posts[0]?.body).toEqual({ action: 'DISMISS', confirm: true });
});
it('requires renewed review after a failed moderation decision and never claims it was saved', async () => {
  show('general', { admin: true, fail: true }); fireEvent.click(screen.getByRole('tab', { name: 'Content reports' }));
  const mask = await screen.findByRole('button', { name: 'Remove reported message' });
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(mask);
  expect(await screen.findByRole('alert')).toHaveTextContent('The decision could not be confirmed');
  expect(screen.queryByRole('status')).toBeNull(); expect(mask).toBeDisabled(); expect(screen.getByRole('checkbox')).not.toBeChecked();
});
it('keeps a failed operator queue distinct from an empty one and exposes refresh', async () => {
  show('general', { admin: true, loadFail: true }); fireEvent.click(screen.getByRole('tab', { name: 'Content reports' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reports could not be loaded');
  expect(screen.queryByText('No pending reports.')).toBeNull(); expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
});
it('serializes operator taps until a decision response arrives', async () => {
  const posts = show('general', { admin: true, delay: true }); fireEvent.click(screen.getByRole('tab', { name: 'Content reports' }));
  const mask = await screen.findByRole('button', { name: 'Remove reported message' });
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(mask); fireEvent.click(mask);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss report' }));
  await waitFor(() => { expect(posts).toHaveLength(1); }); expect(mask).toBeDisabled();
});
