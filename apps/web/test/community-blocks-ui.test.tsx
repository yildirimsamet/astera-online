import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { ChatHost } from '../src/v2/shell/ChatHost.js';

const playerId = '11111111-1111-4111-8111-111111111111'; const accountId = '22222222-2222-4222-8222-222222222222';
const at = new Date('2026-10-19T00:00:00Z');
const message = { id: '33333333-3333-4333-8333-333333333333', authorPlayerId: playerId, username: 'Scout', content: 'Scout message', self: false, createdAt: at, language: 'en' };
function show(options: { blocked?: boolean; fail?: boolean; delay?: boolean; loadFail?: boolean; dm?: boolean } = {}) {
  let blocked = options.blocked ?? false; const writes: { method: string; path: string; body: unknown }[] = [];
  const conversation = () => ({ conversations: [{ id: 'thread', peer: { playerId, username: 'Scout', country: 'TR' }, lastMessage: { id: message.id, content: message.content, createdAt: at }, unreadCount: 0, blockedByMe: false, communityBlockedByMe: blocked, canSend: !blocked, unavailableReason: blocked ? 'BLOCKED' : null }], totalUnread: 0 });
  const page = () => ({ messages: blocked ? [] : [message], nextBefore: null });
  const api = new Api({ fetch: (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url; const method = init?.method ?? 'GET';
    if (method !== 'GET') { writes.push({ method, path, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null }); if (options.delay) return new Promise(() => undefined); }
    if (options.fail && method !== 'GET' || options.loadFail && path === '/api/community/blocks') return Promise.resolve(new Response(JSON.stringify({ error: 'UNAVAILABLE', message: 'Fixture' }), { status: 503 }));
    if (method === 'POST') blocked = true; if (method === 'DELETE') blocked = false;
    const data = path === '/api/community/blocks' ? method === 'POST' ? { blocked: true } : { blocks: blocked ? [{ accountId, username: 'Scout', createdAt: at }] : [] }
      : method === 'DELETE' ? { blocked: false } : path === '/api/dm/conversations' ? conversation()
        : path.includes('/api/dm/conversations/thread/messages') ? { messages: [message], nextBefore: null, canSend: !blocked, unavailableReason: blocked ? 'BLOCKED' : null }
          : path.includes('/api/chat/messages') ? page() : { count: 0 };
    return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
  } });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at }); vi.spyOn(api, 'markDmRead').mockResolvedValue({ readAt: at });
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  q.setQueryData(keys.communityPolicy, { version: COMMUNITY_POLICY_VERSION, acceptedAt: new Date('2026-10-19T00:00:00Z') });
  q.setQueryData(keys.chatMessagesFor('en'), { pages: [page()], pageParams: [null] });
  q.setQueryData(keys.chatUnreadFor('en'), { count: 0 }); q.setQueryData(keys.dmUnread, { count: 0 });
  q.setQueryData(keys.clanBadge, { available: true, membership: null, attentionCount: 0, clanChatUnread: 0 }); q.setQueryData(keys.dmConversations, conversation());
  q.setQueryData(keys.dmMessagesFor('thread'), { pages: [{ messages: [message], nextBefore: null, canSend: !blocked, unavailableReason: blocked ? 'BLOCKED' : null }], pageParams: [null] });
  render(<QueryClientProvider client={q}><ApiProvider api={api}><ChatHost accountId="own-account" onClose={vi.fn()} onFocusPlanet={vi.fn()} channel={options.dm ? 'dm' : 'general'} /></ApiProvider></QueryClientProvider>);
  return writes;
}
async function openBlock() {
  const bubble = document.querySelector(`[data-chat-message="${message.id}"]`); if (!bubble) throw new Error('Missing bubble');
  fireEvent.contextMenu(bubble); fireEvent.click(screen.getByRole('button', { name: 'Block player' }));
  return screen.findByRole('dialog', { name: 'Block player' });
}
it('requires confirmation, explains the social scope and submits only the target player id', async () => {
  const writes = show(); const dialog = await openBlock();
  expect(within(dialog).getByText(/does not affect fleets or battles/i)).toBeInTheDocument();
  const submit = within(dialog).getByRole('button', { name: 'Confirm block' }); expect(submit).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('checkbox')); fireEvent.click(submit);
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Player blocked');
  expect(writes).toEqual([{ method: 'POST', path: '/api/community/blocks', body: { targetPlayerId: playerId } }]);
  expect(screen.queryByText('Scout message')).toBeNull();
});
it('loads persistent blocks from the header and unblocks the exact account without depending on its old player id', async () => {
  const writes = show({ blocked: true }); fireEvent.click(screen.getByRole('button', { name: 'Blocked players' }));
  const dialog = await screen.findByRole('dialog', { name: 'Blocked players' });
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Unblock Scout' }));
  expect(await within(dialog).findByText('No blocked players.')).toBeInTheDocument();
  expect(writes).toEqual([{ method: 'DELETE', path: `/api/community/blocks/${accountId}`, body: null }]);
  expect(await screen.findByText('Scout message')).toBeInTheDocument();
});
it('preserves the confirmation and displays a failure instead of claiming a block succeeded', async () => {
  show({ fail: true }); const dialog = await openBlock();
  fireEvent.click(within(dialog).getByRole('checkbox')); fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm block' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('The block could not be confirmed');
  expect(within(dialog).queryByRole('status')).toBeNull(); expect(within(dialog).getByRole('button', { name: 'Confirm block' })).toBeEnabled();
});
it('distinguishes a failed list from an empty list and provides retry', async () => {
  show({ loadFail: true }); fireEvent.click(screen.getByRole('button', { name: 'Blocked players' }));
  const dialog = await screen.findByRole('dialog', { name: 'Blocked players' });
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Blocked players could not be loaded');
  expect(within(dialog).queryByText('No blocked players.')).toBeNull(); expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeEnabled();
});
it('coalesces taps while a block is in flight', async () => {
  const writes = show({ delay: true }); const dialog = await openBlock(); fireEvent.click(within(dialog).getByRole('checkbox'));
  const submit = within(dialog).getByRole('button', { name: 'Confirm block' }); fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => { expect(writes).toHaveLength(1); }); expect(submit).toBeDisabled();
});
it('directs a full community block in DM to its manager rather than pretending the old DM-only unblock removes it', async () => {
  const writes = show({ blocked: true, dm: true });
  fireEvent.click(screen.getByRole('button', { name: 'Manage player block' }));
  const dialog = await screen.findByRole('dialog', { name: 'Blocked players' });
  expect(await within(dialog).findByRole('button', { name: 'Unblock Scout' })).toBeInTheDocument(); expect(writes).toHaveLength(0);
});
it('clears a reply to the blocked author when the block succeeds', async () => {
  show(); const bubble = document.querySelector(`[data-chat-message="${message.id}"]`); if (!bubble) throw new Error('Missing message');
  fireEvent.contextMenu(bubble); fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
  expect(screen.getByText(/Replying to Scout/)).toBeInTheDocument();
  const dialog = await openBlock(); fireEvent.click(within(dialog).getByRole('checkbox')); fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm block' }));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Player blocked');
  expect(screen.queryByText(/Replying to Scout/)).toBeNull();
});
