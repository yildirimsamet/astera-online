import { type StarterFeature, type VesselModule } from '@astera/rules';
import { usePlanet } from '../api/queries.js';
import type { VesselView } from '../api/starterSchemas.js';
import { DOCK_TABS, type DockTab } from '../lib/dock.js';

export type TabLock = { kind: 'repair'; module: VesselModule } | { kind: 'mainGalaxy' };

/** The tabs a repair opens, and the repair the tab names when it is pressed shut. */
const REPAIRED_TABS: Partial<Record<DockTab, { feature: StarterFeature; module: VesselModule }>> = {
  fleet: { feature: 'fleet', module: 'SHIPYARD' },
  intel: { feature: 'intel', module: 'SURVEY' },
};

export interface StarterGate {
  aboard: boolean;
  open: (feature: StarterFeature) => boolean;
  tabLock: (tab: DockTab) => TabLock | null;
  lockedTabs: readonly DockTab[];
}

const NO_GATE: StarterGate = { aboard: false, open: () => true, tabLock: () => null, lockedTabs: [] };

/**
 * WHAT A SHIP HAS OPENED, as the menus read it. Plan §3.7. With no ship everything is open, so no
 * main-galaxy commander goes through any of this. It only draws: the server refuses a closed system
 * on its own (`assertFeatureOpen`).
 */
export function gateOf(vessel: VesselView | undefined): StarterGate {
  if (!vessel) return NO_GATE;
  const open = (feature: StarterFeature): boolean => vessel.features.includes(feature);
  const tabLock = (tab: DockTab): TabLock | null => {
    if (tab === 'clan') return { kind: 'mainGalaxy' };
    const door = REPAIRED_TABS[tab];
    return door && !open(door.feature) ? { kind: 'repair', module: door.module } : null;
  };
  return { aboard: true, open, tabLock, lockedTabs: DOCK_TABS.filter(tab => tabLock(tab) !== null) };
}

export const useStarterGate = (): StarterGate => gateOf(usePlanet().data?.vessel);

/** Tabs seen locked, and tabs opened since but not yet pressed. */
export interface FreshTabs { wasLocked: readonly DockTab[]; fresh: readonly DockTab[] }

/**
 * A TAB THAT HAS JUST OPENED SHINES until it is first pressed (owner 2026-11-06: "açılan sekme
 * vurgulansın"). Only a tab once seen locked can be new; a first look marks nothing.
 */
export function nextFresh(previous: FreshTabs, locked: readonly DockTab[]): FreshTabs {
  const opened = previous.wasLocked.filter(tab => !locked.includes(tab));
  const fresh = [...new Set([...previous.fresh, ...opened])].filter(tab => !locked.includes(tab));
  return { wasLocked: [...locked], fresh };
}

export const pressFresh = (state: FreshTabs, tab: DockTab): FreshTabs => ({ ...state, fresh: state.fresh.filter(each => each !== tab) });

const FRESH_KEY = 'astera.dock.fresh';
const isTab = (value: unknown): value is DockTab => typeof value === 'string' && (DOCK_TABS as readonly string[]).includes(value);

function readFresh(): FreshTabs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(FRESH_KEY) ?? 'null');
    if (raw && typeof raw === 'object' && 'wasLocked' in raw && 'fresh' in raw && Array.isArray(raw.wasLocked) && Array.isArray(raw.fresh)) {
      return { wasLocked: raw.wasLocked.filter(isTab), fresh: raw.fresh.filter(isTab) };
    }
  } catch { /* A private window starts over. */ }
  return { wasLocked: [], fresh: [] };
}

function writeFresh(state: FreshTabs): void {
  try { localStorage.setItem(FRESH_KEY, JSON.stringify(state)); } catch { /* Nothing kept. */ }
}

/** The stored state, moved on by what is locked now. */
export function rememberFresh(locked: readonly DockTab[]): FreshTabs {
  const next = nextFresh(readFresh(), locked);
  writeFresh(next);
  return next;
}

export function forgetFresh(tab: DockTab): void {
  writeFresh(pressFresh(readFresh(), tab));
}
