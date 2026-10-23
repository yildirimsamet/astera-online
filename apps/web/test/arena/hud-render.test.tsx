import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, createSandboxWorld } from '@astera/rules/arena';
import type { HudBind } from '../../src/arena/Hud.js';
import type * as Landmarks from '../../src/arena/landmarks.js';
import { createHudStore } from '../../src/arena/store.js';

const places = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../src/arena/landmarks.js', async original => {
  const actual = await original<typeof Landmarks>();
  return { ...actual, placesOf: (...args: Parameters<typeof actual.placesOf>) => { places.calls++; return actual.placesOf(...args); } };
});
const { ArenaHud } = await import('../../src/arena/Hud.js');

/**
 * V6g, 2026-10-22: the HUD's numbers change ten times a second, and each change rebuilt every
 * marker the client moves by hand (twelve enemies, threats, every landmark, pings): on the S22
 * that, not the 3D frame, was most of the frame.
 */
const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };

describe('the HUD at ten updates a second', () => {
  it('shows the new numbers without rebuilding the markers the client moves', () => {
    const world = createSandboxWorld({ bots: 0 });
    const store = createHudStore();
    store.publish(world, 'flight', false, false);
    const view = render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />);
    const built = places.calls;
    for (const speed of [40, 80, 120]) {
      world.pilot.s = speed;
      act(() => { store.publish(world, 'flight', false, false); });
    }
    expect(view.container.querySelector('.ah-speed strong')?.textContent).toBe('120');
    expect(places.calls).toBe(built);
  });
});

/**
 * Owner 2026-10-22: the rear-view window goes. It drew the whole scene a second time, 41 % of
 * a dogfight's triangles and 27 % of its draws; it may come back as something cheaper.
 */
describe('the instrument row', () => {
  it('has no rear-view window: radar on the left, speed on the right', () => {
    const store = createHudStore();
    store.publish(createSandboxWorld({ bots: 0 }), 'flight', false, false);
    const view = render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />);
    expect(view.container.querySelector('.ah-rear')).toBeNull();
    const row = view.container.querySelector('.ah-instruments');
    expect(row?.firstElementChild?.classList.contains('ah-radar')).toBe(true);
    expect(row?.lastElementChild?.classList.contains('ah-speed')).toBe(true);
  });
});
