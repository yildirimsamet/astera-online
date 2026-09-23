import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    onCommander: () => void; onWorlds: () => void; onEconomy: () => void; onBell: () => void;
    nowOpen: boolean; onNow: (open: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => { p.onNow(true); }}>now line</button>
      {p.nowOpen && <div role="dialog" aria-label="timers" />}
      <button type="button" onClick={p.onCommander}>chip</button>
      <button type="button" onClick={p.onWorlds}>world mark</button>
      <button type="button" onClick={p.onEconomy}>meter</button>
      <button type="button" onClick={p.onBell}>bell</button>
    </div>
  ),
}));

vi.mock('../../src/v2/shell/HudDock.js', () => ({
  HudDock: ({ active, onSelect }: { active: string | null; onSelect: (tab: string) => void }) => (
    <nav aria-label={`dock ${active ?? 'none'}`}>
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

vi.mock('../../src/v2/shell/FleetHost.js', () => ({
  FleetHost: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="fleet"><button type="button" onClick={onClose}>close fleet</button></div>
  ),
}));

let panel: Panel = null;
const onPanel = vi.fn((next: Panel) => { panel = next; });

const shell = () => render(
  <GameShell
    commander="Samet"
    panel={panel}
    onPanel={onPanel}
    onFocusPlanet={vi.fn()}
    onFocusCraft={vi.fn()}
    galaxy={({ homeRequest, worldsRequest, onPanel: route }) => (
      <div>
        <p>{`home ${String(homeRequest)} worlds ${String(worldsRequest)}`}</p>
        <button type="button" onClick={() => { route('chat'); }}>galaxy asks for chat</button>
      </div>
    )}
  />,
);

beforeEach(() => {
  panel = null;
  onPanel.mockClear();
  openSignals.mockClear();
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

  it('opens the bell on Signals and marks the feed read', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'bell' }));
    expect(screen.getByRole('dialog', { name: 'bell signals 1' })).toBeInTheDocument();
    expect(openSignals).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('navigation', { name: 'dock none' })).toBeInTheDocument();
  });

  it('sends chat and the chronicle to the bell rather than to a page, without marking signals read', async () => {
    shell();
    await userEvent.click(screen.getByRole('button', { name: 'galaxy asks for chat' }));
    expect(screen.getByRole('dialog', { name: 'bell chat 0' })).toBeInTheDocument();
    expect(onPanel).not.toHaveBeenCalled();
    expect(openSignals).not.toHaveBeenCalled();
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
