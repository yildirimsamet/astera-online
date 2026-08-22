import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import i18n from '../src/i18n/index.js';
import { ChatScreen } from '../src/screens/ChatScreen.js';

const at = new Date('2026-08-22T08:00:00.000Z');
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

function show(onFocusPlanet = vi.fn()) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  vi.spyOn(api, 'markChatRead').mockResolvedValue({ ok: true, readAt: at });
  const post = vi.spyOn(api, 'postChat').mockResolvedValue({
    message: {
      id: 'three', authorPlayerId: 'mine', planetId: 'my-planet', username: 'Vantage', content: 'Yeni mesaj',
      createdAt: new Date(at.getTime() + 2000), self: true,
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.chatMessages, initial);
  client.setQueryData(keys.chatUnread, { count: 1 });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>
  );
  render(<Wrapper><ChatScreen onFocusPlanet={onFocusPlanet} /></Wrapper>);
  return { api, post, client, onFocusPlanet };
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
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
    expect(username).toHaveClass('font-bold');
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

  it('keeps a Unicode draft to 280 visible characters', async () => {
    show();
    const composer = screen.getByRole('textbox', { name: 'Message the galaxy' });
    await userEvent.setup().type(composer, '🌌'.repeat(281));
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
