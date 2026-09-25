import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatHost } from '../../src/v2/shell/ChatHost.js';

/**
 * CHAT, A PAGE OF ITS OWN. Owner, 2026-09-24: chat left the bell ("Signals ve
 * Chronicle kalsın, chat'i kaldır") for a button on the galaxy a thumb reaches. It
 * opens on the channel with something unread, as the old launcher did.
 */
let generalUnread = 0;
let clanChatUnread = 0;

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    useChatUnread: () => ({ data: { count: generalUnread } }),
    useClanBadge: () => ({ data: { available: true, attentionCount: 0, clanChatUnread } }),
  };
});

vi.mock('../../src/screens/ChatScreen.js', () => ({
  ChatScreen: ({ initialChannel, initialClanDraft }: { initialChannel?: string; initialClanDraft?: string }) => (
    <p>chat on {initialChannel}{initialClanDraft ? ` · ${initialClanDraft}` : ''}</p>
  ),
}));

beforeEach(() => {
  generalUnread = 0;
  clanChatUnread = 0;
});

describe('the chat page', () => {
  it('opens on the general channel by default', () => {
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByText('chat on general')).toBeInTheDocument();
  });

  it('opens on the clan channel when only the clan has something unread', () => {
    clanChatUnread = 2;
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    expect(screen.getByText('chat on clan')).toBeInTheDocument();
  });

  /** The war room's "Clan chat" (E9) opens the clan channel whatever is unread. */
  it('opens on the channel it is asked for', () => {
    render(<ChatHost channel="clan" onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    expect(screen.getByText('chat on clan')).toBeInTheDocument();
  });

  it('hands a clan draft to the screen', () => {
    render(<ChatHost channel="clan" draft="Partial victory at Kestrel" onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    expect(screen.getByText('chat on clan · Partial victory at Kestrel')).toBeInTheDocument();
  });

  it('closes through its host', async () => {
    const onClose = vi.fn();
    render(<ChatHost onClose={onClose} onFocusPlanet={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
