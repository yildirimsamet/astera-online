import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { DockTab } from '../../lib/dock.js';
import { DESK_QUERY, useMedia } from '../../lib/media.js';
import { shortcutOf } from '../../lib/shortcuts.js';
import { bellTabFor, dockAction, tabOfPanel } from '../../lib/shellRoute.js';
import type { Panel, PanelStop } from '../../screens/GalaxyView.jsx';
import type { StripFocus } from '../../shell/PendingStrip.js';
import { useOpenSignals } from '../../shell/Signals.js';
import type { BellTab } from '../hud/BellSheet.js';
import type { AwayDoor } from '../../lib/awayStory.js';
import type { ChatChannel } from '../../screens/ChatScreen.js';
import { AwayHost } from './AwayHost.js';
import { BellHost } from './BellHost.js';
import { ChatHost } from './ChatHost.js';
import { FleetHost } from './FleetHost.js';
import { REPAIR_STATION_ITEM } from '../../lib/repairStation.js';
import { HudDock } from './HudDock.js';
import { HudTop } from './HudTop.js';
import { OutlineHost } from './OutlineHost.js';

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
  /** Frame a world on the galaxy; `dossier` opens its dossier too (a sighting's "Open the dossier", M4). */
  onFocusPlanet: (planetId: string, options?: { dossier?: boolean; select?: boolean }) => void;
  /** Frame one of the player's craft (or a contact) from the Fleet page. */
  onFocusCraft: (focus: StripFocus) => void;
  /**
   * The galaxy, handed the shell's counted requests and its router: fly home, open the
   * worlds, bring the selection into view (Space), let go of it (Esc).
   */
  galaxy: (shell: {
    homeRequest: number;
    worldsRequest: number;
    centerRequest: number;
    clearRequest: number;
    onPanel: ShellRoute;
    /**
     * Open chat as its own page, on a given room (the war room's "Clan chat", E9) — with a
     * clan line to start from where one is handed over (a report told to the clan, M4).
     */
    onOpenChat: (channel?: ChatChannel, draft?: string) => void;
  }) => ReactNode;
}

/**
 * THE v2 SHELL. Spec B1–B4, K1 and the "every surface's new place" table
 * (docs/ui-v2/gozlemevi.md).
 *
 * The top bar and the Now line above the galaxy, the dock under it, and the three
 * sheets the shell owns itself: the bell (signals, chronicle), chat and the Fleet
 * page. The galaxy never unmounts; every page opens over it and sits above
 * the dock (`.v2-shell` publishes `--v2-dock-h`, which both sheet kits read), so
 * a tab is always one press from any page.
 *
 * The chronicle is a bell tab (K1): a route to it opens the bell instead of a page.
 * Chat is its own page (owner, 2026-09-24), opened from its button on the galaxy.
 * Opening the bell on Signals marks the feed read, as the old beacon did; opening it
 * on the chronicle, or opening chat, does not — nobody has seen the signals yet.
 *
 * ON A DESK (E11 · K10, ≥1100 px) the phone is not scaled up: the tabs move into the
 * top bar, the outline (worlds, flights, queues) opens as a column beside the galaxy,
 * and pages dock to the right (both sheet kits). The keyboard works at every width:
 * 1–5 the tabs, Space the selection, Esc lets go (`shortcutOf`).
 */
export function GameShell({ commander, panel, onPanel, onFocusPlanet, onFocusCraft, galaxy }: GameShellProps) {
  const [bell, setBell] = useState<{ tab: BellTab; justRead: ReadonlySet<string> } | null>(null);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatChannel, setChatChannel] = useState<ChatChannel | undefined>(undefined);
  const [chatDraft, setChatDraft] = useState<string | undefined>(undefined);
  /** The Now line's timers sheet: closed by every move below, never left under a page. */
  const [nowOpen, setNowOpen] = useState(false);
  const [homeRequest, setHomeRequest] = useState(0);
  const [worldsRequest, setWorldsRequest] = useState(0);
  const [centerRequest, setCenterRequest] = useState(0);
  const [clearRequest, setClearRequest] = useState(0);
  const openSignals = useOpenSignals();
  const desk = useMedia(DESK_QUERY);
  const top = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState<number | null>(null);

  /**
   * The top bar and the Now line are as tall as what they hold; a page docked to the
   * right on a wide screen starts under both (`--v2-top-h`, read by both sheet kits).
   */
  useEffect(() => {
    const node = top.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => { setTopHeight(node.offsetHeight); });
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  /** Leave whatever page is open, so the next thing opens alone. */
  const clearPages = (): void => {
    setNowOpen(false);
    setBell(null);
    setFleetOpen(false);
    setChatOpen(false);
    if (panel !== null) onPanel(null);
  };

  const openBell = (tab: BellTab): void => {
    setNowOpen(false);
    setFleetOpen(false);
    setChatOpen(false);
    if (panel !== null) onPanel(null);
    setBell({ tab, justRead: tab === 'signals' ? openSignals() : new Set() });
  };

  /** Chat, its own page: on the room asked for, or — with none — on what is unread. */
  const openChat = (channel?: ChatChannel, draft?: string): void => {
    clearPages();
    setChatChannel(channel);
    setChatDraft(draft);
    setChatOpen(true);
  };

  const route: ShellRoute = (next, stop, reportMissionId, focus) => {
    const tab = bellTabFor(next);
    if (tab) {
      openBell(tab);
      return;
    }
    if (next === 'chat') {
      openChat();
      return;
    }
    setNowOpen(false);
    setBell(null);
    setFleetOpen(false);
    setChatOpen(false);
    onPanel(next, stop, reportMissionId, focus);
  };

  const active: DockTab | null = bell || chatOpen ? null : tabOfPanel(panel, fleetOpen);

  /** Where each line of the return story (E10) takes the player; a world's door carries its id. */
  const openAway = (door: AwayDoor, planetId?: string): void => {
    switch (door) {
      case 'report':
        route('intel', 'battles');
        return;
      case 'intel':
        route('intel');
        return;
      case 'base':
        route('planet', undefined, undefined, { group: 'grow' });
        return;
      case 'orbit':
        route('planet', undefined, undefined, { group: 'orbit' });
        return;
      case 'signals':
        openBell('signals');
        return;
      case 'dossier':
        if (planetId === undefined) return;
        clearPages();
        onFocusPlanet(planetId, { dossier: true });
        return;
      case 'repair':
        // The faults lead that world's Base (E5), so its Base is the repair.
        route('planet', undefined, undefined, planetId === undefined ? undefined : { planetId });
        return;
    }
  };

  const onSelectTab = (tab: DockTab): void => {
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

  // The keys read the latest routing without re-subscribing on every render.
  const selectTab = useRef(onSelectTab);
  selectTab.current = onSelectTab;
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const shortcut = shortcutOf(event, document.querySelector('[data-sheet-panel]') !== null);
      if (shortcut === null) return;
      if (shortcut.kind === 'tab') selectTab.current(shortcut.tab);
      else if (shortcut.kind === 'center') setCenterRequest((n) => n + 1);
      else setClearRequest((n) => n + 1);
      // Space would scroll the page under the galaxy; a number has nothing to type into.
      if (shortcut.kind !== 'clear') event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  const dock = (
    <HudDock active={active} onSelect={onSelectTab} over={active !== 'galaxy' || nowOpen} bar={desk} />
  );

  return (
    <div
      className="v2-shell relative z-10 flex h-dvh flex-col overflow-hidden bg-v2-void"
      {...(topHeight === null ? {} : { style: { '--v2-top-h': `${String(topHeight)}px` } as CSSProperties })}
    >
      <div ref={top} className="shrink-0">
      <HudTop
        commander={commander}
        onCommander={() => { route('menu'); }}
        onRewards={() => { route('rewards'); }}
        onWorlds={() => {
          clearPages();
          setWorldsRequest((n) => n + 1);
        }}
        onEconomy={() => { route('planet', undefined, undefined, { group: 'grow' }); }}
        onBell={() => { openBell('signals'); }}
        nowOpen={nowOpen}
        onNow={setNowOpen}
        onFocusCraft={onFocusCraft}
        {...(desk ? { tabs: dock } : {})}
      />
      </div>

      {/*
        THE GALAXY RUNS UNDER THE DOCK (owner, 2026-09-24): the dock is see-through and floats over
        the bottom of the scene, so everything the galaxy anchors to its foot sits `--v2-dock-h` up.
      */}
      <div className="relative flex min-h-0 flex-1">
        {desk && (
          <OutlineHost
            onFocusPlanet={(planetId) => {
              clearPages();
              // A world row selects that world, not only frames it (owner report, 2026-10-06).
              onFocusPlanet(planetId, { select: true });
            }}
            onFocusCraft={(focus) => {
              clearPages();
              onFocusCraft(focus);
            }}
            onRoute={route}
          />
        )}
        <main className="relative min-w-0 flex-1">
          {galaxy({ homeRequest, worldsRequest, centerRequest, clearRequest, onPanel: route, onOpenChat: openChat })}
          {!desk && <div className="absolute inset-x-0 bottom-0 z-50">{dock}</div>}
        </main>
      </div>

      {/* E10: asked for after the galaxy is up, never before it (K5). */}
      <AwayHost onDoor={openAway} onAll={() => { openBell('signals'); }} />

      {fleetOpen && (
        <FleetHost
          onFocus={(focus) => { onFocusCraft(focus); }}
          onClose={() => { setFleetOpen(false); }}
          // The world, its Base on the Fleet tab, and the station open on it: one press.
          onOpenRepairStation={(planetId) => {
            route('planet', undefined, undefined, { planetId, group: 'reach', itemId: REPAIR_STATION_ITEM });
          }}
        />
      )}

      {chatOpen && (
        <ChatHost
          onClose={() => { setChatOpen(false); }}
          onFocusPlanet={onFocusPlanet}
          {...(chatChannel ? { channel: chatChannel } : {})}
          {...(chatDraft ? { draft: chatDraft } : {})}
        />
      )}

      {bell && (
        <BellHost
          onFocusMonument={(id) => { onFocusCraft({ kind: 'monument', id }); }}
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
