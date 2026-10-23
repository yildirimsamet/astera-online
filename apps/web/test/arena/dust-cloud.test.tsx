import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, ARENA_TUNING as T, createSandboxWorld } from '@astera/rules/arena';
import { arenaCopy } from '../../src/arena/copy.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { mapPlan } from '../../src/arena/map.js';
import { fogDensity } from '../../src/arena/render/stage.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * V6f (16-yarik-v6-plani §5): two dust clouds in the outer frontier cut sight past 350 m. The
 * pilot is told while inside (the rule, where it is used), and the map shows where they are.
 */
const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
const cloud = ARENA_LAYOUT.dust[0];
if (!cloud) throw new Error('no dust in the Rift');
const hud = (inside: boolean) => {
  const world = createSandboxWorld({ bots: 0 });
  Object.assign(world.pilot.p, inside ? cloud.p : { x: cloud.p.x, y: cloud.p.y, z: cloud.p.z + cloud.radius + 300 });
  world.pilot.shield = 0;
  const store = createHudStore();
  store.publish(world, 'flight', false, false);
  return render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />);
};

describe('inside a dust cloud', () => {
  it('says so, with the sight distance and that it works both ways', () => {
    const note = hud(true).container.querySelector('.ah-note');
    expect(note?.textContent).toContain(arenaCopy().dust);
    expect(note?.textContent).toContain(String(T.dustSight));
  });

  it('says nothing just outside it', () => {
    expect(hud(false).container.querySelector('.ah-note')?.textContent ?? '').not.toContain(arenaCopy().dust);
  });
});

describe('dust on the map', () => {
  it('plans every cloud and draws and names it on the sheet', () => {
    expect(mapPlan(ARENA_LAYOUT).dust).toHaveLength(ARENA_LAYOUT.dust.length);
    const view = hud(false);
    fireEvent.click(view.getByRole('button', { name: arenaCopy().mapOpen }));
    const map = view.container.querySelector('.ah-map');
    expect(map?.querySelectorAll('[data-dust]')).toHaveLength(ARENA_LAYOUT.dust.length);
    expect(map?.textContent).toContain(arenaCopy().mapDust);
  });
});

describe('scene fog', () => {
  // Fog transmission of FogExp2 at a distance d.
  const seen = (density: number, d: number): number => Math.exp(-((d * density) ** 2));

  it('keeps the v6 clear-space fog: half gone by 3.5 km, nearly all by 6 km', () => {
    expect(seen(fogDensity(0, 0), 3500)).toBeLessThan(0.55);
    expect(seen(fogDensity(0, 0), 6000)).toBeLessThan(0.15);
  });

  it('closes to the dust sight deep in a cloud', () => {
    expect(seen(fogDensity(0, 1), T.dustSight)).toBeLessThan(0.15);
    expect(seen(fogDensity(0, 1), 150)).toBeGreaterThan(0.5);
  });

  it('thickens in a belt as before, and the thicker of the two wins', () => {
    expect(fogDensity(1, 0)).toBeGreaterThan(fogDensity(0, 0));
    expect(fogDensity(1, 1)).toBe(Math.max(fogDensity(1, 0), fogDensity(0, 1)));
  });
});
