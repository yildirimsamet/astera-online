import { describe, expect, it } from 'vitest';
import { bellTabFor, dockAction, tabOfPanel } from '../../src/lib/shellRoute.js';

/**
 * WHERE THE DOCK POINTS. Spec B4, K1 and the "every surface's new place" table
 * (docs/ui-v2/gozlemevi.md).
 *
 * The galaxy never closes; every other tab is a page over it. The dock lights the
 * tab whose page is open, pressing Galaxy clears the pages and pressing it again
 * flies home, and chat and the chronicle now live under the bell.
 */

describe('which tab is lit', () => {
  it('lights Galaxy when no page is open', () => {
    expect(tabOfPanel(null, false)).toBe('galaxy');
  });

  it('lights the tab that owns the open page', () => {
    expect(tabOfPanel('planet', false)).toBe('base');
    expect(tabOfPanel('research', false)).toBe('base');
    expect(tabOfPanel('intel', false)).toBe('intel');
    expect(tabOfPanel('report', false)).toBe('intel');
    expect(tabOfPanel('clan', false)).toBe('clan');
    expect(tabOfPanel(null, true)).toBe('fleet');
  });

  it('lights nothing for a page the dock does not own', () => {
    expect(tabOfPanel('menu', false)).toBeNull();
    expect(tabOfPanel('leaderboard', false)).toBeNull();
  });
});

describe('what a tab does', () => {
  it('opens its page', () => {
    expect(dockAction('base', 'galaxy')).toEqual({ kind: 'panel', panel: 'planet' });
    expect(dockAction('intel', 'base')).toEqual({ kind: 'panel', panel: 'intel' });
    expect(dockAction('clan', null)).toEqual({ kind: 'panel', panel: 'clan' });
    expect(dockAction('fleet', 'galaxy')).toEqual({ kind: 'fleet' });
  });

  it('clears the pages from Galaxy, and flies home when Galaxy is already lit', () => {
    expect(dockAction('galaxy', 'intel')).toEqual({ kind: 'galaxy' });
    expect(dockAction('galaxy', null)).toEqual({ kind: 'galaxy' });
    expect(dockAction('galaxy', 'galaxy')).toEqual({ kind: 'home' });
  });

  it('leaves an open page alone when its own tab is pressed again', () => {
    expect(dockAction('base', 'base')).toEqual({ kind: 'stay' });
    expect(dockAction('fleet', 'fleet')).toEqual({ kind: 'stay' });
  });
});

describe('what moved under the bell', () => {
  /** Owner, 2026-09-24: chat left the bell for its own page; the chronicle stays. */
  it('sends the chronicle to the bell sheet, and chat to a page of its own', () => {
    expect(bellTabFor('chat')).toBeNull();
    expect(bellTabFor('chronicle')).toBe('chronicle');
    expect(bellTabFor('planet')).toBeNull();
    expect(bellTabFor(null)).toBeNull();
  });
});
