import { useState, type ReactNode } from 'react';
import { usePlanet } from '../../api/queries.js';
import type { DockTab } from '../../lib/dock.js';
import { bellTabFor, dockAction, tabOfPanel } from '../../lib/shellRoute.js';
import type { Panel, PanelStop } from '../../screens/GalaxyView.jsx';
import type { StripFocus } from '../../shell/PendingStrip.js';
import { useOpenSignals } from '../../shell/Signals.js';
import type { BellTab } from '../hud/BellSheet.js';
import { FleetSheet } from '../hud/FleetSheet.js';
import { BellHost } from './BellHost.js';
import { HudDock } from './HudDock.js';
import { HudTop } from './HudTop.js';

/** Open a page: the panel, its shelf, the report, the row — as the app's router takes it. */
export type ShellRoute = (
  panel: Panel,
  stop?: PanelStop,
  reportMissionId?: string,
  focus?: { planetId?: string; group?: string; itemId?: string },
) => void;

export interface GameShellProps {
  commander: string;
  /** The page open over the galaxy, owned by the app. */
  panel: Panel;
  onPanel: ShellRoute;
  onFocusPlanet: (planetId: string) => void;
  /** Frame one of the player's craft (or a contact) from the Fleet page. */
  onFocusCraft: (focus: StripFocus) => void;
  /** The galaxy, handed the shell's counted requests and its router. */
  galaxy: (shell: { homeRequest: number; worldsRequest: number; onPanel: ShellRoute }) => ReactNode;
}

/**
 * THE v2 SHELL. Spec B1–B4, K1 and the "every surface's new place" table
 * (docs/ui-v2/gozlemevi.md).
 *
 * The top bar and the Now line above the galaxy, the dock under it, and the two
 * sheets the shell owns itself: the bell (signals, chronicle, chat) and the
 * Fleet page. The galaxy never unmounts; every page opens over it and sits above
 * the dock (`.v2-shell` publishes `--v2-dock-h`, which both sheet kits read), so
 * a tab is always one press from any page.
 *
 * Chat and the chronicle are bell tabs now (K1): a route to either opens the bell
 * instead of a page. Opening the bell on Signals marks the feed read, as the old
 * beacon did; opening it on chat or the chronicle does not, because nobody has
 * seen the signals yet.
 */
export function GameShell({ commander, panel, onPanel, onFocusPlanet, onFocusCraft, galaxy }: GameShellProps) {
  const [bell, setBell] = useState<{ tab: BellTab; justRead: ReadonlySet<string> } | null>(null);
  const [fleetOpen, setFleetOpen] = useState(false);
  /** The Now line's timers sheet: closed by every move below, never left under a page. */
  const [nowOpen, setNowOpen] = useState(false);
  const [homeRequest, setHomeRequest] = useState(0);
  const [worldsRequest, setWorldsRequest] = useState(0);
  const openSignals = useOpenSignals();
  const flight = usePlanet().data?.flight ?? null;

  /** Leave whatever page is open, so the next thing opens alone. */
  const clearPages = (): void => {
    setNowOpen(false);
    setBell(null);
    setFleetOpen(false);
    if (panel !== null) onPanel(null);
  };

  const openBell = (tab: BellTab): void => {
    setNowOpen(false);
    setFleetOpen(false);
    if (panel !== null) onPanel(null);
    setBell({ tab, justRead: tab === 'signals' ? openSignals() : new Set() });
  };

  const route: ShellRoute = (next, stop, reportMissionId, focus) => {
    const tab = bellTabFor(next);
    if (tab) {
      openBell(tab);
      return;
    }
    setNowOpen(false);
    setBell(null);
    setFleetOpen(false);
    onPanel(next, stop, reportMissionId, focus);
  };

  const active: DockTab | null = bell ? null : tabOfPanel(panel, fleetOpen);

  const onSelect = (tab: DockTab): void => {
    setNowOpen(false);
    const action = dockAction(tab, active);
    switch (action.kind) {
      case 'stay':
        return;
      case 'home':
        setHomeRequest((n) => n + 1);
        return;
      case 'galaxy':
        clearPages();
        return;
      case 'fleet':
        clearPages();
        setFleetOpen(true);
        return;
      case 'panel':
        route(action.panel);
        return;
    }
  };

  return (
    <div className="v2-shell relative z-10 flex h-dvh flex-col overflow-hidden bg-v2-void">
      <HudTop
        commander={commander}
        onCommander={() => { route('menu'); }}
        onWorlds={() => {
          clearPages();
          setWorldsRequest((n) => n + 1);
        }}
        onEconomy={() => { route('planet', undefined, undefined, { group: 'grow' }); }}
        onBell={() => { openBell('signals'); }}
        nowOpen={nowOpen}
        onNow={setNowOpen}
      />

      <main className="relative flex-1">{galaxy({ homeRequest, worldsRequest, onPanel: route })}</main>

      <div className="relative z-50 shrink-0">
        <HudDock active={active} onSelect={onSelect} />
      </div>

      {fleetOpen && (
        <FleetSheet
          flight={flight}
          onFocus={(focus) => { onFocusCraft(focus); }}
          onClose={() => { setFleetOpen(false); }}
        />
      )}

      {bell && (
        <BellHost
          tab={bell.tab}
          justRead={bell.justRead}
          onTab={(tab) => {
            // Switching to Signals is its first sight of the feed if the bell opened elsewhere.
            const justRead = tab === 'signals' && bell.tab !== 'signals' && bell.justRead.size === 0
              ? openSignals()
              : bell.justRead;
            setBell({ tab, justRead });
          }}
          onClose={() => { setBell(null); }}
          onGo={route}
          onFocusPlanet={onFocusPlanet}
          onOpenPlanet={() => { route('planet'); }}
        />
      )}
    </div>
  );
}
