import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, createPilot, createSandboxWorld } from '@astera/rules/arena';
import { arenaCopy } from '../../src/arena/copy.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createHudStore } from '../../src/arena/store.js';

/** Owner 2026-10-22 (item 9): tap the radar, the map opens; tap again (or close), it shuts. */
const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
const hud = () => {
  const world = createSandboxWorld();
  const store = createHudStore();
  store.publish(world, 'flight', false, false);
  return render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />);
};

describe('the map sheet', () => {
  it('shows living real clan friends, including cloaked friends, without disclosing rivals', () => {
    const world = createSandboxWorld({ bots: 0 }); world.pilot.clanId = 'clan';
    world.drones = [2, 3, 4, 5].map(id => createPilot(id));
    world.drones[0]!.clanId = 'clan'; world.drones[0]!.cloak = 10; world.drones[0]!.p.x = 800;
    world.drones[2]!.clanId = 'clan'; world.drones[2]!.phase = 'dead';
    world.drones[3]!.clanId = 'clan'; world.drones[3]!.decoyOf = 2;
    const store = createHudStore(); store.publish(world, 'flight', false, false);
    const view = render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />);
    fireEvent.click(view.getByRole('button', { name: arenaCopy().mapOpen }));
    expect(view.container.querySelectorAll('[data-friend-id]')).toHaveLength(1);
    expect(view.container.querySelector('[data-friend-id="2"]')).not.toBeNull();
    expect(view.container.querySelector('[data-friend-id="2"]')?.getAttribute('transform')).toBe('translate(-800 0)');
  });
  it('opens from the radar and shows exits, entries and the own ship, never an enemy', () => {
    const view = hud();
    expect(view.container.querySelector('.ah-map')).toBeNull();
    const radar = view.getByRole('button', { name: arenaCopy().mapOpen });
    fireEvent.click(radar);
    const map = view.container.querySelector('.ah-map');
    expect(map).not.toBeNull();
    expect(radar.getAttribute('aria-expanded')).toBe('true');
    expect(map?.querySelectorAll('[data-exit]')).toHaveLength(ARENA_LAYOUT.exits.length);
    expect(map?.querySelectorAll('[data-entry]')).toHaveLength(ARENA_LAYOUT.entries.length);
    expect(map?.querySelector('[data-self]')).not.toBeNull();
    expect(map?.querySelector('[data-enemy]')).toBeNull();
    // The places worth flying to, named: the cave and the station are where a chase is lost.
    for (const name of [arenaCopy().landmarks.cave, arenaCopy().landmarks.station, arenaCopy().landmarks.yard]) expect(map?.textContent).toContain(name);
    // Tersane: Gangut's ring and its two depot wings, drawn as such.
    expect(map?.querySelectorAll('.ah-map-mark.is-yard circle')).toHaveLength(1);
    expect(map?.querySelectorAll('.ah-map-mark.is-yard rect')).toHaveLength(2);
    // Eight outposts drawn, explained once in the legend (what they are for), never labelled eight times.
    expect(map?.querySelectorAll('.ah-map-mark.is-outpost')).toHaveLength(8);
    expect(map?.querySelector('footer ul')?.textContent).toContain(arenaCopy().mapOutpost);
    expect([...(map?.querySelectorAll('.ah-map-label') ?? [])].filter(l => l.textContent === arenaCopy().landmarks.outpost)).toHaveLength(0);
    // The harbour annex is the same kind of place (a kit farm with a back door): the outpost's
    // shape and legend line, beside the harbour's own label.
    expect(map?.querySelectorAll('.ah-map-mark.is-annex rect')).toHaveLength(1);
    expect([...(map?.querySelectorAll('.ah-map-label') ?? [])].filter(l => l.textContent === arenaCopy().landmarks.annex)).toHaveLength(0);
    // The heart's three refinery wings, the same way: drawn, explained once.
    expect(map?.querySelectorAll('.ah-map-mark.is-refinery')).toHaveLength(3);
    expect(map?.querySelector('footer ul')?.textContent).toContain(arenaCopy().mapRefinery);
    // The three caves, each drawn as it flies: Kovuk's tunnels, the canyon's winding fissure,
    // Petek's cells. All named; one legend line says what a cave is for.
    for (const name of [arenaCopy().landmarks.canyon, arenaCopy().landmarks.honeycomb]) expect(map?.textContent).toContain(name);
    expect(map?.querySelectorAll('.ah-map-mark.is-canyon .is-way')).toHaveLength(1);
    expect(map?.querySelectorAll('.ah-map-mark.is-honeycomb .is-cell').length).toBeGreaterThanOrEqual(5);
    expect(map?.querySelector('footer ul')?.textContent).toContain(arenaCopy().mapCave);
    // Names never print over each other near the heart: the heart's sits above it, a district's
    // on its outer side (the map is mirrored: Petek at 180° is east, Tersane at 0° west).
    const label = (name: string) => [...(map?.querySelectorAll('.ah-map-label') ?? [])].find(l => l.textContent === name);
    expect(label(arenaCopy().landmarks.hub)?.getAttribute('data-side')).toBe('top');
    expect(label(arenaCopy().landmarks.honeycomb)?.getAttribute('data-side')).toBe('east');
    expect(label(arenaCopy().landmarks.yard)?.getAttribute('data-side')).toBe('west');
    expect(label(arenaCopy().landmarks.station)?.getAttribute('data-side')).not.toBe(label(arenaCopy().landmarks.cave)?.getAttribute('data-side'));
    // Says why the enemies are missing, so the player does not read it as a quiet room.
    expect(map?.textContent).toContain(arenaCopy().mapNoShips);
  });

  it('closes on its close button and on a second tap of the radar', () => {
    const view = hud();
    const radar = view.getByRole('button', { name: arenaCopy().mapOpen });
    fireEvent.click(radar);
    fireEvent.click(view.getByRole('button', { name: arenaCopy().mapClose }));
    expect(view.container.querySelector('.ah-map')).toBeNull();
    fireEvent.click(radar);
    fireEvent.click(radar);
    expect(view.container.querySelector('.ah-map')).toBeNull();
  });
});
