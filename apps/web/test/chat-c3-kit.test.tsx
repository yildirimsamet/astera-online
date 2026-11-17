import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ChatMediaAttachment } from '../src/screens/ChatMediaAttachment.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';

/**
 * THE CHAT'S CORNERS ON THE KIT (C3, 2026-11-14): a held message answers with the kit's round
 * keys, reactions are chips a thumb can hit, the author's name flies to their world with a tap
 * that sounds, and the private room's letters are the kit's tabs with an empty room that says
 * what to do next.
 */
const { heard, buzz } = vi.hoisted(() => ({ heard: vi.fn(), buzz: vi.fn() }));
vi.mock('../src/lib/sound.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), playSound: heard }));
vi.mock('../src/lib/haptics.js', async (actual) => ({ ...await actual<Record<string, unknown>>(), haptic: buzz }));

const at = new Date('2026-11-14T08:00:00.000Z');
const theirs = {
  id: 'one', authorPlayerId: 'other', planetId: 'other-planet', username: 'Scout', content: 'Hello galaxy', language: 'en', createdAt: at, self: false,
  reactions: [{ emoji: '😂', count: 2, mine: false }, { emoji: '👍', count: 1, mine: true }],
};
const mine = { id: 'two', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Here', language: 'en', createdAt: at, self: true };
const atlas = {
  id: 'thread-1', peer: { playerId: 'peer-1', username: 'Commander Atlas', country: 'TR' },
  lastMessage: { id: 'message-1', content: 'Private hello', createdAt: at },
  unreadCount: 2, blockedByMe: false, canSend: true, unavailableReason: null,
};
const letter = { id: 'message-1', authorPlayerId: 'peer-1', username: 'Commander Atlas', content: 'Private hello', createdAt: at, self: false };

function show({ letters = [atlas], onFocusPlanet = vi.fn(), isAdmin = false }: { letters?: (typeof atlas)[]; onFocusPlanet?: (id: string) => void; isAdmin?: boolean } = {}) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  vi.spyOn(api, 'markDmRead').mockResolvedValue({ readAt: at });
  vi.spyOn(api, 'dmConversations').mockResolvedValue({ conversations: letters, totalUnread: 2 });
  vi.spyOn(api, 'dmUnread').mockResolvedValue({ count: 2 });
  vi.spyOn(api, 'dmMessages').mockResolvedValue({ messages: [letter], nextBefore: null, canSend: true, unavailableReason: null });
  vi.spyOn(api, 'dmContacts').mockResolvedValue({ contacts: [{ playerId: 'peer-2', username: 'Commander Luna', country: 'FR' }] });
  vi.spyOn(api, 'reactToMessage').mockResolvedValue({ reactions: [{ emoji: '😂', count: 3, mine: true }] });
  vi.spyOn(api, 'messageReactionDetails').mockResolvedValue({ participants: [{ playerId: 'p1', username: 'Lyra', emoji: '😂' }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.communityPolicy, { version: COMMUNITY_POLICY_VERSION, acceptedAt: at });
  client.setQueryData(keys.chatMessagesFor('en'), { pages: [{ messages: [theirs, mine], nextBefore: null }], pageParams: [null] });
  client.setQueryData(keys.chatUnreadFor('en'), { count: 0 });
  client.setQueryData(keys.clanBadge, { available: false, membership: null, clanChatUnread: 0 });
  client.setQueryData(keys.dmConversations, { conversations: letters, totalUnread: 2 });
  client.setQueryData(keys.dmUnread, { count: 2 });
  client.setQueryData(keys.dmMessagesFor('thread-1'), { pages: [{ messages: [letter], nextBefore: null, canSend: true, unavailableReason: null }], pageParams: [null] });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><ChatScreen onFocusPlanet={onFocusPlanet} isAdmin={isAdmin} /></Wrapper>);
  return { api };
}

const bubble = (id: string): Element => {
  const found = document.querySelector(`[data-chat-message="${id}"]`);
  if (!found) throw new Error(`Missing bubble ${id}`);
  return found;
};

const openLetters = async (): Promise<void> => {
  await userEvent.setup().click(screen.getByRole('tab', { name: /^DM/ }));
};

afterEach(async () => {
  heard.mockClear();
  buzz.mockClear();
  await i18n.changeLanguage('en');
});

describe('a held message on the kit (C3)', () => {
  it('answers a hold with the kit’s round keys, each with its own mark, and lifts the held bubble', () => {
    show();
    fireEvent.contextMenu(bubble('one'));
    expect(bubble('one')).toHaveAttribute('data-held');
    const keysOfIt = document.querySelector('[data-chat-message-actions]');
    expect(keysOfIt).toHaveClass('gk-keystrip');
    for (const name of ['Add emoji reaction', 'Reply', 'Report', 'Block player']) {
      const key = within(keysOfIt as HTMLElement).getByRole('button', { name });
      expect(key).toHaveClass('gk-round', 'gk-round--small');
      expect(key.querySelector('.gk-glyph')).not.toBeNull();
    }
    expect(bubble('two')).not.toHaveAttribute('data-held');
  });

  it('reacts from the kit’s emoji keys: one tap, one buzz, the chosen one pressed', async () => {
    const { api } = show();
    const user = userEvent.setup();
    fireEvent.contextMenu(bubble('one'));
    await user.click(screen.getByRole('button', { name: 'Add emoji reaction' }));
    const picker = screen.getByRole('group', { name: 'Choose an emoji' });
    expect(picker).toHaveClass('gk-keystrip');
    expect(within(picker).getByRole('button', { name: 'React with 👍' })).toHaveAttribute('aria-pressed', 'true');
    const laugh = within(picker).getByRole('button', { name: 'React with 😂' });
    expect(laugh).toHaveClass('gk-emoji');
    heard.mockClear();
    buzz.mockClear();
    await user.click(laugh);
    await waitFor(() => { expect(api.reactToMessage).toHaveBeenCalledWith('general', 'one', '😂'); });
    expect(heard.mock.calls).toEqual([['tap']]);
    expect(buzz.mock.calls).toEqual([['tap']]);
  });

  it('shows the reactions as chips a thumb can hit, and opens who reacted with a kit close key', async () => {
    show();
    const chips = screen.getByLabelText('Reactions');
    const laugh = within(chips).getByRole('button', { name: '😂 2 reactions' });
    expect(laugh).toHaveClass('gk-react');
    expect(within(chips).getByRole('button', { name: '👍 1 reactions' })).toHaveAttribute('data-mine');
    expect(laugh).not.toHaveAttribute('data-mine');
    await userEvent.setup().click(laugh);
    const roster = screen.getByRole('dialog', { name: 'Reactions' });
    expect(await within(roster).findByText('Lyra')).toBeInTheDocument();
    expect(within(roster).getByRole('button', { name: 'Close' })).toHaveClass('gk-round');
  });

  it('flies to the author’s world with a tap that sounds and buzzes once', async () => {
    const onFocusPlanet = vi.fn();
    show({ onFocusPlanet });
    const author = bubble('one').querySelector('button[data-chat-author]');
    if (!(author instanceof HTMLElement)) throw new Error('Missing author link');
    await userEvent.setup().click(author);
    expect(onFocusPlanet).toHaveBeenCalledWith('other-planet');
    expect(heard.mock.calls).toEqual([['tap']]);
    expect(buzz.mock.calls).toEqual([['tap']]);
  });
});

describe('the private room on the kit (C3)', () => {
  it('lays the open letters out as the kit’s peer tabs, each with a red count and its own close key', async () => {
    show();
    await openLetters();
    const tab = screen.getByRole('tab', { name: 'Commander Atlas — 2 unread' });
    expect(tab).toHaveClass('gk-peer__tab');
    expect(tab.closest('.gk-peer')?.querySelector('.gk-dot')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Close Commander Atlas tab' })).toHaveClass('gk-peer__close');
    expect(screen.getByRole('button', { name: 'Start a DM' })).toHaveClass('gk-round');
  });

  it('says an empty private room on the kit and opens a new letter from its own button', async () => {
    show({ letters: [] });
    await openLetters();
    expect(screen.queryByRole('tablist', { name: 'Direct message conversations' })).toBeNull();
    const empty = document.querySelector('.gk-empty');
    expect(empty?.querySelector('.gk-empty__title')).toHaveTextContent('No private messages yet');
    expect(empty?.querySelector('.gk-empty__body')).toHaveTextContent('Choose a commander to start a private conversation.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Start a DM' }));
    expect(screen.getByRole('searchbox', { name: 'Find a commander' })).toHaveClass('gk-field__input');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('gk-btn');
    const luna = await screen.findByRole('button', { name: 'Commander Luna' });
    expect(luna).toHaveClass('gk-contact');
    heard.mockClear();
    await user.click(luna);
    expect(heard.mock.calls).toEqual([['tap']]);
    expect(screen.getByRole('tab', { name: 'Commander Luna' })).toHaveAttribute('aria-selected', 'true');
  });

  /** Not the round key of the blocked list above it: a word says what this one does, to whom (C3). */
  it('blocks with a kit key that says it, and a second press while it is on its way sends nothing more', async () => {
    const { api } = show();
    let release: (value: { blocked: boolean }) => void = () => undefined;
    const block = vi.spyOn(api, 'blockDm').mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await openLetters();
    const key = screen.getByRole('button', { name: 'Block Commander Atlas' });
    expect(key).toHaveClass('gk-btn', 'gk-btn--sm', 'gk-btn--danger');
    expect(key).toHaveTextContent('Block');
    const user = userEvent.setup();
    await user.click(key);
    await user.click(key);
    expect(block).toHaveBeenCalledTimes(1);
    release({ blocked: true });
  });
});

describe('the operator’s media on the kit (C3)', () => {
  it('adds media from the kit’s buttons', async () => {
    show({ isAdmin: true });
    const add = screen.getByRole('button', { name: 'Add media' });
    expect(add).toHaveClass('gk-btn');
    await userEvent.setup().click(add);
    for (const name of ['Photo', 'Video', 'YouTube video']) expect(screen.getByRole('button', { name })).toHaveClass('gk-btn');
  });

  it('opens a photo full screen and closes it with the kit’s round key', async () => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    render(<ApiProvider api={api}><ChatMediaAttachment media={{ kind: 'image', assetId: 'a1', mimeType: 'image/webp' }} /></ApiProvider>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open photo' }));
    const close = within(screen.getByRole('dialog', { name: 'Photo' })).getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('gk-round');
  });
});
