import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatHost } from '../../src/v2/shell/ChatHost.js';

/**
 * CHAT, A PAGE OF ITS OWN. Owner, 2026-09-24: chat left the bell ("Signals ve
 * Chronicle kalsın, chat'i kaldır") for a button on the galaxy a thumb reaches. It
 * opens on the channel with something unread, as the old launcher did.
 */
let generalUnread = 0;
let clanChatUnread = 0;
let dmUnread = 0;

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    useChatUnread: () => ({ data: { count: generalUnread } }),
    useClanBadge: () => ({ data: { available: true, attentionCount: 0, clanChatUnread } }),
    useDmUnread: () => ({ data: { count: dmUnread } }),
  };
});

vi.mock('../../src/screens/ChatScreen.js', () => ({
  ChatScreen: ({ initialChannel, initialClanDraft }: { initialChannel?: string; initialClanDraft?: string }) => (
    <><p>chat on {initialChannel}{initialClanDraft ? ` · ${initialClanDraft}` : ''}</p><textarea aria-label="Composer" /></>
  ),
}));

beforeEach(() => {
  generalUnread = 0;
  clanChatUnread = 0;
  dmUnread = 0;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the chat page', () => {
  it('tracks the visible viewport through keyboard resize and Safari pan, and releases listeners', () => {
    const viewport = Object.assign(new EventTarget(), { height: 740, offsetTop: 0 });
    vi.stubGlobal('visualViewport', viewport);
    const remove = vi.spyOn(viewport, 'removeEventListener');
    const view = render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const host = view.container.querySelector('[data-chat-host]');
    expect(host).toHaveStyle('--chat-viewport-height: 740px; --chat-viewport-top: 0px');
    act(() => { viewport.height = 360; viewport.dispatchEvent(new Event('resize')); });
    expect(host).toHaveStyle('--chat-viewport-height: 360px');
    act(() => { viewport.offsetTop = 90; viewport.dispatchEvent(new Event('scroll')); });
    expect(host).toHaveStyle('--chat-viewport-top: 90px');
    act(() => { viewport.height = 740; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')); });
    expect(host).toHaveStyle('--chat-viewport-height: 740px; --chat-viewport-top: 0px');
    view.unmount();
    expect(remove.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['resize', 'scroll']));
  });

  it('uses window height when VisualViewport is unavailable, including Android window resize', () => {
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal('innerHeight', 740);
    const view = render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const host = view.container.querySelector('[data-chat-host]');
    expect(host).toHaveStyle('--chat-viewport-height: 740px');
    act(() => { vi.stubGlobal('innerHeight', 360); window.dispatchEvent(new Event('resize')); });
    expect(host).toHaveStyle('--chat-viewport-height: 360px');
  });

  /*
    Android's keyboard-hide key leaves the composer focused, so the compose layout
    stayed over the whole screen without a keyboard (measured on the owner's S22,
    2026-11-10). A viewport that grows back while composing is that key.
  */
  it('lets go of the composer when the keyboard closes without a blur, and only then', () => {
    const viewport = Object.assign(new EventTarget(), { height: 740, offsetTop: 0 });
    vi.stubGlobal('visualViewport', viewport);
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const composer = screen.getByRole('textbox', { name: 'Composer' });
    act(() => { composer.focus(); viewport.dispatchEvent(new Event('resize')); });
    expect(composer).toHaveFocus();
    act(() => { viewport.height = 360; viewport.dispatchEvent(new Event('resize')); });
    act(() => { viewport.height = 380; viewport.dispatchEvent(new Event('resize')); });
    expect(composer).toHaveFocus();
    act(() => { viewport.height = 740; viewport.dispatchEvent(new Event('resize')); });
    expect(composer).not.toHaveFocus();
  });

  it('lets go of the composer on an Android window resize when VisualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal('innerHeight', 360);
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const composer = screen.getByRole('textbox', { name: 'Composer' });
    act(() => { composer.focus(); });
    act(() => { vi.stubGlobal('innerHeight', 740); window.dispatchEvent(new Event('resize')); });
    expect(composer).not.toHaveFocus();
  });

  it('keeps a fixed-height panel while the message history owns scrolling', () => {
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Chat' });
    expect(panel).toHaveClass('h-[70dvh]');
    expect(panel.querySelector('[data-sheet-body]')).toHaveClass('overflow-hidden');
  });

  /**
   * ON THE KIT (C2, 2026-11-14): the two lists the page keeps — players muted on this device, players
   * blocked — are the kit's round keys in the title, each with its own mark, 44 px to the thumb.
   */
  it('keeps the muted and blocked lists behind the kit’s round keys in its title', () => {
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const muted = screen.getByRole('button', { name: 'Muted players' });
    const blocked = screen.getByRole('button', { name: 'Blocked players' });
    for (const key of [muted, blocked]) expect(key).toHaveClass('gk-round', 'gk-round--small');
    expect(muted.querySelector('svg.gk-glyph')).not.toBeNull();
  });

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

  it('opens on DM when a private message is unread', () => {
    dmUnread = 1;
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    expect(screen.getByText('chat on dm')).toBeInTheDocument();
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
