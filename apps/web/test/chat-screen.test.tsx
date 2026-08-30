import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      { id: 'two', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Buradayım', createdAt: new Date(at.getTime() + 1000), self: true },
    ],
    nextBefore: null,
  }],
  pageParams: [null],
};

function show(
  onFocusPlanet = vi.fn(),
  initialChannel: 'general' | 'clan' = 'general',
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
  client.setQueryData(keys.chatMessages, initial);
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

  it('routes another commander name back to their planet', async () => {
    const { onFocusPlanet } = show();
    const username = screen.getByRole('button', { name: 'İzci' });
    expect(username).toHaveClass('name');
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
