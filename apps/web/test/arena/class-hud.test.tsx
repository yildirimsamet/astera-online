import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, CLASS_STATS, createPilot, createSandboxWorld, type Pilot, type ShipClass } from '@astera/rules/arena';
import { FlightControls } from '../../src/arena/Controls.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

/** Y4: every gauge reads against the class the pilot flies — its hull, tank, hold and magazine. */
const flying = (ship: ShipClass, patch: Partial<Pilot> = {}) => {
  const world = createSandboxWorld({ bots: 0, ship });
  Object.assign(world.pilot, patch);
  const store = createHudStore();
  store.publish(world, 'flight', false, false);
  return store;
};
const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
const hud = (ship: ShipClass, patch: Partial<Pilot> = {}) =>
  render(<ArenaHud store={flying(ship, patch)} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />).container;

describe('a class\'s own gauges', () => {
  it('reads a full Muhafız as full, and half its hull as half', () => {
    expect(createPilot(1, 'muhafiz').hull).toBe(CLASS_STATS.muhafiz.hull);
    expect(hud('muhafiz').querySelector('.ah-hull strong')?.textContent).toMatch(/^100%/);
    expect(hud('muhafiz', { hull: CLASS_STATS.muhafiz.hull / 2 }).querySelector('.ah-hull strong')?.textContent).toMatch(/^50%/);
    // 340 is full for an Akıncı.
    expect(hud('akinci').querySelector('.ah-hull strong')?.textContent).toMatch(/^100%/);
  });

  it('counts the hold out of the class\'s own capacity', () => {
    const view = hud('muhafiz', { cargo: 80, hold: [80, 0, 0] });
    expect(view.querySelector('.ah-hold .ah-gauge-label')?.textContent).toContain(`80/${String(CLASS_STATS.muhafiz.cargoCapacity)}`);
    expect(hud('akinci', { cargo: CLASS_STATS.akinci.cargoCapacity, hold: [CLASS_STATS.akinci.cargoCapacity, 0, 0] })
      .querySelector('.ah-hold')?.classList.contains('is-full')).toBe(true);
  });

  it('fills the fuel bar from the class\'s own tank', () => {
    const fill = hud('akinci').querySelector<HTMLElement>('.ah-gauge:not(.ah-hull):not(.ah-hold)')?.style.getPropertyValue('--fill');
    expect(Number(fill)).toBeCloseTo(1, 6);
  });

  it('rings the FIRE key from the class\'s own magazine', () => {
    const view = render(<FlightControls controls={createControls()} store={flying('muhafiz', { ammo: CLASS_STATS.muhafiz.ammoCapacity / 2 })}
      onLand={() => undefined} onCancel={() => undefined} />);
    expect(view.container.querySelector<HTMLElement>('.ac-fire')?.style.getPropertyValue('--charge')).toBe('0.5');
  });
});
