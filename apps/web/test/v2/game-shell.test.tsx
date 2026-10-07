import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Panel } from '../../src/screens/GalaxyView.js';
import { GameShell } from '../../src/v2/shell/GameShell.js';

/**
 * THE v2 SHELL. Spec B1–B4, K1 and the "every surface's new place" table.
 *
 * The top bar and Now line above the galaxy, the dock below; the dock lights the
 * page that is open and routes presses (dockAction); chat and the chronicle open
 * under the bell; the world mark and Galaxy-pressed-again reach into the galaxy
 * as counted requests. The parts are tested on their own; this holds the wiring.
 */

const openSignals = vi.fn(() => new Set(['n1']));

vi.mock('../../src/shell/Signals.js', () => ({ useOpenSignals: () => openSignals }));
vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return { ...actual, usePlanet: () => ({ data: undefined }) };
});

vi.mock('../../src/v2/shell/HudTop.js', () => ({
  HudTop: (p: {
    onCommander: () => void; onRewards: () => void; onWorlds: () => void; onEconomy: () => void; onBell: () => void;
    nowOpen: boolean; onNow: (open: boolean) => void;
    onFocusCraft: (focus: { kind: 'thread'; key: string }) => void; tabs?: ReactNode;
  }) => (
    <div>
      {p.tabs !== undefined && <div aria-label="top tabs">{p.tabs}</div>}
      <button type="button" onClick={() => { p.onNow(true); }}>now line</button>
      {p.nowOpen && <div role="dialog" aria-label="timers">
        <button type="button" onClick={() => { p.onNow(false); p.onFocusCraft({ kind: 'thread', key: 'm-1' }); }}>timer flight</button>
      </div>}
      <button type="button" onClick={p.onCommander}>chip</button>
      <button type="button" onClick={p.onRewards}>gift</button>
      <button type="button" onClick={p.onWorlds}>world mark</button>
      <button type="button" onClick={p.onEconomy}>meter</button>
      <button type="button" onClick={p.onBell}>bell</button>
    </div>
  ),
}));

vi.mock('../../src/v2/shell/OutlineHost.js', () => ({
  OutlineHost: ({ onFocusPlanet, onFocusCraft, onRoute }: {
    onFocusPlanet: (id: string) => void;
    onFocusCraft: (focus: { kind: string; key: string }) => void;
    onRoute: (panel: string) => void;
  }) => (
    <aside aria-label="outline">
      <button type="button" onClick={() => { onFocusPlanet('p-2'); }}>outline world</button>
      <button type="button" onClick={() => { onFocusCraft({ kind: 'thread', key: 'm-1' }); }}>outline flight</button>
      <button type="button" onClick={() => { onRoute('research'); }}>outline research</button>
    </aside>
  ),
}));

vi.mock('../../src/v2/shell/HudDock.js', () => ({
  HudDock: ({ active, onSelect, over, bar }: { active: string | null; onSelect: (tab: string) => void; over: boolean; bar?: boolean }) => (
    <nav aria-label={`dock ${active ?? 'none'}`} {...(over ? { 'data-over': '' } : {})} {...(bar ? { 'data-bar': '' } : {})}>
      {['galaxy', 'base', 'fleet', 'intel', 'clan'].map((tab) => (
        <button key={tab} type="button" onClick={() => { onSelect(tab); }}>{`tab ${tab}`}</button>
      ))}
    </nav>
  ),
}));

vi.mock('../../src/v2/shell/BellHost.js', () => ({
  BellHost: ({ tab, justRead, onClose }: { tab: string; justRead: ReadonlySet<string>; onClose: () => void }) => (
    <div role="dialog" aria-label={`bell ${tab} ${String(justRead.size)}`}>
      <button type="button" onClick={onClose}>close bell</button>
    </div>
  ),
}));

vi.mock('../../src/v2/shell/ChatHost.js', () => ({
  ChatHost: ({ onClose, channel, draft }: { onClose: () => void; channel?: string; draft?: string }) => (
    <div role="dialog" aria-label={[channel ? `chat ${channel}` : 'chat', ...(draft ? [draft] : [])].join(' · ')}>
      <button type="button" onClick={onClose}>close chat</button>
    </div>
  ),
}));

vi.mock('../../src/v2/shell/AwayHost.js', () => ({
  AwayHost: ({ onDoor, onAll }: { onDoor: (door: string, planetId?: string) => void; onAll: () => void }) => (
    <div aria-label="away story">
      {['report', 'intel', 'base', 'orbit', 'signals'].map((door) => (
        <button key={door} type="button" onClick={() => { onDoor(door); }}>{`away ${door}`}</button>
      ))}
      {['dossier', 'repair'].map((door) => (
        <button key={door} type="button" onClick={() => { onDoor(door, 'p9'); }}>{`away ${door}`}</button>
      ))}
      <button type="button" onClick={onAll}>away all</button>
    </div>
  ),
}));

vi.mock('../../src/v2/shell/FleetHost.js', () => ({
  FleetHost: ({ onClose, onOpenRepairStation }: { onClose: () => void; onOpenRepairStation: (planetId: string) => void }) => (
    <div role="dialog" aria-label="fleet">
      <button type="button" onClick={onClose}>close fleet</button>
      <button type="button" onClick={() => { onOpenRepairStation('p9'); }}>fleet repair station</button>
    </div>
  ),
}));

let panel: Panel = null;
const onPanel = vi.fn((next: Panel) => { panel = next; });
const onFocusPlanet = vi.fn();
const onFocusCraft = vi.fn();

const shell = () => render(
  <GameShell
    commander="Samet"
    panel={panel}
    onPanel={onPanel}
    onFocusPlanet={onFocusPlanet}
    onFocusCraft={onFocusCraft}
    galaxy={({ homeRequest, worldsRequest, centerRequest, clearRequest, onPanel: route, onOpenChat }) => (
      <div>
        <p>{`home ${String(homeRequest)} worlds ${String(worldsRequest)}`}</p>
        <p>{`center ${String(centerRequest)} clear ${String(clearRequest)}`}</p>
        <button type="button" onClick={() => { route('chat'); }}>galaxy asks for chat</button>
        <button type="button" onClick={() => { onOpenChat('clan'); }}>galaxy asks for clan chat</button>
        <button type="button" onClick={() => { onOpenChat('clan', 'Partial victory at Kestrel'); }}>galaxy shares a report</button>
      </div>
    )}
  />,
);

/** The window as wide as a desk (≥1100 px), or as a phone. */
const desk = (wide: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide && query === '(min-width: 1100px)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

beforeEach(() => {
  panel = null;
  onPanel.mockClear();
  onFocusPlanet.mockClear();
  onFocusCraft.mockClear();
  openSignals.mockClear();
});

afterEach(() => { vi.unstubAllGlobals(); });

/** E11 · K10: a desk opens columns instead of scaling the phone up. */
describe('the shell on a desk', () => {
  it('opens the rewards page directly from the header gift', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'gift' }));
    expect(onPanel).toHaveBeenLastCalledWith('rewards', undefined, undefined, undefined);
  });
  it('keeps the phone layout on a phone: the dock at the foot, no outline', () => {
    desk(false);
    shell();
    expect(screen.queryByRole('complementary', { name: 'outline' })).toBeNull();
    expect(screen.queryByLabelText('top tabs')).toBeNull();
    expect(screen.getByRole('navigation')).not.toHaveAttribute('data-bar');
  });

  it('puts the tabs in the top bar and the outline beside the galaxy', () => {
    desk(true);
    shell();
    expect(screen.getByRole('complementary', { name: 'outline' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('data-bar', '');
    expect(screen.getByLabelText('top tabs')).toContainElement(nav);
  });

  it('shows a world or a flight from the outline on the galaxy, leaving the page that was open', async () => {
    desk(true);
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'tab fleet' }));
    await userEvent.click(screen.getByRole('button', { name: 'outline world' }));
    // A world row SELECTS the world (owner report, 2026-10-06): focus alone left the old one active.
    expect(onFocusPlanet).toHaveBeenCalledWith('p-2', { select: true });
    expect(screen.queryByRole('dialog', { name: 'fleet' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'bell' }));
    await userEvent.click(screen.getByRole('button', { name: 'outline flight' }));
    expect(onFocusCraft).toHaveBeenCalledWith({ kind: 'thread', key: 'm-1' });
    expect(screen.queryByRole('dialog', { name: /^bell/ })).toBeNull();
  });

  it('opens a lane’s page from the outline through the shell’s router', async () => {
    desk(true);
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'outline research' }));
    expect(onPanel).toHaveBeenLastCalledWith('research', undefined, undefined, undefined);
  });
});

/** E11: 1–5 are the tabs, Space brings the camera to the selection, Esc lets go of it. */
describe('the desk keyboard in the shell', () => {
  it('opens the five tabs by their numbers', () => {
    shell();
    fireEvent.keyDown(window, { key: '2' });
    expect(onPanel).toHaveBeenLastCalledWith('planet', undefined, undefined, undefined);
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByRole('dialog', { name: 'fleet' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '4' });
    expect(onPanel).toHaveBeenLastCalledWith('intel', undefined, undefined, undefined);
    expect(screen.queryByRole('dialog', { name: 'fleet' })).toBeNull();
  });

  it('asks the galaxy to bring the selection into view on Space, and to let go of it on Esc', () => {
    shell();
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('center 1 clear 1')).toBeInTheDocument();
  });

  it('leaves Space and Esc to a page that is open', () => {
    shell();
    const page = document.createElement('div');
    page.setAttribute('data-sheet-panel', '');
    document.body.append(page);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('center 0 clear 0')).toBeInTheDocument();
    page.remove();
  });

  it('never takes a number typed into a field', () => {
    shell();
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: '2' });
    expect(onPanel).not.toHaveBeenCalled();
    field.remove();
  });
});

/** E10: the return story sits in the shell; each of its doors opens the page that answers it. */
describe('the return story in the shell', () => {
  it('opens the battle list, the intel sheet and the base from its lines', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'away report' }));
    expect(onPanel).toHaveBeenLastCalledWith('intel', 'battles', undefined, undefined);
    await userEvent.click(screen.getByRole('button', { name: 'away intel' }));
    expect(onPanel).toHaveBeenLastCalledWith('intel', undefined, undefined, undefined);
    await userEvent.click(screen.getByRole('button', { name: 'away base' }));
    expect(onPanel).toHaveBeenLastCalledWith('planet', undefined, undefined, { group: 'grow' });
    await userEvent.click(screen.getByRole('button', { name: 'away orbit' }));
    expect(onPanel).toHaveBeenLastCalledWith('planet', undefined, undefined, { group: 'orbit' });
  });

  /** M4: a Telescope sighting opens that world's dossier; a world's faults open its base. */
  it('opens a sighted world’s dossier, and a broken world’s base', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'away dossier' }));
    expect(onFocusPlanet).toHaveBeenLastCalledWith('p9', { dossier: true });
    await userEvent.click(screen.getByRole('button', { name: 'away repair' }));
    expect(onPanel).toHaveBeenLastCalledWith('planet', undefined, undefined, { planetId: 'p9' });
  });

  /**
   * THE FLEET PAGE'S DOCK COUNT OPENS THAT WORLD'S STATION (2026-09-30): the world, its
   * Base on the Fleet tab, and the Repair Station open on it — three moves in one press.
   */
  it('opens a world’s Repair Station from the Fleet page, leaving the page', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'tab fleet' }));
    await userEvent.click(screen.getByRole('button', { name: 'fleet repair station' }));
    expect(onPanel).toHaveBeenLastCalledWith('planet', undefined, undefined, { planetId: 'p9', group: 'reach', itemId: 'REPAIR_STATION' });
    expect(screen.queryByRole('dialog', { name: 'fleet' })).toBeNull();
  });

  it('opens the whole list in Signals', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'away all' }));
    expect(screen.getByRole('dialog', { name: /^bell signals/ })).toBeInTheDocument();
  });
});

describe('the v2 shell', () => {
  it('lights Galaxy with no page open, and the tab that owns an open page', () => {
    const { rerender } = shell();
    expect(screen.getByRole('navigation', { name: 'dock galaxy' })).toBeInTheDocument();
    panel = 'report';
    rerender(
      <GameShell commander="Samet" panel={panel} onPanel={onPanel} onFocusPlanet={vi.fn()} onFocusCraft={vi.fn()} galaxy={() => null} />,
    );
    expect(screen.getByRole('navigation', { name: 'dock intel' })).toBeInTheDocument();
  });

  it('opens a tab’s page, and flies home when Galaxy is pressed while lit', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'tab base' }));
    expect(onPanel.mock.calls[0]?.[0]).toBe('planet');
    onPanel.mockClear();
    panel = null;
    await userEvent.click(screen.getByRole('button', { name: 'tab galaxy' }));
    expect(screen.getByText('home 1 worlds 0')).toBeInTheDocument();
  });

  it('opens the fleet page from the dock and lights Fleet', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'tab fleet' }));
    expect(screen.getByRole('dialog', { name: 'fleet' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'dock fleet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'tab galaxy' }));
    expect(screen.queryByRole('dialog', { name: 'fleet' })).toBeNull();
    expect(screen.getByText('home 0 worlds 0')).toBeInTheDocument();
  });

  /**
   * THE DOCK IS SEE-THROUGH OVER THE GALAXY (owner, 2026-09-24): no backing at all while
   * nothing is open, so the scene runs to the bottom edge; a page open over the galaxy —
   * a tab's, the fleet, the bell — gets it back, so the tabs read over the page.
   */
  it('backs the dock only while a page is open over the galaxy', async () => {
    shell();
    expect(screen.getByRole('navigation')).not.toHaveAttribute('data-over');
    await userEvent.click(screen.getByRole('button', { name: 'tab fleet' }));
    expect(screen.getByRole('navigation')).toHaveAttribute('data-over', '');
    await userEvent.click(screen.getByRole('button', { name: 'tab galaxy' }));
    expect(screen.getByRole('navigation')).not.toHaveAttribute('data-over');
    await userEvent.click(screen.getByRole('button', { name: 'bell' }));
    expect(screen.getByRole('navigation')).toHaveAttribute('data-over', '');
  });

  it('backs the dock under a tab’s page', () => {
    panel = 'planet';
    shell();
    expect(screen.getByRole('navigation')).toHaveAttribute('data-over', '');
  });

  it('opens the bell on Signals and marks the feed read', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'bell' }));
    expect(screen.getByRole('dialog', { name: 'bell signals 1' })).toBeInTheDocument();
    expect(openSignals).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('navigation', { name: 'dock none' })).toBeInTheDocument();
  });

  /** Owner, 2026-09-24: chat is its own page, opened from its button on the galaxy — not a bell tab. */
  it('opens chat as a page of its own, not under the bell, and marks no signal read', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'galaxy asks for chat' }));
    expect(screen.getByRole('dialog', { name: 'chat' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /^bell/ })).toBeNull();
    expect(onPanel).not.toHaveBeenCalled();
    expect(openSignals).not.toHaveBeenCalled();
    expect(screen.getByRole('navigation')).toHaveAttribute('data-over', '');
    await userEvent.click(screen.getByRole('button', { name: 'close chat' }));
    expect(screen.queryByRole('dialog', { name: 'chat' })).toBeNull();
  });

  /** E9: the war room's "Clan chat" opens chat on the clan channel, as its own page. */
  it('opens chat on the clan channel when the war room asks for it', async () => {
    panel = 'clan';
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'galaxy asks for clan chat' }));
    expect(screen.getByRole('dialog', { name: 'chat clan' })).toBeInTheDocument();
    expect(onPanel).toHaveBeenLastCalledWith(null);
    await userEvent.click(screen.getByRole('button', { name: 'close chat' }));
    await userEvent.click(screen.getByRole('button', { name: 'galaxy asks for chat' }));
    // The next ordinary open decides by what is unread again.
    expect(screen.getByRole('dialog', { name: 'chat' })).toBeInTheDocument();
  });

  /** M4: "To clan" on a report opens clan chat with the report's line as a draft. */
  it('opens clan chat with a draft when a report is shared', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'galaxy shares a report' }));
    expect(screen.getByRole('dialog', { name: 'chat clan · Partial victory at Kestrel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'close chat' }));
    await userEvent.click(screen.getByRole('button', { name: 'galaxy asks for clan chat' }));
    // A later open carries no stale draft.
    expect(screen.getByRole('dialog', { name: 'chat clan' })).toBeInTheDocument();
  });

  it('closes chat when the dock moves', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'galaxy asks for chat' }));
    await userEvent.click(screen.getByRole('button', { name: 'tab base' }));
    expect(screen.queryByRole('dialog', { name: 'chat' })).toBeNull();
  });

  /**
   * THE TIMERS SHEET GOES WHEN THE PLAYER MOVES. Found in review: it was the Now
   * line's own state, drawn from the top bar at the pages' own layer, so a dock
   * press opened the base over it and closing the base uncovered a sheet the
   * player had left behind — and Escape closed both.
   */
  it('closes the timers sheet on every move the shell makes', async () => {
    shell();
    for (const press of ['tab base', 'tab fleet', 'bell', 'chip', 'world mark', 'galaxy asks for chat']) {
      await userEvent.click(screen.getByRole('button', { name: 'now line' }));
      expect(screen.getByRole('dialog', { name: 'timers' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: press }));
      expect(screen.queryByRole('dialog', { name: 'timers' }), press).toBeNull();
    }
  });

  it('hands a timers flight to the same craft focus path as the Fleet page', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'now line' }));
    await userEvent.click(screen.getByRole('button', { name: 'timer flight' }));
    expect(onFocusCraft).toHaveBeenCalledWith({ kind: 'thread', key: 'm-1' });
    expect(screen.queryByRole('dialog', { name: 'timers' })).toBeNull();
  });

  it('routes the chip, the world mark and the meters', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'chip' }));
    expect(onPanel.mock.calls[0]?.[0]).toBe('menu');
    await userEvent.click(screen.getByRole('button', { name: 'meter' }));
    expect(onPanel.mock.calls[1]).toEqual(['planet', undefined, undefined, { group: 'grow' }]);
    await userEvent.click(screen.getByRole('button', { name: 'world mark' }));
    expect(screen.getByText('home 0 worlds 1')).toBeInTheDocument();
  });
});
