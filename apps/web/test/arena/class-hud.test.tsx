import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, CLASS_STATS, createPilot, createSandboxWorld, type Pilot, type ShipClass } from '@astera/rules/arena';
import { FlightControls } from '../../src/arena/Controls.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';
import { arenaCopy } from '../../src/arena/copy.js';

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
    // 510 is full for an Akıncı.
    expect(hud('akinci').querySelector('.ah-hull strong')?.textContent).toMatch(/^100%/);
  });

  it('counts the hold out of the class\'s own capacity', () => {
    const view = hud('muhafiz', { cargo: 80, hold: [80, 0, 0] });
    expect(view.querySelector('.ah-hold .ah-gauge-label')?.textContent).toContain(`80/${String(CLASS_STATS.muhafiz.cargoCapacity)}`);
    expect(hud('akinci', { cargo: CLASS_STATS.akinci.cargoCapacity, hold: [CLASS_STATS.akinci.cargoCapacity, 0, 0] })
      .querySelector('.ah-hold')?.classList.contains('is-full')).toBe(true);
  });

  // Owner 2026-10-27: "depomda renk olarak … kabaca görebiliyorum ama sayı olarak göremiyorum".
  it('counts each kind aboard in its own colour, under the hold', () => {
    const kinds = hud('muhafiz', { cargo: 175, hold: [120, 46.6, 9] }).querySelectorAll<HTMLElement>('.ah-hold-kinds > b');
    expect([...kinds].map(kind => kind.textContent)).toEqual(['120', '46', '9']);
    expect([...kinds].map(kind => kind.getAttribute('aria-label'))).toEqual([120, 46, 9].map((units, kind) => `${String(units)} ${arenaCopy().kinds[kind] ?? ''}`));
    expect([...kinds].map(kind => kind.style.getPropertyValue('--tone'))).toEqual(['var(--color-v2-alloy)', 'var(--color-v2-crystal)', 'var(--color-v2-deut)']);
    // A kind not yet mined keeps its place, dimmed, so the numbers never jump about.
    const empty = hud('muhafiz', { cargo: 30, hold: [0, 30, 0] }).querySelectorAll<HTMLElement>('.ah-hold-kinds > b');
    expect([...empty].map(kind => [kind.textContent, kind.classList.contains('is-empty')])).toEqual([['0', true], ['30', false], ['0', true]]);
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
