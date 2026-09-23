import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BellHost } from '../../src/v2/shell/BellHost.js';

/**
 * THE BELL SHEET, WIRED. Decision K1 (docs/ui-v2/gozlemevi.md).
 *
 * Each tab draws the screen that already exists for it — the signals feed, the
 * galaxy chronicle, chat — and every way out of them closes the sheet first. The
 * chronicle's own-world line opens the base rather than flying to it; chat opens
 * on the channel with something unread.
 */

let clanChatUnread = 0;
let generalUnread = 0;

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    useGalaxy: () => ({ data: undefined }),
    useChatUnread: () => ({ data: { count: generalUnread } }),
    useClanBadge: () => ({ data: { available: true, attentionCount: 0, clanChatUnread } }),
  };
});

vi.mock('../../src/api/world.js', () => ({
  useWorld: () => ({ activePlanetId: 'home', capitalPlanetId: 'home', worlds: [], selectPlanet: vi.fn() }),
}));

vi.mock('../../src/shell/Signals.js', () => ({
  SignalsFeed: ({ onGo, onFocusPlanet }: { onGo: (panel: string) => void; onFocusPlanet: (id: string) => void }) => (
    <div>
      <button type="button" onClick={() => { onGo('intel'); }}>open a probe report</button>
      <button type="button" onClick={() => { onFocusPlanet('far'); }}>look at a world</button>
    </div>
  ),
}));

vi.mock('../../src/screens/ChronicleScreen.js', () => ({
  ChronicleScreen: ({ onFocusPlanet }: { onFocusPlanet: (id: string) => void }) => (
    <div>
      <button type="button" onClick={() => { onFocusPlanet('home'); }}>my world in the chronicle</button>
      <button type="button" onClick={() => { onFocusPlanet('far'); }}>a rival in the chronicle</button>
    </div>
  ),
}));

vi.mock('../../src/screens/ChatScreen.js', () => ({
  ChatScreen: ({ initialChannel }: { initialChannel?: string }) => <p>chat on {initialChannel}</p>,
}));

const setup = (tab: 'signals' | 'chronicle' | 'chat', justRead: ReadonlySet<string> = new Set()) => {
  const on = { onTab: vi.fn(), onClose: vi.fn(), onGo: vi.fn(), onFocusPlanet: vi.fn(), onOpenPlanet: vi.fn() };
  render(<BellHost tab={tab} justRead={justRead} {...on} />);
  return on;
};

describe('the wired bell sheet', () => {
  it('says how many signals this opening marked read', () => {
    setup('signals', new Set(['a', 'b']));
    expect(screen.getByText('2 new')).toBeInTheDocument();
  });

  it('closes before a signal takes the player somewhere', async () => {
    const on = setup('signals');
    await userEvent.click(screen.getByRole('button', { name: 'open a probe report' }));
    await userEvent.click(screen.getByRole('button', { name: 'look at a world' }));
    expect(on.onClose).toHaveBeenCalledTimes(2);
    expect(on.onGo.mock.calls[0]?.[0]).toBe('intel');
    expect(on.onFocusPlanet).toHaveBeenCalledWith('far');
  });

  it('opens the base for the player’s own world in the chronicle, and flies to any other', async () => {
    const on = setup('chronicle');
    await userEvent.click(screen.getByRole('button', { name: 'my world in the chronicle' }));
    await userEvent.click(screen.getByRole('button', { name: 'a rival in the chronicle' }));
    expect(on.onOpenPlanet).toHaveBeenCalledTimes(1);
    expect(on.onFocusPlanet).toHaveBeenCalledWith('far');
  });

  it('opens chat on the channel with something unread, and dots the tab', () => {
    clanChatUnread = 2;
    generalUnread = 0;
    setup('chat');
    expect(screen.getByText('chat on clan')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Chat · 2 unread' })).toBeInTheDocument();
  });
});
