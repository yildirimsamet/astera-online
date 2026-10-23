import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, ARENA_TUNING as T, createSandboxWorld, type Pilot } from '@astera/rules/arena';
import { FlightControls } from '../../src/arena/Controls.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * Owner 2026-10-21: hull, shield, fuel and ammunition are four separate things. The magazine
 * is read where it is spent, on the FIRE key; the shield layer is its own line and number on
 * the hull gauge, shown only while the ship has one.
 */
const flying = (patch: Partial<Pilot>) => {
  const world = createSandboxWorld({ bots: 0 });
  Object.assign(world.pilot, patch);
  const store = createHudStore();
  store.publish(world, 'flight', false, false);
  return store;
};
const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
const fireKey = (patch: Partial<Pilot>) => {
  const view = render(<FlightControls controls={createControls()} store={flying(patch)} onLand={() => undefined} onCancel={() => undefined} />);
  const key = view.container.querySelector<HTMLButtonElement>('.ac-fire');
  if (!key) throw new Error('no fire key');
  return key;
};
const hullGauge = (patch: Partial<Pilot>) => {
  const view = render(<ArenaHud store={flying(patch)} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />);
  const gauge = view.container.querySelector<HTMLElement>('.ah-hull');
  if (!gauge) throw new Error('no hull gauge');
  return gauge;
};

describe('magazine on the FIRE key', () => {
  it('shows the rounds left and a full ring for a full magazine', () => {
    const key = fireKey({});
    expect(key.querySelector('small')?.textContent).toContain(String(T.ammoCapacity));
    expect(key.style.getPropertyValue('--charge')).toBe('0');
    expect(key.disabled).toBe(false);
  });

  it('empties the ring as the rounds go', () => {
    const key = fireKey({ ammo: T.ammoCapacity / 4 });
    expect(key.querySelector('small')?.textContent).toContain(String(T.ammoCapacity / 4));
    expect(key.style.getPropertyValue('--charge')).toBe('0.75');
  });

  it('says empty and cannot be pressed once the magazine is spent', () => {
    const key = fireKey({ ammo: 0 });
    expect(key.disabled).toBe(true);
    expect(key.querySelector('small')?.textContent).toBe(arenaCopy().empty);
  });
});

describe('hull and shield layer', () => {
  it('shows the hull alone while the ship has no shield', () => {
    const gauge = hullGauge({ hull: T.hull / 2 });
    expect(gauge.querySelector('strong')?.textContent).toBe('50%');
    expect(gauge.querySelector('[data-shield]')).toBeNull();
  });

  it('shows the shield layer as its own line and number', () => {
    const gauge = hullGauge({ shieldMax: 50, shieldHp: 20 });
    expect(gauge.querySelector('[data-shield]')?.textContent).toContain('20');
    expect(gauge.style.getPropertyValue('--shield')).toBe('0.4');
    expect(gauge.textContent).toContain('100%');
  });
});
