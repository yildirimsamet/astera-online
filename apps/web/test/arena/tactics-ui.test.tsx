import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ARENA_LAYOUT, ARENA_TUNING as T, TACTICS, createSandboxWorld, type Pilot, type ShipClass, type Tactic } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { FlightControls } from '../../src/arena/Controls.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createControls } from '../../src/arena/input.js';
import { MARK_RANGE, enemyMarked } from '../../src/arena/marks.js';
import { Effects } from '../../src/arena/render/effects.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * Y4d, plan 14 §4: the B slot's last two tactics. İllüzyon sends a mirror copy of the ship;
 * Radar tarama marks every enemy in the arena for a few seconds, and tells them so.
 */
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(previous); });

const flying = (ship: ShipClass, patch: Partial<Pilot> = {}) => {
  const world = createSandboxWorld({ bots: 0, ship });
  Object.assign(world.pilot, patch);
  const store = createHudStore();
  store.publish(world, 'flight', false, false);
  return store;
};

describe('the B slot on the controls', () => {
  it('casts an illusion or a sweep once a press', () => {
    for (const tactic of ['illusion', 'radar'] as const) {
      const controls = createControls();
      controls.actionDown(tactic, 1, 0); controls.actionUp(tactic, 1, 40);
      const intent = controls.sample();
      expect([intent.illusion, intent.radar]).toEqual([tactic === 'illusion', tactic === 'radar']);
      expect([controls.sample().illusion, controls.sample().radar]).toEqual([false, false]);
    }
  });

  it('presses whichever tactic the flight carries on Q or E', () => {
    for (const tactic of TACTICS) for (const key of ['KeyQ', 'KeyE']) {
      const controls = createControls();
      controls.setTactic(tactic);
      controls.keyDown(key); controls.keyUp(key);
      const intent = controls.sample();
      expect([intent.smoke, intent.cloak, intent.illusion, intent.radar], `${tactic} ${key}`).toEqual(TACTICS.map(t => t === tactic));
    }
  });

  it('lets go of a pressed tactic when the controls clear', () => {
    const controls = createControls();
    controls.actionDown('radar', 1, 0); controls.clear();
    expect(controls.sample().radar).toBe(false);
  });
});

const keys = (ship: ShipClass, patch: Partial<Pilot> = {}) =>
  render(<FlightControls controls={createControls()} store={flying(ship, patch)} onLand={() => undefined} onCancel={() => undefined} />).container;

describe('the B key', () => {
  it('shows the tactic chosen, named, with its own icon', () => {
    const c = arenaCopy();
    for (const tactic of ['illusion', 'radar'] as const) {
      const key = keys('akinci', { tactic }).querySelector(`.ac-${tactic}`);
      expect(key?.querySelector('small')?.textContent).toBe(c[tactic]);
      expect(key?.querySelector('.ac-icon svg')).not.toBeNull();
    }
  });

  it('counts its wait down and fills its ring as it comes back', () => {
    for (const [tactic, cooldown] of [['illusion', T.illusionCooldown], ['radar', T.radarCooldown]] as const) {
      const key = keys('akinci', { tactic, tacticCooldown: 8 * T.tickRate }).querySelector<HTMLButtonElement>(`.ac-${tactic}`);
      expect(key?.disabled).toBe(true);
      expect(key?.querySelector('small')?.textContent).toBe('8');
      expect(Number(key?.style.getPropertyValue('--charge'))).toBeCloseTo(8 / cooldown, 6);
    }
  });
});

describe('the HUD store', () => {
  it('publishes the B wait, the copy flying and how long it has left, and the sweep\'s time', () => {
    const cast = (T.illusionCooldown - 2) * T.tickRate;
    const s = flying('akinci', { tactic: 'illusion', tacticCooldown: cast, decoy: 12, scan: 2 * T.tickRate }).getSnapshot();
    expect([s.tacticCooldown, s.decoy, s.illusion, s.scan]).toEqual([T.illusionCooldown - 2, 12, T.illusionDuration - 2, 2]);
    // A copy that broke early leaves no time behind it.
    expect(flying('akinci', { tactic: 'illusion', tacticCooldown: cast, decoy: -1 }).getSnapshot().illusion).toBe(0);
  });
});

const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
const note = (patch: Partial<Pilot>) =>
  render(<ArenaHud store={flying('akinci', { shield: 0, ...patch })} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />).container.querySelector('.ah-note');

describe('the HUD line', () => {
  it('tells a scanned pilot they were seen, and what to do, as a warning', () => {
    const c = arenaCopy();
    const line = note({ threat: 4 });
    expect(line?.querySelector('strong')?.textContent).toBe(c.threats[4]);
    expect(line?.querySelector('span')?.textContent).toBe(c.threatHints[4]);
    expect(line?.classList.contains('tone-warn')).toBe(true);
  });

  it('counts the copy and the sweep down, with what each is doing', () => {
    const c = arenaCopy();
    const copy = note({ tactic: 'illusion', tacticCooldown: (T.illusionCooldown - 1) * T.tickRate, decoy: 12 });
    expect(copy?.querySelector('strong')?.textContent).toBe(`${c.illusion} · ${String(T.illusionDuration - 1)} s`);
    expect(copy?.querySelector('span')?.textContent).toBe(c.illusionHint);
    const sweep = note({ tactic: 'radar', scan: 2 * T.tickRate });
    expect(sweep?.querySelector('strong')?.textContent).toBe(`${c.radar} · 2 s`);
    expect(sweep?.querySelector('span')?.textContent).toBe(c.radarHint);
  });

  it('names every tactic and keeps its line short enough for its card, in both languages', async () => {
    for (const language of ['tr', 'en']) {
      await i18n.changeLanguage(language);
      const c = arenaCopy();
      for (const tactic of TACTICS satisfies readonly Tactic[]) {
        expect(c[tactic].length, `${language} ${tactic}`).toBeGreaterThan(0);
        expect(c.tactics[tactic].length, `${language} ${tactic}`).toBeLessThanOrEqual(64);
      }
      expect(c.threats[4]?.length).toBeGreaterThan(0);
      expect(c.threatHints[4]?.length).toBeGreaterThan(0);
    }
  });
});

describe('a sweep\'s marks', () => {
  it('reach any distance and any landed ship', () => {
    expect(enemyMarked({ landed: 0, mining: false }, MARK_RANGE * 5, true)).toBe(true);
    expect(enemyMarked({ landed: 3, mining: false }, 900, true)).toBe(true);
    expect(enemyMarked({ landed: 0, mining: false }, MARK_RANGE * 5)).toBe(false);
  });
});

describe('a copy breaking', () => {
  it('is its own shatter, never a hit on a ship', () => {
    const scene = new THREE.Scene();
    const effects = new Effects(scene, new Map());
    const world = createSandboxWorld({ bots: 0 });
    const slot = world.impacts[0]; if (!slot) throw new Error('no impact slot');
    Object.assign(slot, { active: true, age: 0, kind: 'hologram' }); Object.assign(slot.p, { x: 4, y: 5, z: 6 });
    const hits: string[] = []; let booms = 0;
    effects.watchImpacts(world, 0, () => { booms++; }, kind => { hits.push(kind); });
    expect([hits, booms]).toEqual([[], 0]);
  });
});
