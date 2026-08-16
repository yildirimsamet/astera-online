import { describe, expect, it } from 'vitest';
import { statusOf } from '../src/shell/Signals.js';
import { TAB_OF } from '../src/screens/PlanetScreen.js';
import type { PlanetView } from '../src/api/schemas.js';

/**
 * The signals list is the only place the game tells a player something without
 * being asked, so what it decides to say is a product decision, not a display
 * detail. These pin the two things that must never drift: a full store has to
 * surface as a LOSS, and it must never look like an event.
 */

const view = (over: Partial<PlanetView['planet']> = {}): PlanetView =>
  ({
    planet: {
      id: 'p1',
      name: 'Kestrel-12',
      position: { x: 0, y: 0, z: 0 },
      alloy: 0,
      crystal: 0,
      alloyCap: 6000,
      crystalCap: 2000,
      alloyPerHour: 600,
      crystalPerHour: 200,
      vaultFloor: 300,
      shield: 0,
      disruptedUntil: null,
      ...over,
    },
  }) as PlanetView;

describe('what the game volunteers', () => {
  it('says nothing when there is nothing to say', () => {
    expect(statusOf(view(), { alloy: 100, crystal: 50 })).toEqual([]);
  });

  /**
   * The cap already exists in the rules (ECON.capHours = 12) and has always
   * stopped production silently. Stating it as an hourly loss is the whole
   * retention hook the design is allowed to have.
   */
  it('reports a full store as production being thrown away', () => {
    const status = statusOf(view(), { alloy: 6000, crystal: 50 });
    expect(status).toHaveLength(1);
    expect(status[0]?.line).toBe('Alloy store is full');
    expect(status[0]?.detail).toContain('thrown away');
    expect(status[0]?.go).toBe('planet');
  });

  it('warns before the ceiling, in time rather than in percent', () => {
    // 5,400 of 6,000 at 600/h — an hour of room left.
    const status = statusOf(view(), { alloy: 5400, crystal: 50 });
    expect(status[0]?.line).toBe('Alloy store almost full');
    expect(status[0]?.detail).toContain('1h');
  });

  it('stays quiet below the warning band', () => {
    expect(statusOf(view(), { alloy: 4700, crystal: 50 })).toEqual([]);
  });

  /** Both stores fill independently, and a player needs to know which one. */
  it('names each store separately', () => {
    const status = statusOf(view(), { alloy: 6000, crystal: 2000 });
    expect(status.map((s) => s.line)).toEqual([
      'Alloy store is full',
      'Crystal store is full',
    ]);
  });

  /**
   * A store with no production cannot fill, and telling a raided player their
   * empty store is "almost full" is worse than saying nothing.
   */
  it('does not predict a fill for a store that is not producing', () => {
    const status = statusOf(view({ alloyPerHour: 0 }), { alloy: 5400, crystal: 50 });
    expect(status).toEqual([]);
  });

  it('leads with the works being offline, which outranks any store', () => {
    const disruptedUntil = new Date(Date.now() + 90 * 60_000);
    const status = statusOf(view({ disruptedUntil }), { alloy: 6000, crystal: 2000 });
    expect(status[0]?.line).toBe('Your works are offline');
    expect(status[0]?.tone).toBe('threat');
  });

  it('forgets a disruption that has already expired', () => {
    const disruptedUntil = new Date(Date.now() - 60_000);
    expect(statusOf(view({ disruptedUntil }), { alloy: 10, crystal: 10 })).toEqual([]);
  });
});

/**
 * Every requirement on the planet screen is a button that jumps to the thing that
 * would satisfy it — and since the screen is now tabbed, jumping means switching
 * tab as well as scrolling. A row missing from this map lands the player on the
 * right row of a tab they are not looking at.
 */
describe('the requirement jump', () => {
  it('knows which tab every purchasable thing lives under', () => {
    for (const id of [
      'CORE',
      'REFINERY',
      'EXTRACTOR',
      'VAULT',
      'SHIPYARD',
      'RING',
      'TELESCOPE',
      'RADAR',
      'VEIL',
      'AEGIS',
    ]) {
      expect(TAB_OF[id], `${id} has no home tab`).toBeDefined();
    }
  });
});
