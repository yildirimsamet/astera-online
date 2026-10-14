import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ChatHost } from '../src/v2/shell/ChatHost.js';

const at = new Date();
const messages = [
  { id: 'mine', authorPlayerId: 'self', username: 'Me', content: 'Own message', self: true, createdAt: at, language: 'en' },
  { id: 'admin', authorPlayerId: 'admin', username: 'Admin', content: 'Admin message', self: false, admin: true, createdAt: at, language: 'en' },
  { id: 'other-one', authorPlayerId: 'other', username: 'Scout', content: 'First Scout message', self: false, createdAt: at, language: 'en' },
  { id: 'third', authorPlayerId: 'third', username: 'Third', content: 'Third message', self: false, createdAt: at, language: 'en' },
  { id: 'other-two', authorPlayerId: 'other', username: 'Scout', content: 'Last Scout message', self: false, createdAt: at, language: 'en' },
];
const page = (items = messages) => ({ pages: [{ messages: items, nextBefore: null }], pageParams: [null] });

function show(accountId = 'account-a') {
  const api = new Api({ fetch: () => Promise.resolve(new Response('{}', { status: 500 })) });
  const mark = vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  vi.spyOn(api, 'markClanChatRead').mockResolvedValue({ readAt: at });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chatMessagesFor('en'), page());
  client.setQueryData(keys.chatMessagesFor('tr'), page(messages.map(message => ({ ...message, language: 'tr' }))));
  client.setQueryData(keys.chatUnreadFor('en'), { count: 1 });
  client.setQueryData(keys.chatUnreadFor('tr'), { count: 0 });
  client.setQueryData(keys.dmUnread, { count: 0 });
  const dmConversations = { conversations: [{ id: 'dm-other', peer: { playerId: 'other', username: 'Scout', country: 'TR' }, unreadCount: 0, blockedByMe: false, blockedMe: false, canSend: true, unavailableReason: null, lastMessage: { id: 'private', content: 'Private Scout message', createdAt: at } }], totalUnread: 0 };
  vi.spyOn(api, 'dmConversations').mockResolvedValue(dmConversations);
  vi.spyOn(api, 'dmUnread').mockResolvedValue({ count: 0 });
  vi.spyOn(api, 'markDmRead').mockResolvedValue({ readAt: at });
  vi.spyOn(api, 'chatUnread').mockResolvedValue({ count: 0 });
  client.setQueryData(keys.dmConversations, dmConversations);
  client.setQueryData(keys.dmMessagesFor('dm-other'), page([{ ...messages[2]!, id: 'private', content: 'Private Scout message' }]));
  client.setQueryData(keys.clanBadge, { available: true, membership: { clanId: 'clan', name: 'Crew', tag: 'TAG', role: 'MEMBER', matureAt: at, mature: true }, attentionCount: 0, clanChatUnread: 0 });
  client.setQueryData(keys.clanChat, page([{ ...messages[2]!, id: 'clan-other', content: 'Clan Scout message' }, { ...messages[3]!, id: 'clan-third', content: 'Clan Third message' }]));
  const close = vi.fn();
  const view = render(<QueryClientProvider client={client}><ApiProvider api={api}><ChatHost accountId={accountId} onClose={close} onFocusPlanet={vi.fn()} /></ApiProvider></QueryClientProvider>);
  return { ...view, client, api, mark, close };
}
function actions(id: string) {
  const bubble = document.querySelector(`[data-chat-message="${id}"]`);
  if (!bubble) throw new Error(`Missing message ${id}`);
  fireEvent.contextMenu(bubble);
}
async function muteScout() {
  actions('other-one');
  await userEvent.click(screen.getByRole('button', { name: 'Mute Scout' }));
}
beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

describe('personal chat mute controls', () => {
  it('opens the middle mute action by long press and immediately hides every message by that author', async () => {
    const { mark } = show();
    vi.useFakeTimers();
    fireEvent.pointerDown(document.querySelector('[data-chat-message="other-one"]')!);
    act(() => { vi.advanceTimersByTime(450); });
    const mute = screen.getByRole('button', { name: 'Mute Scout' });
    expect(mute.previousElementSibling).toHaveAccessibleName('Add emoji reaction');
    expect(mute.nextElementSibling).toHaveAccessibleName('Reply');
    fireEvent.click(mute);
    vi.useRealTimers();
    expect(screen.queryByText('First Scout message')).not.toBeInTheDocument();
    expect(screen.queryByText('Last Scout message')).not.toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
    expect(screen.getByText('Admin message')).toBeInTheDocument();
    await waitFor(() => { expect(mark).toHaveBeenCalledWith('en', 'other-two'); });
  });
  it.each(['mine', 'admin'])('never offers mute on protected message %s', id => {
    show(); actions(id);
    expect(document.querySelector('[data-chat-mute]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
  });
  it('keeps general and clan muting separate from DM blocking', async () => {
    show(); await muteScout();
    await userEvent.click(screen.getByRole('tab', { name: /^clan$/i }));
    expect(screen.queryByText('Clan Scout message')).not.toBeInTheDocument();
    expect(screen.getByText('Clan Third message')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^dm$/i }));
    expect(await screen.findByText('Private Scout message')).toBeInTheDocument();
    actions('private');
    expect(document.querySelector('[data-chat-mute]')).toBeNull();
  });
  it('filters fresh and older-page messages while preserving unrelated authors', async () => {
    const { client } = show(); await muteScout();
    act(() => { client.setQueryData(keys.chatMessagesFor('en'), { pages: [
      { messages: [...messages, { ...messages[2]!, id: 'fresh', content: 'Fresh muted message' }], nextBefore: 'earlier' },
      { messages: [{ ...messages[2]!, id: 'old', content: 'Older muted message' }, { ...messages[3]!, id: 'old-third', content: 'Older visible message' }], nextBefore: null },
    ], pageParams: [null, 'earlier'] }); });
    expect(screen.queryByText('Fresh muted message')).not.toBeInTheDocument();
    expect(screen.queryByText('Older muted message')).not.toBeInTheDocument();
    expect(await screen.findByText('Older visible message')).toBeInTheDocument();
  });
  it('opens the named header control and restores cached messages when unmuted', async () => {
    show(); await muteScout();
    const manager = screen.getByRole('button', { name: 'Muted players' });
    const heading = screen.getByRole('heading', { name: 'Chat' });
    expect(manager.parentElement).toContainElement(heading);
    await userEvent.click(manager);
    const list = screen.getByRole('dialog', { name: 'Muted players' });
    expect(within(list).getByText('Scout')).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Unmute Scout' }));
    expect(within(list).getByText('No muted players.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Muted players' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByText('First Scout message')).toBeInTheDocument();
  });
  it('remembers the mute on reopen without applying it to another signed-in account', async () => {
    const first = show(); await muteScout(); first.unmount();
    const same = show();
    expect(screen.queryByText('First Scout message')).not.toBeInTheDocument(); same.unmount();
    show('account-b');
    expect(screen.getByText('First Scout message')).toBeInTheDocument();
  });
  it('keeps already-muted authors hidden after changing the general chat language', async () => {
    show(); await muteScout();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chat language' }), 'tr');
    expect(screen.queryByText('First Scout message')).not.toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
  });
  it('protects admin and own messages even if their IDs were stored as muted', () => {
    localStorage.setItem('astera.chat.mutes.v1:account-a', JSON.stringify([
      { playerId: 'admin', username: 'Admin' }, { playerId: 'self', username: 'Me' },
    ]));
    show();
    expect(screen.getByText('Admin message')).toBeInTheDocument();
    expect(screen.getByText('Own message')).toBeInTheDocument();
  });
  it('keeps the session mute and unmute usable when storage writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    show(); await muteScout();
    expect(screen.queryByText('First Scout message')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Muted players' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unmute Scout' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('First Scout message')).toBeInTheDocument();
  });
  it('shows an honest empty state when all cached messages are personally hidden', async () => {
    const { client } = show(); await muteScout();
    act(() => { client.setQueryData(keys.chatMessagesFor('en'), page(messages.filter(message => message.authorPlayerId === 'other'))); });
    expect(await screen.findByText('No visible messages.')).toBeInTheDocument();
  });
  it('keeps older unmuted history reachable when the latest page is entirely muted', async () => {
    const { client, api } = show(); await muteScout();
    const older = vi.spyOn(api, 'chatMessages').mockResolvedValue({
      messages: [{ ...messages[3]!, id: 'older-third', content: 'Earlier conversation', language: 'en' }], nextBefore: null,
    });
    act(() => { client.setQueryData(keys.chatMessagesFor('en'), {
      pages: [{ messages: messages.filter(message => message.authorPlayerId === 'other'), nextBefore: 'older-cursor' }], pageParams: [null],
    }); });
    expect(await screen.findByText('No visible messages.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    expect(await screen.findByText('Earlier conversation')).toBeInTheDocument();
    expect(older).toHaveBeenCalledWith('en', 'older-cursor');
    expect(screen.queryByText('First Scout message')).not.toBeInTheDocument();
  });
});
