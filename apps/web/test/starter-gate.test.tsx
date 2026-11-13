import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { openFeatures, openingProgress, type VesselProgress } from '@astera/rules';
import { describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { keys } from '../src/api/keys.js';
import type { BuildOrderView } from '../src/api/schemas.js';
import { buildOrderArt, buildOrderLabel } from '../src/lib/orders.js';
import { readsForPrivateEvent } from '../src/session/shardEvents.js';
import { forgetFresh, gateOf, nextFresh, pressFresh, rememberFresh } from '../src/starter/gate.js';
import { tabLockLine } from '../src/starter/shipCopy.js';
import { Dock } from '../src/v2/hud/Dock.js';
import { TopBar } from '../src/v2/hud/TopBar.js';
import { WorksLine } from '../src/v2/hud/WorksLine.js';
import type { CollectState } from '../src/lib/collect.js';
import { wireVessel } from './starterVesselFixture.js';

const aboard = (progress: VesselProgress) => vesselSchema.parse(wireVessel({ progress }));
const badges = { base: false, fleet: { airborne: 0, progress: null }, intel: 0, clan: 0 };

describe('the gate', () => {
  it('leaves everything open for a commander with no ship', () => {
    const gate = gateOf(undefined);
    expect(gate.aboard).toBe(false);
    expect(gate.open('fleet')).toBe(true);
    expect(gate.lockedTabs).toEqual([]);
    expect(gate.tabLock('clan')).toBeNull();
  });

  it('opens what the ship has repaired, as the server says', () => {
    const gate = gateOf(aboard(openingProgress()));
    expect(gate.aboard).toBe(true);
    expect(gate.open('production')).toBe(true);
    expect(gate.open('intel')).toBe(false);
    expect([...openFeatures(openingProgress())].every(feature => gate.open(feature))).toBe(true);
  });

  it('keeps Galaxy and Base open on a new ship and locks the other three', () => {
    expect(gateOf(aboard(openingProgress())).lockedTabs).toEqual(['fleet', 'intel', 'clan']);
  });

  it('names the repair that opens a tab, so a locked tab can say why', () => {
    const gate = gateOf(aboard(openingProgress()));
    expect(gate.tabLock('intel')).toEqual({ kind: 'repair', module: 'SURVEY' });
    expect(gate.tabLock('fleet')).toEqual({ kind: 'repair', module: 'SHIPYARD' });
  });

  it('opens a tab when its system is repaired', () => {
    const gate = gateOf(aboard({ ...openingProgress(), modules: { REFINERY: 1, SURVEY: 1 } }));
    expect(gate.lockedTabs).toEqual(['fleet', 'clan']);
    expect(gate.tabLock('intel')).toBeNull();
  });

  it('keeps the clan shut for the whole of the ship: it is a promise of the main galaxy', () => {
    const everything = { ...openingProgress(), modules: { REFINERY: 4, SURVEY: 2, SHIPYARD: 1, HANGAR: 3 } };
    expect(gateOf(aboard(everything)).tabLock('clan')).toEqual({ kind: 'mainGalaxy' });
  });
});

describe('the top bar on a ship', () => {
  const stock = { alloy: { value: 1, cap: 9, safe: 0 }, crystal: { value: 1, cap: 9, safe: 0 }, deuterium: { value: 1, cap: 9, safe: 0 } };
  const bar = (hidden?: readonly ('alloy' | 'crystal' | 'deuterium')[]) => render(<TopBar
    commander="x" shield={null} now={0} world={null} stock={stock} bell={{ unseen: 0, urgent: false }} rewards={0} boosted={false}
    onCommander={vi.fn()} onRewards={vi.fn()} onWorld={vi.fn()} onResource={vi.fn()} onBell={vi.fn()} {...(hidden ? { hidden } : {})} />);

  it('leaves out a resource nothing aboard can use yet', () => {
    bar(['deuterium']);
    expect(screen.queryByRole('button', { name: /deuterium/i })).toBeNull();
    expect(screen.getByRole('button', { name: /alloy/i })).toBeInTheDocument();
  });

  it('shows all three with nothing hidden', () => {
    bar();
    expect(screen.getByRole('button', { name: /deuterium/i })).toBeInTheDocument();
  });
});

describe('the works line on a ship', () => {
  it('leaves out the vessel of a hidden resource', () => {
    const state: CollectState = { waiting: 0, ripe: false, full: false, movable: 0, blocked: false, each: { alloy: 0, crystal: 0, deuterium: 0 }, noRoom: [], stopped: [] };
    const line = (hidden?: readonly ('alloy' | 'crystal' | 'deuterium')[]) => render(<WorksLine
      state={state} fill={{ alloy: 0, crystal: 0, deuterium: 0 }} fullInMinutes={null} pending={false}
      onCollect={vi.fn()} onOpenBase={vi.fn()} {...(hidden ? { hidden } : {})} />);
    const all = line().container.querySelectorAll('img').length;
    cleanup();
    expect(line(['deuterium']).container.querySelectorAll('img').length).toBe(all - 1);
  });
});

describe('what the stream moves', () => {
  it('a ship event refreshes the ship, the jump panel, which is read only while it is open, and the news it was published with', () => {
    // Every ship event is an order finishing, and each one writes the line that tells the player: unread, it was never shown.
    expect(readsForPrivateEvent('private:vessel')).toEqual([keys.planet, keys.planets, keys.notifications, keys.migration]);
  });
});

describe('a queued repair, on the surfaces that list orders', () => {
  const order = (subject: string): BuildOrderView => ({
    id: 'o', queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject, count: 1,
    startedAt: new Date(0), finishesAt: new Date(1), cost: { alloy: 1, crystal: 1, deuterium: 0 },
  });

  it('names a module only a ship has', () => {
    expect(buildOrderLabel(order('SURVEY'))).toBe('Survey antenna');
    expect(buildOrderLabel(order('DRIVE_THRUST'))).toBe('Thrust assembly');
  });

  it('keeps the main name for a module the main game has', () => {
    expect(buildOrderLabel(order('REFINERY'))).toBe('Alloy Refinery');
  });

  it('draws no picture it does not have', () => {
    expect(buildOrderArt(order('SURVEY'))).toBeNull();
  });
});

describe('what a locked tab says', () => {
  it('names the repair', () => {
    expect(tabLockLine({ kind: 'repair', module: 'SURVEY' })).toContain('Survey antenna');
  });

  it('promises the clan for the main galaxy', () => {
    expect(tabLockLine({ kind: 'mainGalaxy' })).toMatch(/main galaxy/);
  });
});

describe('which tabs are new', () => {
  it('marks a tab the moment it leaves the locked list, and keeps it until pressed', () => {
    const first = nextFresh({ wasLocked: ['fleet', 'intel', 'clan'], fresh: [] }, ['intel', 'clan']);
    expect(first.fresh).toEqual(['fleet']);
    expect(first.wasLocked).toEqual(['intel', 'clan']);
    const later = nextFresh(first, ['clan']);
    expect(later.fresh).toEqual(['fleet', 'intel']);
    expect(pressFresh(later, 'fleet').fresh).toEqual(['intel']);
  });

  it('marks nothing on a first look, before anything was seen locked', () => {
    expect(nextFresh({ wasLocked: [], fresh: [] }, ['fleet', 'intel', 'clan']).fresh).toEqual([]);
  });

  it('keeps it across a reload', () => {
    localStorage.clear();
    expect(rememberFresh(['fleet', 'intel', 'clan']).fresh).toEqual([]);
    expect(rememberFresh(['intel', 'clan']).fresh).toEqual(['fleet']);
    forgetFresh('fleet');
    expect(rememberFresh(['intel', 'clan']).fresh).toEqual([]);
  });
});

describe('a locked tab on the dock', () => {
  /** G1-a (2026-11-14): the kit's bottom bar says why in place, over the dock, with the refusal's sound. */
  it('still answers a press, and says why it is shut without opening', () => {
    const onSelect = vi.fn();
    render(<Dock active="galaxy" badges={badges} onSelect={onSelect} locked={{ clan: tabLockLine({ kind: 'mainGalaxy' }) }} />);
    const tab = screen.getByRole('button', { name: /clan/i });
    expect(tab).not.toBeDisabled();
    expect(tab).toHaveAttribute('data-locked');
    fireEvent.pointerDown(tab, { button: 0 });
    fireEvent.click(tab, { detail: 1 });
    expect(screen.getByRole('status')).toHaveTextContent(tabLockLine({ kind: 'mainGalaxy' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Owner 2026-11-06: the padlock comes back. The tab still answers and says why; the lock says "not yet".
  it('wears a padlock, and says so aloud', () => {
    render(<Dock active="galaxy" badges={badges} onSelect={vi.fn()} locked={{ clan: 'Shipyard 2' }} />);
    const tab = screen.getByRole('button', { name: /clan/i });
    expect(tab.querySelector('.gk-nav__lock')).not.toBeNull();
    expect(tab.getAttribute('aria-label')).toMatch(/locked/i);
    expect(screen.getByRole('button', { name: /base/i }).querySelector('.gk-nav__lock')).toBeNull();
  });

  it('lights a tab that has just opened, with a "New" mark', () => {
    render(<Dock active="galaxy" badges={badges} onSelect={vi.fn()} fresh={['fleet']} />);
    const tab = screen.getByRole('button', { name: /fleet/i });
    expect(tab).toHaveAttribute('data-fresh');
    expect(tab.textContent).toContain('New');
    expect(screen.getByRole('button', { name: /intel/i })).not.toHaveAttribute('data-fresh');
  });

  it('marks only the locked ones', () => {
    render(<Dock active="galaxy" badges={badges} onSelect={vi.fn()} locked={{ clan: 'Shipyard 2' }} />);
    expect(screen.getByRole('button', { name: /base/i })).not.toHaveAttribute('data-locked');
  });

  it('draws as ever with nothing locked', () => {
    render(<Dock active="galaxy" badges={badges} onSelect={vi.fn()} />);
    expect(document.querySelector('[data-locked]')).toBeNull();
  });
});
