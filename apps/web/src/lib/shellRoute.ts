import type { Panel } from '../screens/GalaxyView.jsx';
import type { DockTab } from './dock.js';

/** The pages each dock tab owns. The galaxy owns none: it is what they open over. */
const OWNER: Partial<Record<NonNullable<Panel>, DockTab>> = {
  planet: 'base',
  research: 'base',
  intel: 'intel',
  report: 'intel',
  clan: 'clan',
};

/**
 * THE TAB TO LIGHT. Spec B4.
 *
 * No page open is the galaxy; a page the dock does not own (the commander page,
 * a leaderboard) lights nothing rather than a tab that is not where the player is.
 */
export function tabOfPanel(panel: Panel, fleetOpen: boolean): DockTab | null {
  if (fleetOpen) return 'fleet';
  if (panel === null) return 'galaxy';
  return OWNER[panel] ?? null;
}

export type DockAction =
  | { kind: 'panel'; panel: 'planet' | 'intel' | 'clan' }
  | { kind: 'fleet' }
  | { kind: 'galaxy' }
  | { kind: 'home' }
  | { kind: 'stay' };

const PAGE = { base: 'planet', intel: 'intel', clan: 'clan' } as const;

/**
 * WHAT A TAB PRESS DOES. Spec B4.
 *
 * Galaxy clears the pages; pressed while already lit it flies the camera to the
 * active world. Any other tab opens its page, and does nothing when that page is
 * already the one open.
 */
export function dockAction(tab: DockTab, active: DockTab | null): DockAction {
  if (tab === 'galaxy') return active === 'galaxy' ? { kind: 'home' } : { kind: 'galaxy' };
  if (tab === active) return { kind: 'stay' };
  if (tab === 'fleet') return { kind: 'fleet' };
  return { kind: 'panel', panel: PAGE[tab] };
}

/**
 * K1: the chronicle is a tab of the bell sheet, not a page of its own. Chat was too,
 * until the owner gave it back its own page and button (2026-09-24): `GameShell`
 * opens it itself.
 */
export function bellTabFor(panel: Panel): 'chronicle' | null {
  return panel === 'chronicle' ? panel : null;
}
