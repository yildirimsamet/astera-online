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
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
    THE CHAT NEVER CLOSES ITS OWN KEYBOARD (owner 2026-11-17, second report). The compose layout
    followed the composer's FOCUS, so the keyboard-hide key (which keeps focus) left it over the
    whole screen, and the page blurred the composer when the viewport grew back. As the keyboard
    rose, the app shell laid the window out at full height for a moment — long enough to be read
    as that key — and the blur shut the keyboard it was opening; waiting 300 ms was not enough.
    Now the layout follows the KEYBOARD (`data-keyboard`: the viewport well short of its tallest
    while a field in the chat has focus), and nothing in the chat ever blurs.
  */
  const keyboardHost = () => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 740, offsetTop: 0 });
    vi.stubGlobal('visualViewport', viewport);
    const view = render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const host = view.container.querySelector<HTMLElement>('[data-chat-host]')!;
    const composer = screen.getByRole('textbox', { name: 'Composer' });
    const resize = (height: number): void => { act(() => { viewport.height = height; viewport.dispatchEvent(new Event('resize')); }); };
    return { host, composer, resize };
  };

  it('composes above the keyboard while it is up', () => {
    const { host, composer, resize } = keyboardHost();
    act(() => { composer.focus(); });
    expect(host).not.toHaveAttribute('data-keyboard');
    resize(360);
    expect(host).toHaveAttribute('data-keyboard');
    expect(composer).toHaveFocus();
  });

  it('keeps the keyboard through every bounce of the window as it opens', () => {
    const { host, composer, resize } = keyboardHost();
    act(() => { composer.focus(); });
    resize(360);
    for (const height of [740, 360, 740, 380, 740, 360]) {
      resize(height);
      act(() => { vi.advanceTimersByTime(120); });
    }
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(composer).toHaveFocus();
    expect(host).toHaveAttribute('data-keyboard');
  });

  it('drops the compose layout when the hide key lowers the keyboard, and leaves the composer focused', () => {
    const { host, composer, resize } = keyboardHost();
    act(() => { composer.focus(); });
    resize(360);
    resize(740);
    act(() => { vi.advanceTimersByTime(400); });
    expect(host).not.toHaveAttribute('data-keyboard');
    expect(composer).toHaveFocus();
    // A tap on the focused composer raises the keyboard again, and the layout follows.
    resize(360);
    expect(host).toHaveAttribute('data-keyboard');
  });

  it('never blurs anything, whatever the viewport does', () => {
    const { composer, resize } = keyboardHost();
    const blur = vi.spyOn(HTMLElement.prototype, 'blur');
    act(() => { composer.focus(); });
    for (const height of [360, 740, 360, 900, 200, 740]) resize(height);
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(blur).not.toHaveBeenCalled();
  });

  it('is not composing when the field with focus is outside the chat', () => {
    const { host, resize } = keyboardHost();
    const outside = document.createElement('input');
    document.body.append(outside);
    act(() => { outside.focus(); });
    resize(360);
    expect(host).not.toHaveAttribute('data-keyboard');
    outside.remove();
  });

  it('measures the keyboard against the turned screen, not the old one', () => {
    const { host, composer, resize } = keyboardHost();
    act(() => { composer.focus(); });
    // Turned to landscape: shorter, wider, no keyboard.
    act(() => { vi.stubGlobal('innerWidth', 760); });
    resize(330);
    expect(host).not.toHaveAttribute('data-keyboard');
  });

  it('follows an Android window resize when VisualViewport is unavailable', () => {
    vi.useFakeTimers();
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal('innerHeight', 740);
    const view = render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const host = view.container.querySelector<HTMLElement>('[data-chat-host]')!;
    const composer = screen.getByRole('textbox', { name: 'Composer' });
    act(() => { composer.focus(); });
    act(() => { vi.stubGlobal('innerHeight', 360); window.dispatchEvent(new Event('resize')); });
    expect(host).toHaveAttribute('data-keyboard');
    act(() => { vi.stubGlobal('innerHeight', 740); window.dispatchEvent(new Event('resize')); });
    act(() => { vi.advanceTimersByTime(400); });
    expect(host).not.toHaveAttribute('data-keyboard');
    expect(composer).toHaveFocus();
  });

  it('keeps a fixed-height panel while the message history owns scrolling', () => {
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Chat' });
    expect(panel).toHaveClass('h-[70dvh]');
    // the kit's body says it with the important mark (`overflow-hidden!`); either way the body never scrolls
    expect(panel.querySelector('[data-sheet-body]')?.className).toMatch(/(^|\s)overflow-hidden!?(\s|$)/);
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

/** S1 (owner 2026-11-16): chat wears the one 48 px head every sheet wears, its two tools beside the title. */
describe('the chat page head', () => {
  it('is the kit head with the chat mark, and the mute and block tools inside it', () => {
    render(<ChatHost onClose={vi.fn()} onFocusPlanet={vi.fn()} />);
    const head = screen.getByRole('dialog').querySelector('.gk-sheet__head')!;
    expect(head).not.toBeNull();
    expect(head.querySelector('.gk-sheet__art')).toHaveAttribute('src', expect.stringMatching(/hud-chat/));
    expect(head.querySelectorAll('[data-title-action] .gk-round')).toHaveLength(2);
  });
});
