import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api, ApiError } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { describeError } from '../src/i18n/errors.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';

const at = new Date('2026-09-27T08:00:00.000Z');
const firstMessage = { id: 'message-1', authorPlayerId: 'peer-1', username: 'Commander Atlas', content: 'Private hello', createdAt: at, self: false };
const conversation = {
  id: 'thread-1', peer: { playerId: 'peer-1', username: 'Commander Atlas', country: 'TR' },
  lastMessage: { id: 'message-1', content: 'Private hello', createdAt: at },
  unreadCount: 1, blockedByMe: false, canSend: true, unavailableReason: null,
};

function show() {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  let blocked = false;
  vi.spyOn(api, 'dmConversations').mockImplementation(() => Promise.resolve({
    conversations: [{ ...conversation, blockedByMe: blocked, canSend: !blocked, unavailableReason: blocked ? 'BLOCKED' as const : null }],
    totalUnread: 1,
  }));
  vi.spyOn(api, 'dmUnread').mockResolvedValue({ count: 1 });
  vi.spyOn(api, 'dmMessages').mockResolvedValue({
    messages: [firstMessage], nextBefore: null, canSend: true, unavailableReason: null,
  });
  vi.spyOn(api, 'markDmRead').mockResolvedValue({ readAt: at });
  const postDm = vi.spyOn(api, 'postDm').mockResolvedValue({
    conversationId: 'thread-1',
    message: { id: 'message-2', authorPlayerId: 'mine', username: 'Me', content: 'Reply', createdAt: new Date(at.getTime() + 1000), self: true },
  });
  vi.spyOn(api, 'reactToMessage').mockResolvedValue({ reactions: [{ emoji: '👍', count: 1, mine: true }] });
  vi.spyOn(api, 'dmContacts').mockResolvedValue({ contacts: [{ playerId: 'peer-2', username: 'Commander Luna', country: 'FR' }] });
  vi.spyOn(api, 'blockDm').mockImplementation(() => { blocked = true; return Promise.resolve({ blocked }); });
  vi.spyOn(api, 'unblockDm').mockImplementation(() => { blocked = false; return Promise.resolve({ blocked }); });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chatMessagesFor('en'), { pages: [{ messages: [], nextBefore: null }], pageParams: [null] });
  client.setQueryData(keys.chatUnreadFor('en'), { count: 0 });
  client.setQueryData(keys.clanBadge, { available: false, membership: null, clanChatUnread: 0 });
  client.setQueryData(keys.dmConversations, { conversations: [conversation], totalUnread: 1 });
  client.setQueryData(keys.dmUnread, { count: 1 });
  client.setQueryData(keys.dmMessagesFor('thread-1'), {
    pages: [{ messages: [firstMessage], nextBefore: null, canSend: true, unavailableReason: null }],
    pageParams: [null],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><ChatScreen onFocusPlanet={vi.fn()} /></Wrapper>);
  return { api, client, postDm };
}

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('direct messages in chat', () => {
  it('explains DM send refusals in the player’s language', async () => {
    await i18n.changeLanguage('tr');
    expect(describeError(new ApiError('DM_UNAVAILABLE', 'Both commanders must be in the same live galaxy', 409))).toMatch(/galaksi/i);
    expect(describeError(new ApiError('DM_BLOCKED', 'This conversation cannot receive messages', 403))).toMatch(/engell/i);
  });
  it('shows a DM channel and private conversation tabs with unread state', async () => {
    const { api } = show();
    await userEvent.setup().click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    expect(screen.getByRole('tab', { name: /Commander Atlas.*1 unread/i })).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Messages with Commander Atlas' })).toHaveTextContent('Private hello');
    await waitFor(() => { expect(api.markDmRead).toHaveBeenCalledWith('thread-1', 'message-1'); });
    expect(screen.queryByRole('combobox', { name: 'Chat language' })).not.toBeInTheDocument();
  });

  it('opens a new tab from the plus button and sends to the chosen commander', async () => {
    const { api, postDm } = show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    await user.click(screen.getByRole('button', { name: 'Start a DM' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a commander' }), 'Luna');
    await waitFor(() => { expect(api.dmContacts).toHaveBeenCalledWith('Luna'); });
    await user.click(await screen.findByRole('button', { name: 'Commander Luna' }));
    expect(screen.getByRole('tab', { name: 'Commander Luna' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message Commander Luna' }), 'Reply');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(postDm).toHaveBeenCalledWith('peer-2', 'Reply'); });
  });

  it('disables sending during Silent Space and re-enables it when the peer returns', async () => {
    const { client } = show();
    await userEvent.setup().click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    client.setQueryData(keys.dmConversations, { conversations: [{ ...conversation, canSend: false, unavailableReason: 'WAITING' }], totalUnread: 1 });
    expect(await screen.findByText(/Silent Space/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message Commander Atlas' })).toBeDisabled();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="message-1"]')!);
    expect(screen.queryByRole('button', { name: 'Add emoji reaction' })).not.toBeInTheDocument();
    client.setQueryData(keys.dmMessagesFor('thread-1'), {
      pages: [{ messages: [firstMessage], nextBefore: null, canSend: false, unavailableReason: 'WAITING' }], pageParams: [null],
    });
    expect(screen.getByRole('textbox', { name: 'Message Commander Atlas' })).toBeDisabled();
    client.setQueryData(keys.dmConversations, { conversations: [conversation], totalUnread: 1 });
    client.setQueryData(keys.dmMessagesFor('thread-1'), {
      pages: [{ messages: [firstMessage], nextBefore: null, canSend: true, unavailableReason: null }], pageParams: [null],
    });
    await waitFor(() => { expect(screen.getByRole('textbox', { name: 'Message Commander Atlas' })).toBeEnabled(); });
    fireEvent.contextMenu(document.querySelector('[data-chat-message="message-1"]')!);
    expect(screen.getByRole('button', { name: 'Add emoji reaction' })).toBeInTheDocument();
  });

  it('explains why a conversation cannot continue after its season closes', async () => {
    const { client } = show();
    await userEvent.setup().click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    client.setQueryData(keys.dmConversations, { conversations: [{ ...conversation, canSend: false, unavailableReason: 'SEASON_ENDED' }], totalUnread: 1 });
    client.setQueryData(keys.dmMessagesFor('thread-1'), {
      pages: [{ messages: [firstMessage], nextBefore: null, canSend: false, unavailableReason: 'SEASON_ENDED' }], pageParams: [null],
    });
    expect(await screen.findByText(/season has ended/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message Commander Atlas' })).toBeDisabled();
  });

  it('can block and unblock a peer while retaining the message history', async () => {
    const { api } = show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    await user.click(screen.getByRole('button', { name: 'Block Commander Atlas' }));
    await waitFor(() => { expect(api.blockDm).toHaveBeenCalledWith('peer-1'); });
    expect(screen.getByText('Private hello')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Unblock Commander Atlas' }));
    await waitFor(() => { expect(api.unblockDm).toHaveBeenCalledWith('peer-1'); });
  });

  it('offers emoji reactions and a quoted reply on a held DM message', async () => {
    const { api, postDm } = show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    fireEvent.contextMenu(document.querySelector('[data-chat-message="message-1"]')!);
    await user.click(screen.getByRole('button', { name: 'Add emoji reaction' }));
    await user.click(screen.getByRole('button', { name: 'React with 👍' }));
    await waitFor(() => { expect(api.reactToMessage).toHaveBeenCalledWith('dm', 'message-1', '👍'); });
    fireEvent.contextMenu(document.querySelector('[data-chat-message="message-1"]')!);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Replying to Commander Atlas')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message Commander Atlas' }), 'Agreed');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(postDm).toHaveBeenCalledWith('peer-1', 'Agreed', 'message-1'); });
  });

  it('keeps a DM reply with its conversation tab', async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /DM.*1 unread/i }));
    fireEvent.contextMenu(document.querySelector('[data-chat-message="message-1"]')!);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.click(screen.getByRole('button', { name: 'Start a DM' }));
    await user.click(await screen.findByRole('button', { name: 'Commander Luna' }));
    expect(screen.queryByText('Replying to Commander Atlas')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Commander Atlas/ }));
    expect(screen.getByText('Replying to Commander Atlas')).toBeInTheDocument();
  });
});
