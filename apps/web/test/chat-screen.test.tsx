import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';

const at = new Date('2026-08-22T08:00:00.000Z');
const scrollIntoView = vi.fn();
const initial = {
  pages: [{
    messages: [
      { id: 'one', authorPlayerId: 'other', planetId: 'other-planet', username: 'İzci', content: 'Merhaba galaksi', createdAt: at, self: false },
      { id: 'hidden', authorPlayerId: 'hidden', username: 'Gizli', content: 'Beni bulamazsın', createdAt: new Date(at.getTime() + 500), self: false },
      { id: 'two', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Buradayım', createdAt: new Date(at.getTime() + 1000), self: true },
    ],
    nextBefore: null,
  }],
  pageParams: [null],
};

function show(
  onFocusPlanet = vi.fn(),
  initialChannel: 'general' | 'clan' = 'general',
  generalData: unknown = initial,
) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  const post = vi.spyOn(api, 'postChat').mockResolvedValue({
    message: {
      id: 'three', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Yeni mesaj',
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chatMessages, generalData);
  client.setQueryData(keys.chatUnread, { count: 1 });
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
        content: 'Rim temiz', createdAt: at, self: false,
      }],
      nextBefore: null,
    }],
    pageParams: [null],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><ChatScreen initialChannel={initialChannel} onFocusPlanet={onFocusPlanet} /></Wrapper>);
  return { api, post, postClan, client, onFocusPlanet };
}

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('galaxy chat surface', () => {
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
    expect(screen.queryByText('Merhaba galaksi')).not.toBeInTheDocument();
    expect(screen.getByText('Rim temiz')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message your clan' })).toBeEnabled();
    await waitFor(() => { expect(api.markClanChatRead).toHaveBeenCalledWith('clan-one'); });
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
    await waitFor(() => { expect(api.markChatRead).toHaveBeenCalledWith('two'); });
  });

  it('underlines and routes only commanders whose location is known', async () => {
    const { onFocusPlanet } = show();
    const username = screen.getByRole('button', { name: 'İzci' });
    expect(username).toHaveClass('name', 'underline');
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
    await waitFor(() => { expect(post).toHaveBeenCalledWith('Yeni mesaj'); });
    expect(cancel).toHaveBeenCalledWith({ queryKey: keys.chatMessages });
    expect(await screen.findByText('Yeni mesaj')).toBeInTheDocument();
    expect(composer).toHaveValue('');
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

    await waitFor(() => { expect(post).toHaveBeenCalledWith('Yeni mesaj'); });
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
          { id: 'zero', authorPlayerId: 'other', username: 'Sable', content: 'Sıfırıncı', createdAt: new Date(at.getTime() - 2000), self: false },
          { id: 'one', authorPlayerId: 'other', username: 'Sable', content: 'Birinci', createdAt: new Date(at.getTime() - 1000), self: false },
        ],
        nextBefore: null,
      });
    });
    history.scrollTop = 0;

    fireEvent.scroll(history);

    expect(screen.queryByRole('button', { name: 'Load older messages' })).not.toBeInTheDocument();
    await waitFor(() => { expect(older).toHaveBeenCalledWith('older-cursor'); });
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
    await waitFor(() => { expect(api.markChatRead).toHaveBeenCalledWith('two'); });
    vi.mocked(api.markChatRead).mockClear();

    scrollHeight = 980;
    act(() => {
      client.setQueryData(keys.chatMessages, {
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
    await waitFor(() => { expect(api.markChatRead).toHaveBeenCalledWith('four'); });
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
      client.setQueryData(keys.chatMessages, {
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
  /**
   * GOLD, ON THE NAME AND ON THE MESSAGE. Owner instruction.
   *
   * A galaxy-wide room has no other way to say "this one is answerable for the
   * game". The name carries the colour and the message's own container repeats it
   * as a border, so the mark survives a wall of scrolling text — one glance finds
   * the official word without reading a single name.
   *
   * `alloy` is the palette's existing gold (`#d9a441`); nothing was invented.
   */
  const golden = () => {
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.chatMessages, {
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
    client.setQueryData(keys.chatUnread, { count: 0 });
    return render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <ChatScreen onFocusPlanet={vi.fn()} />
        </ApiProvider>
      </QueryClientProvider>,
    );
  };

  it('paints the admin’s name gold and rings their message in a QUIET gold', () => {
    /*
      SOFT, AND ASSERTED AS SOFT. Owner report: full-strength gold on the border
      was "çok kalın", loud enough that readers complained — a 1px rule at 100%
      saturation still shouts next to `border-line-soft` on every message around
      it.

      `border-alloy/35` is the house idiom, already used elsewhere in the client,
      and it matches the plate tint in `styles.css` (alloy mixed at 24% into the
      line colour). The NAME keeps full strength: it is small, it is the signal,
      and it is what a reader is looking for.

      Asserted with a word boundary rather than `toContain`, because
      `'border-alloy/35'.includes('border-alloy')` is true — the old assertion
      could not have failed on this change, which is the one thing a test about a
      shade must be able to do.
    */
    const view = golden();
    const row = view.container.querySelector('[data-chat-message="m-admin"]');
    expect(row, 'the admin message has no row').not.toBeNull();
    expect(row!.className).toMatch(/\bborder-alloy\/35\b/);
    expect(row!.className, 'the border is at full strength again')
      .not.toMatch(/\bborder-alloy(?![/\d])/);
    expect(row!.querySelector('[data-chat-author]')!.className).toContain('text-alloy');
  });

  it('leaves an ordinary commander untouched', () => {
    const view = golden();
    const row = view.container.querySelector('[data-chat-message="m-player"]');
    expect(row!.className).not.toContain('border-alloy');
    expect(row!.querySelector('[data-chat-author]')!.className).not.toContain('text-alloy');
  });
});
