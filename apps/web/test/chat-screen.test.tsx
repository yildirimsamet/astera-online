import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n, { currentLanguage } from '../src/i18n/index.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';
import { LANGUAGES } from '../src/i18n/languages.js';

const at = new Date('2026-08-22T08:00:00.000Z');
const scrollIntoView = vi.fn();
const initial = {
  pages: [{
    messages: [
      { id: 'one', authorPlayerId: 'other', planetId: 'other-planet', username: 'İzci', content: 'Merhaba galaksi', language: 'en', createdAt: at, self: false },
      { id: 'hidden', authorPlayerId: 'hidden', username: 'Gizli', content: 'Beni bulamazsın', language: 'en', createdAt: new Date(at.getTime() + 500), self: false },
      { id: 'two', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Buradayım', language: 'en', createdAt: new Date(at.getTime() + 1000), self: true },
    ],
    nextBefore: null,
  }],
  pageParams: [null],
};

function show(
  onFocusPlanet = vi.fn(),
  initialChannel: 'general' | 'clan' = 'general',
  generalData: unknown = initial,
  initialClanDraft?: string,
) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  const post = vi.spyOn(api, 'postChat').mockResolvedValue({
    message: {
      id: 'three', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Yeni mesaj', language: 'en',
      createdAt: new Date(at.getTime() + 2000), self: true,
    },
  });
  vi.spyOn(api, 'markClanChatRead').mockResolvedValue({ readAt: at });
  const postClan = vi.spyOn(api, 'postClanChat').mockResolvedValue({
    message: {
      id: 'clan-two', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage',
      content: 'Klan hazır', createdAt: new Date(at.getTime() + 3000), self: true,
    },
  });
  vi.spyOn(api, 'reactToMessage').mockResolvedValue({ reactions: [{ emoji: '👍', count: 1, mine: true }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const language = currentLanguage();
  client.setQueryData(keys.chatMessagesFor(language), generalData);
  client.setQueryData(keys.chatUnreadFor(language), { count: 1 });
  client.setQueryData(keys.clanBadge, {
    available: true,
    membership: {
      clanId: 'clan-war', name: 'War Fleet', tag: 'WAR', role: 'MEMBER',
      matureAt: at, mature: true,
    },
    attention: true,
    attentionCount: 1,
    clanChatUnread: 1,
  });
  client.setQueryData(keys.clanChat, {
    pages: [{
      messages: [{
        id: 'clan-one', authorPlayerId: 'other', planetId: 'other-planet', username: 'İzci',
        clanTag: 'WAR', content: 'Rim temiz', createdAt: at, self: false,
      }],
      nextBefore: null,
    }],
    pageParams: [null],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  const { unmount } = render(<Wrapper><ChatScreen initialChannel={initialChannel} onFocusPlanet={onFocusPlanet} {...(initialClanDraft ? { initialClanDraft } : {})} /></Wrapper>);
  return { api, post, postClan, client, onFocusPlanet, unmount };
}

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.removeItem('astera.chat.language.v1');
  await i18n.changeLanguage('en');
});

describe('galaxy chat surface', () => {
  it('marks each previous-season podium place with a quiet border and a cup beside the author', () => {
    show(vi.fn(), 'general', {
      pages: [{ messages: initial.pages[0]!.messages.map((message, index) => ({
        ...message, previousSeasonRank: index + 1,
      })), nextBefore: null }], pageParams: [null],
    });
    const metals = ['gold', 'silver', 'copper'];
    initial.pages[0]!.messages.forEach((message, index) => {
      const bubble = document.querySelector(`[data-chat-message="${message.id}"]`)!;
      expect(bubble).toHaveClass(`border-rank-${metals[index]}/35`);
      const icon = bubble.querySelector('[data-chat-podium-icon]');
      expect(icon).toHaveAttribute('aria-label', `Previous season · place ${index + 1}`);
      expect(icon?.previousElementSibling).toHaveAttribute('data-chat-author');
      expect(icon?.querySelector('svg')).not.toBeNull();
    });
  });

  it('keeps a legacy message free of a previous-season cup', () => {
    show();
    expect(document.querySelector('[data-chat-podium-icon]')).toBeNull();
  });
  it('keeps reaction controls outside the message bubble and omits redundant initials', async () => {
    show();
    const bubble = document.querySelector('[data-chat-message="one"]')!;
    expect(screen.queryByText('İZ')).not.toBeInTheDocument();
    fireEvent.contextMenu(bubble);
    const addReaction = screen.getByRole('button', { name: 'Add emoji reaction' });
    expect(bubble).not.toContainElement(addReaction);
    await userEvent.setup().click(addReaction);
    const picker = screen.getByRole('group', { name: 'Choose an emoji' });
    expect(bubble).not.toContainElement(picker);
    expect(picker.querySelectorAll('button')).toHaveLength(6);
  });

  it('keeps the empty composer compact and reveals the character count near its limit', () => {
    show();
    expect(screen.queryByText('280 characters left')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message the galaxy' }), { target: { value: 'a'.repeat(280) } });
    expect(screen.getByText('0 characters left')).toBeInTheDocument();
  });

  it('closes the previous emoji picker when opening actions on another message', async () => {
    show();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="one"]')!);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add emoji reaction' }));
    expect(screen.getByRole('group', { name: 'Choose an emoji' })).toBeInTheDocument();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="hidden"]')!);
    expect(screen.queryByRole('group', { name: 'Choose an emoji' })).not.toBeInTheDocument();
  });

  it('closes message actions when clicking outside the action bar', async () => {
    show();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="one"]')!);
    expect(document.querySelector('[data-chat-message-actions]')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('textbox', { name: 'Message the galaxy' }));
    expect(document.querySelector('[data-chat-message-actions]')).not.toBeInTheDocument();
  });

  it('closes the emoji picker and message actions on an outside click', async () => {
    show();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="one"]')!);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add emoji reaction' }));
    const picker = screen.getByRole('group', { name: 'Choose an emoji' });
    fireEvent.pointerDown(picker);
    expect(picker).toBeInTheDocument();

    await userEvent.setup().click(document.body);
    expect(screen.queryByRole('group', { name: 'Choose an emoji' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-chat-message-actions]')).not.toBeInTheDocument();
  });

  it('opens actions by long press and sends a quoted General reply', async () => {
    const { post } = show();
    const user = userEvent.setup();
    const bubble = document.querySelector('[data-chat-message="one"]')!;
    fireEvent.pointerDown(bubble);
    await new Promise((resolve) => setTimeout(resolve, 500));
    fireEvent.pointerUp(bubble);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Replying to İzci')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'I agree');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'I agree', 'one'); });
  });

  it('opens the same actions by double click and sends a quoted General reply', async () => {
    const { post } = show();
    const user = userEvent.setup();
    await user.dblClick(screen.getByText('Merhaba galaksi'));
    expect(screen.getByRole('button', { name: 'Add emoji reaction' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'Double-click reply');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'Double-click reply', 'one'); });
  });

  it('opens Clan emoji actions by double click', async () => {
    const { api } = show(vi.fn(), 'clan');
    const user = userEvent.setup();
    await user.dblClick(screen.getByText('Rim temiz'));
    await user.click(screen.getByRole('button', { name: 'Add emoji reaction' }));
    await user.click(screen.getByRole('button', { name: 'React with 👍' }));
    await waitFor(() => { expect(api.reactToMessage).toHaveBeenCalledWith('clan', 'clan-one', '👍'); });
  });

  it('does not open actions on a single click', async () => {
    show();
    await userEvent.click(screen.getByText('Merhaba galaksi'));
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it('keeps a double click on the commander link separate from message actions', () => {
    show();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'İzci' }));
    expect(screen.queryByRole('button', { name: 'Add emoji reaction' })).not.toBeInTheDocument();
  });

  it('keeps keyboard activation of a commander link separate from message actions', () => {
    show();
    fireEvent.keyDown(screen.getByRole('button', { name: 'İzci' }), { key: 'Enter' });
    expect(screen.queryByRole('button', { name: 'Add emoji reaction' })).not.toBeInTheDocument();
  });

  it('keeps a quoted reply with its channel when switching tabs', async () => {
    const { post } = show();
    const user = userEvent.setup();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="one"]')!);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'Still replying');
    await user.click(screen.getByRole('tab', { name: /Clan/ }));
    await user.click(screen.getByRole('tab', { name: /General/ }));
    expect(screen.getByText('Replying to İzci')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'Still replying', 'one'); });
  });

  it('sends a Clan reaction from the shared message actions', async () => {
    const { api } = show(vi.fn(), 'clan');
    fireEvent.contextMenu(document.querySelector('[data-chat-message="clan-one"]')!);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add emoji reaction' }));
    await user.click(screen.getByRole('button', { name: 'React with 👍' }));
    await waitFor(() => { expect(api.reactToMessage).toHaveBeenCalledWith('clan', 'clan-one', '👍'); });
  });

  it('opens the public chat in the application language', async () => {
    await i18n.changeLanguage('fr');
    show();
    expect(screen.getByRole('combobox', { name: 'Langue du chat' })).toHaveValue('fr');
  });

  it('reopens on the last chosen chat language while the application stays English', async () => {
    const { unmount } = show();
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Chat language' }), 'tr');
    unmount();

    show();
    expect(screen.getByRole('combobox', { name: 'Chat language' })).toHaveValue('tr');
    expect(i18n.resolvedLanguage).toBe('en');
  });

  it('keeps the saved chat language when the application language changes', async () => {
    const { unmount } = show();
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Chat language' }), 'tr');
    unmount();

    await i18n.changeLanguage('fr');
    show();
    expect(screen.getByRole('combobox', { name: 'Langue du chat' })).toHaveValue('tr');
    expect(i18n.resolvedLanguage).toBe('fr');
  });

  it('restores a valid saved chat language on a fresh screen', () => {
    localStorage.setItem('astera.chat.language.v1', 'ja');
    show();
    expect(screen.getByRole('combobox', { name: 'Chat language' })).toHaveValue('ja');
  });

  it('falls back to the application language for an unsupported saved chat language', async () => {
    localStorage.setItem('astera.chat.language.v1', 'invalid');
    await i18n.changeLanguage('fr');
    show();
    expect(screen.getByRole('combobox', { name: 'Langue du chat' })).toHaveValue('fr');
  });

  it('can still open and switch chat languages when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    show();
    const select = screen.getByRole('combobox', { name: 'Chat language' });
    expect(select).toHaveValue('en');
    await userEvent.setup().selectOptions(select, 'tr');
    expect(select).toHaveValue('tr');
  });

  it('switches the public chat language without changing the app language', async () => {
    const user = userEvent.setup();
    show();
    const select = screen.getByRole('combobox', { name: 'Chat language' });
    expect(select).toHaveValue('en');

    await user.selectOptions(select, 'fr');
    expect(select).toHaveValue('fr');
    expect(i18n.resolvedLanguage).toBe('en');

    await user.selectOptions(select, 'ja');
    expect(select).toHaveValue('ja');
    expect(i18n.resolvedLanguage).toBe('en');
  });

  it('keeps each language’s history and unsent draft in its own chat', async () => {
    const user = userEvent.setup();
    const { client } = show();
    client.setQueryData(keys.chatMessagesFor('fr'), {
      pages: [{
        messages: [{ ...initial.pages[0]!.messages[0]!, id: 'fr-one', content: 'Bonsoir', language: 'fr' }],
        nextBefore: null,
      }],
      pageParams: [null],
    });
    const select = screen.getByRole('combobox', { name: 'Chat language' });
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'English draft');
    await user.selectOptions(select, 'fr');
    expect(screen.getByText('Bonsoir')).toBeInTheDocument();
    expect(screen.queryByText('Merhaba galaksi')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message the galaxy' })).toHaveValue('');
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'Brouillon français');
    await user.selectOptions(select, 'en');
    expect(screen.getByRole('textbox', { name: 'Message the galaxy' })).toHaveValue('English draft');
    await user.selectOptions(select, 'fr');
    expect(screen.getByRole('textbox', { name: 'Message the galaxy' })).toHaveValue('Brouillon français');
  });
  it('keeps the composer outside the independently scrolling message history', () => {
    show();
    const history = screen.getByRole('log', { name: 'Galaxy messages' });
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    expect(history).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(composer.closest('form')).toHaveClass('shrink-0');
    expect(history.parentElement).toBe(composer.closest('form')?.parentElement);
  });

  it('switches between General and Clan without mixing their messages or read markers', async () => {
    const { api } = show();
    expect(screen.getByRole('tab', { name: 'General — 1 unread' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Merhaba galaksi')).toBeInTheDocument();
    expect(screen.queryByText('Rim temiz')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Clan — 1 unread' }));
    expect(screen.queryByRole('combobox', { name: 'Chat language' })).not.toBeInTheDocument();
    expect(screen.queryByText('Merhaba galaksi')).not.toBeInTheDocument();
    expect(screen.getByText('Rim temiz')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message your clan' })).toBeEnabled();
    await waitFor(() => { expect(api.markClanChatRead).toHaveBeenCalledWith('clan-one'); });
  });

  /** A report told to the clan (M4, "Klana") arrives as a draft: the reader sends it, or edits it. */
  it('opens the clan composer with a draft it was handed, and sends only on the reader’s press', async () => {
    const { postClan } = show(vi.fn(), 'clan', initial, 'Partial victory at Kestrel');
    const composer = screen.getByRole('textbox', { name: 'Message your clan' });
    expect(composer).toHaveValue('Partial victory at Kestrel');
    expect(postClan).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(postClan).toHaveBeenCalledWith('Partial victory at Kestrel'); });
  });

  it('posts from the selected clan channel', async () => {
    const { postClan } = show(vi.fn(), 'clan');
    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: 'Message your clan' });
    await user.type(composer, ' Klan hazır ');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(postClan).toHaveBeenCalledWith('Klan hazır'); });
    expect(await screen.findByText('Klan hazır')).toBeInTheDocument();
  });

  it('shows commander usernames and messages, never planet identity', async () => {
    const { api } = show();
    expect(screen.getByText('İzci')).toBeInTheDocument();
    expect(screen.getByText('Merhaba galaksi')).toBeInTheDocument();
    expect(screen.queryByText(/planet/i)).not.toBeInTheDocument();
    await waitFor(() => { expect(api.markChatRead).toHaveBeenCalledWith('en', 'two'); });
  });

  it('shows clan tags beside names in both channels, while leaving untagged names plain', async () => {
    const tagged = {
      pages: [{ ...initial.pages[0]!, messages: [
        { ...initial.pages[0]!.messages[0]!, clanTag: 'OG' },
        ...initial.pages[0]!.messages.slice(1),
      ] }],
      pageParams: [null],
    };
    show(vi.fn(), 'general', tagged);
    expect(screen.getByRole('button', { name: '[OG] İzci' })).toBeInTheDocument();
    expect(screen.getByText('Gizli')).toBeInTheDocument();
    expect(screen.getByText('Vantage')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Clan — 1 unread' }));
    expect(screen.getByText('[WAR] İzci')).toBeInTheDocument();
  });

  it('underlines and routes only commanders whose location is known', async () => {
    const { onFocusPlanet } = show();
    const username = screen.getByRole('button', { name: 'İzci' });
    expect(username).toHaveClass('underline');
    expect(screen.getByText('Gizli')).not.toHaveClass('underline');
    expect(screen.queryByRole('button', { name: 'Gizli' })).not.toBeInTheDocument();
    await userEvent.setup().click(username);
    expect(onFocusPlanet).toHaveBeenCalledWith('other-planet');
    expect(screen.queryByRole('button', { name: 'Vantage' })).not.toBeInTheDocument();
  });

  it('renders the authoritative posted message and clears the composer', async () => {
    const { post, client } = show();
    const cancel = vi.spyOn(client, 'cancelQueries');
    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    await user.type(composer, '  Yeni mesaj  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'Yeni mesaj'); });
    expect(cancel).toHaveBeenCalledWith({ queryKey: keys.chatMessagesFor('en') });
    expect(await screen.findByText('Yeni mesaj')).toBeInTheDocument();
    expect(composer).toHaveValue('');
  });

  it.each(['general', 'clan'] as const)('sends %s with Enter and keeps focus in the cleared composer', async (channel) => {
    const { post, postClan } = show(vi.fn(), channel);
    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: channel === 'general' ? 'Message the galaxy' : 'Message your clan' });
    await user.type(composer, '  Ready  ');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      if (channel === 'general') expect(post).toHaveBeenCalledWith('en', 'Ready');
      else expect(postClan).toHaveBeenCalledWith('Ready');
    });
    expect(composer).toHaveValue('');
    expect(composer).toHaveFocus();
  });

  it('keeps Shift+Enter as a newline and sends both lines with Enter', async () => {
    const { post } = show();
    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    await user.type(composer, 'First line');
    await user.keyboard('{Shift>}{Enter}{/Shift}Second line');
    expect(composer).toHaveValue('First line\nSecond line');
    expect(post).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'First line\nSecond line'); });
  });

  it('sends Enter in the selected language without changing another language’s draft', async () => {
    const { post, client } = show();
    client.setQueryData(keys.chatMessagesFor('tr'), initial);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'English draft');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chat language' }), 'tr');
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'Merhaba');
    await user.keyboard('{Enter}');
    await waitFor(() => { expect(post).toHaveBeenCalledWith('tr', 'Merhaba'); });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chat language' }), 'en');
    expect(screen.getByRole('textbox', { name: 'Message the galaxy' })).toHaveValue('English draft');
  });

  it('preserves a quoted reply when sending with Enter', async () => {
    const { post } = show();
    const user = userEvent.setup();
    fireEvent.contextMenu(document.querySelector('[data-chat-message="one"]')!);
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByRole('textbox', { name: 'Message the galaxy' }), 'Agreed');
    await user.keyboard('{Enter}');
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'Agreed', 'one'); });
    expect(screen.queryByText('Replying to İzci')).not.toBeInTheDocument();
  });

  it.each(['', '   '])('ignores Enter for an empty or whitespace-only draft %j without inserting a newline', async (draft) => {
    const { post } = show();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    fireEvent.change(composer, { target: { value: draft } });
    const user = userEvent.setup();
    await user.click(composer);
    await user.keyboard('{Enter}');
    expect(post).not.toHaveBeenCalled();
    expect(composer).toHaveValue(draft);
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])('does not send Enter while an IME is selecting text (%j)', async (ime) => {
    const { post } = show();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    fireEvent.change(composer, { target: { value: 'こんにちは' } });
    fireEvent.keyDown(composer, { key: 'Enter', ...ime });
    expect(post).not.toHaveBeenCalled();
    expect(composer).toHaveValue('こんにちは');
    const user = userEvent.setup();
    await user.click(composer);
    await user.keyboard('{Enter}');
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'こんにちは'); });
  });

  it('ignores held Enter repeats without inserting a newline', () => {
    const { post } = show();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    fireEvent.change(composer, { target: { value: 'Ready' } });
    expect(fireEvent.keyDown(composer, { key: 'Enter', repeat: true })).toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect(composer).toHaveValue('Ready');
  });

  it('keeps the draft after a failed Enter send', async () => {
    const { post } = show();
    post.mockRejectedValueOnce(new Error('Network unavailable'));
    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    await user.type(composer, 'Keep this draft');
    await user.keyboard('{Enter}');
    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'Keep this draft'); });
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled(); });
    expect(composer).toHaveValue('Keep this draft');
  });

  it('does not send again while the first Enter request is pending', async () => {
    const { post } = show();
    let finish: ((value: Awaited<ReturnType<Api['postChat']>>) => void) | undefined;
    post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    await user.type(composer, 'One request');
    await user.keyboard('{Enter}');
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled(); });
    await user.keyboard('{Enter}{Enter}');
    expect(post).toHaveBeenCalledTimes(1);
    expect(composer).toHaveValue('One request');
    if (!finish) throw new Error('Post did not start');
    finish({ message: { id: 'posted', authorPlayerId: 'mine', username: 'Vantage', content: 'One request', language: 'en', createdAt: at, self: true } });
    await waitFor(() => { expect(composer).toHaveValue(''); });
  });

  it('scrolls only the message history after posting, never the page viewport', async () => {
    const { post } = show();
    const history = screen.getByRole('log', { name: 'Galaxy messages' });
    Object.defineProperty(history, 'scrollHeight', { configurable: true, value: 900 });
    history.scrollTop = 0;
    scrollIntoView.mockClear();

    const user = userEvent.setup();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    await user.type(composer, 'Yeni mesaj');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => { expect(post).toHaveBeenCalledWith('en', 'Yeni mesaj'); });
    await waitFor(() => { expect(history.scrollTop).toBe(900); });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('loads older messages at the top without a button or a viewport jump', async () => {
    const newestPage = {
      pages: [{
        messages: [
          { id: 'two', authorPlayerId: 'other', username: 'İzci', content: 'İkinci', createdAt: at, self: false },
          { id: 'three', authorPlayerId: 'mine', username: 'Vantage', content: 'Üçüncü', createdAt: new Date(at.getTime() + 1000), self: true },
        ],
        nextBefore: 'older-cursor',
      }],
      pageParams: [null],
    };
    const { api } = show(vi.fn(), 'general', newestPage);
    const history = screen.getByRole('log', { name: 'Galaxy messages' });
    let scrollHeight = 600;
    Object.defineProperties(history, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
    });
    const older = vi.spyOn(api, 'chatMessages').mockImplementation(() => {
      scrollHeight = 900;
      return Promise.resolve({
        messages: [
          { id: 'zero', authorPlayerId: 'other', username: 'Sable', content: 'Sıfırıncı', language: 'en', createdAt: new Date(at.getTime() - 2000), self: false },
          { id: 'one', authorPlayerId: 'other', username: 'Sable', content: 'Birinci', language: 'en', createdAt: new Date(at.getTime() - 1000), self: false },
        ],
        nextBefore: null,
      });
    });
    history.scrollTop = 0;

    fireEvent.scroll(history);

    expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
    await waitFor(() => { expect(older).toHaveBeenCalledWith('en', 'older-cursor'); });
    expect(await screen.findByText('Sıfırıncı')).toBeInTheDocument();
    await waitFor(() => { expect(history.scrollTop).toBe(300); });
  });

  it('stays on older messages when a new message arrives', async () => {
    const { api, client } = show();
    const history = screen.getByRole('log', { name: 'Galaxy messages' });
    let scrollHeight = 900;
    Object.defineProperties(history, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
    });
    history.scrollTop = 240;
    fireEvent.scroll(history);
    await waitFor(() => { expect(api.markChatRead).toHaveBeenCalledWith('en', 'two'); });
    vi.mocked(api.markChatRead).mockClear();

    scrollHeight = 980;
    act(() => {
      client.setQueryData(keys.chatMessagesFor('en'), {
        pages: [{
          messages: [
            ...initial.pages[0]!.messages,
            { id: 'four', authorPlayerId: 'other', username: 'Sable', content: 'Yeni gelen', createdAt: new Date(at.getTime() + 2000), self: false },
          ],
          nextBefore: null,
        }],
        pageParams: [null],
      });
    });

    expect(await screen.findByText('Yeni gelen')).toBeInTheDocument();
    expect(history.scrollTop).toBe(240);
    expect(api.markChatRead).not.toHaveBeenCalled();

    history.scrollTop = 680;
    fireEvent.scroll(history);
    await waitFor(() => { expect(api.markChatRead).toHaveBeenCalledWith('en', 'four'); });
  });

  it('continues following new messages while already at the bottom', async () => {
    const { client } = show();
    const history = screen.getByRole('log', { name: 'Galaxy messages' });
    let scrollHeight = 900;
    Object.defineProperties(history, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
    });
    history.scrollTop = 600;
    fireEvent.scroll(history);

    scrollHeight = 980;
    act(() => {
      client.setQueryData(keys.chatMessagesFor('en'), {
        pages: [{
          messages: [
            ...initial.pages[0]!.messages,
            { id: 'four', authorPlayerId: 'other', username: 'Sable', content: 'Takip edilen', createdAt: new Date(at.getTime() + 2000), self: false },
          ],
          nextBefore: null,
        }],
        pageParams: [null],
      });
    });

    expect(await screen.findByText('Takip edilen')).toBeInTheDocument();
    await waitFor(() => { expect(history.scrollTop).toBe(980); });
  });

  it('keeps a Unicode draft to 280 visible characters', () => {
    show();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    // One change event tests the Unicode clipping rule directly. Typing 281
    // surrogate-pair glyphs through user-event made this deterministic assertion
    // consume the whole five-second file budget under concurrent package load.
    fireEvent.change(composer, { target: { value: '🌌'.repeat(281) } });
    expect(Array.from((composer as HTMLTextAreaElement).value)).toHaveLength(280);
    expect(screen.getByText('0 characters left')).toBeInTheDocument();
  });

  it('localises the panel in Turkish', async () => {
    await i18n.changeLanguage('tr');
    show();
    expect(screen.getByRole('log', { name: 'Galaksi mesajları' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gönder' })).toBeInTheDocument();
  });

});

describe('the admin speaking in chat', () => {
  const adminMessages = () => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.chatMessagesFor('en'), {
      pages: [{
        messages: [
          { id: 'm-admin', authorPlayerId: 'boss', username: 'Yönetici',
            content: 'duyuru', createdAt: at, self: false, admin: true },
          { id: 'm-player', authorPlayerId: 'other', username: 'Sable',
            content: 'selam', createdAt: new Date(at.getTime() + 1000), self: false },
        ],
        nextBefore: null,
      }],
      pageParams: [null],
    });
    client.setQueryData(keys.chatUnreadFor('en'), { count: 0 });
    return render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <ChatScreen onFocusPlanet={vi.fn()} />
        </ApiProvider>
      </QueryClientProvider>,
    );
  };

  it('separates the admin from the gold podium with a quiet rose border and name', () => {
    const view = adminMessages();
    const row = view.container.querySelector('[data-chat-message="m-admin"]')!;
    expect(row).toHaveClass('border-chat-admin/35');
    expect(row.querySelector('[data-chat-author]')).toHaveClass('text-chat-admin-ink');
    expect(row).not.toHaveClass('border-v2-premium/35');
  });

  it('leaves an ordinary commander untouched', () => {
    const view = adminMessages();
    const row = view.container.querySelector('[data-chat-message="m-player"]');
    expect(row!.className).not.toContain('border-chat-admin');
    expect(row!.querySelector('[data-chat-author]')!.className).not.toContain('text-chat-admin-ink');
  });
});


describe('permanent supporter recognition', () => {
  it('shows the heart for supporters in all author layouts without changing ordinary messages', () => {
    show(vi.fn(), 'general', {
      ...initial,
      pages: [{ ...initial.pages[0], messages: initial.pages[0]!.messages.map((message) => ({ ...message, supporter: true })) }],
    });
    for (const message of initial.pages[0]!.messages) {
      const bubble = document.querySelector(`[data-chat-message="${message.id}"]`)!;
      expect(bubble).toHaveClass('border-chat-supporter/35');
      const heart = bubble.querySelector('[data-chat-supporter-icon]');
      expect(heart).toHaveAttribute('aria-label', 'Astera supporter');
      expect(heart?.querySelector('svg')).not.toBeNull();
      expect(bubble.querySelector('[data-chat-podium-icon]')).toBeNull();
    }
  });

  it.each([1, 2, 3] as const)('keeps place %s border and shows a heart beside the earned cup', (rank) => {
    const data = { ...initial, pages: [{ ...initial.pages[0], messages: [
      { ...initial.pages[0]!.messages[0], supporter: true, previousSeasonRank: rank },
    ] }] };
    show(vi.fn(), 'general', data);
    const bubble = document.querySelector('[data-chat-message="one"]')!;
    const metal = { 1: 'gold', 2: 'silver', 3: 'copper' }[rank];
    expect(bubble).toHaveClass(`border-rank-${metal}/35`);
    expect(bubble).not.toHaveClass('border-chat-supporter/35');
    const heart = bubble.querySelector('[data-chat-supporter-icon]');
    expect(heart).toHaveAttribute('aria-label', 'Astera supporter');
    expect(heart?.nextElementSibling).toHaveAttribute('data-chat-podium-icon');
  });

  it('keeps admin authority rose while showing both independent earned badges', () => {
    show(vi.fn(), 'general', { ...initial, pages: [{ ...initial.pages[0], messages: [
      { ...initial.pages[0]!.messages[2], admin: true, supporter: true, previousSeasonRank: 1 },
    ] }] });
    const bubble = document.querySelector('[data-chat-message="two"]')!;
    expect(bubble).toHaveClass('border-chat-admin/35');
    expect(bubble.querySelector('[data-chat-author]')).toHaveClass('text-chat-admin-ink');
    expect(bubble.querySelector('[data-chat-supporter-icon]')).not.toBeNull();
    expect(bubble.querySelector('[data-chat-podium-icon]')).not.toBeNull();
  });

  it('removes revoked recognition on a chat refresh and renders it in the clan room', async () => {
    const { client } = show();
    act(() => { client.setQueryData(keys.clanChat, { ...initial, pages: [{ ...initial.pages[0], messages: [
      { ...initial.pages[0]!.messages[0], supporter: true, clanTag: 'WAR' },
    ] }] }); });
    fireEvent.click(screen.getByRole('tab', { name: /Clan/ }));
    expect(document.querySelector('[data-chat-supporter-icon]')).not.toBeNull();
    act(() => { client.setQueryData(keys.clanChat, initial); });
    await waitFor(() => { expect(document.querySelector('[data-chat-supporter-icon]')).toBeNull(); });
  });
});

describe('chat recognition explanations', () => {
  const recognized = () => ({ ...initial, pages: [{ ...initial.pages[0], messages: [
    { ...initial.pages[0]!.messages[0], supporter: true, previousSeasonRank: 1 },
    { ...initial.pages[0]!.messages[1], previousSeasonRank: 2 },
    { ...initial.pages[0]!.messages[2], previousSeasonRank: 3 },
  ] }] });

  it('opens the supporter explanation above its button without focusing the author or opening message actions', () => {
    vi.useFakeTimers();
    vi.stubGlobal('innerWidth', 350);
    const { onFocusPlanet } = show(vi.fn(), 'general', recognized());
    const button = screen.getByRole('button', { name: 'Astera supporter' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(326, 300, 16, 16));
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button).not.toHaveAttribute('title');
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(450); });
    fireEvent.contextMenu(button);
    fireEvent.click(button);

    const hint = screen.getByRole('tooltip');
    expect(hint).toHaveTextContent('Supports Astera Online.');
    expect(button).toHaveAttribute('aria-describedby', hint.id);
    expect(hint).toHaveAttribute('aria-live', 'polite');
    expect(hint.parentElement).toBe(document.body);
    expect(Number.parseFloat(hint.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(hint.style.left) + Number.parseFloat(hint.style.width)).toBeLessThanOrEqual(342);
    expect(Number.parseFloat(hint.style.bottom)).toBeGreaterThan(window.innerHeight - 300);
    expect(onFocusPlanet).not.toHaveBeenCalled();
    expect(document.querySelector('[data-chat-message-actions]')).toBeNull();
  });

  it.each([1, 2, 3])('explains the exact previous-season place %s', (rank) => {
    show(vi.fn(), 'general', recognized());
    fireEvent.click(screen.getByRole('button', { name: `Previous season · place ${rank}` }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(`Finished the previous season in place ${rank}.`);
  });

  it('closes at two seconds and lets a repeated tap restart those two seconds', () => {
    vi.useFakeTimers();
    show(vi.fn(), 'general', recognized());
    const button = screen.getByRole('button', { name: 'Astera supporter' });
    fireEvent.click(button);
    act(() => { vi.advanceTimersByTime(1_500); });
    fireEvent.click(button);
    act(() => { vi.advanceTimersByTime(1_999); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Supports Astera Online.');
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('replaces the previous explanation and cancels its old closing timer', () => {
    vi.useFakeTimers();
    show(vi.fn(), 'general', recognized());
    const heart = screen.getByRole('button', { name: 'Astera supporter' });
    fireEvent.click(heart);
    act(() => { vi.advanceTimersByTime(1_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Previous season · place 1' }));
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(heart).not.toHaveAttribute('aria-describedby');
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Finished the previous season in place 1.');
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('supports keyboard activation and Escape without opening message actions', async () => {
    show(vi.fn(), 'general', recognized());
    screen.getByRole('button', { name: 'Astera supporter' }).focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Supports Astera Online.');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('button', { name: 'Astera supporter' }), escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.querySelector('[data-chat-message-actions]')).toBeNull();
  });

  it.each(['outside', 'scroll', 'resize'] as const)('dismisses an explanation on %s', (action) => {
    show(vi.fn(), 'general', recognized());
    fireEvent.click(screen.getByRole('button', { name: 'Astera supporter' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    if (action === 'outside') fireEvent.pointerDown(document.body);
    else if (action === 'scroll') fireEvent.scroll(screen.getByRole('log'));
    else fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('removes the explanation and its timer when chat closes', () => {
    vi.useFakeTimers();
    const { unmount } = show(vi.fn(), 'general', recognized());
    fireEvent.click(screen.getByRole('button', { name: 'Astera supporter' }));
    unmount();
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it.each(LANGUAGES)('explains both independent badges in %s', async (language) => {
    await i18n.changeLanguage(language);
    show(vi.fn(), 'general', recognized());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('chat.supporterBadge') }));
    const supporter = i18n.t('chat.supporterExplanation');
    expect(supporter).not.toContain('chat.');
    expect(screen.getByRole('tooltip')).toHaveTextContent(supporter);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('chat.previousSeasonPlace', { rank: 2 }) }));
    const podium = i18n.t('chat.previousSeasonExplanation', { rank: 2 });
    expect(podium).not.toContain('chat.');
    expect(screen.getByRole('tooltip')).toHaveTextContent(podium);
    expect(podium).toContain('2');
  });
});
