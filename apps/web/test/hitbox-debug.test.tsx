import { readFileSync } from 'node:fs';
import { render, renderHook, act, screen } from '@testing-library/react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTACT_HITBOX_KIND,
  HITBOX_COLOURS,
  HITBOX_KINDS,
  HITBOX_OPACITY,
  HitboxLegend,
  hitboxDebug,
  hitboxMaterialProps,
  initialHitboxDebug,
  setHitboxDebug,
  useHitboxDebug,
} from '../src/galaxy/hitboxDebug.js';

/**
 * THE HIT TARGETS, MADE VISIBLE.
 *
 * Every tappable thing on the disc is an invisible volume — a box round a
 * squadron, a sphere round a rock, a torus round a wreck — and nothing in a
 * screenshot, a type check or a unit test says how much of the screen those
 * volumes actually cover, or which one is sitting on top of another. This is the
 * switch that paints them, and the reason it needs tests of its own is that it is
 * wired into the pick meshes themselves: an error here does not look wrong, it
 * makes the galaxy untappable.
 */

const source = (path: string): string => readFileSync(path, 'utf8');

/** Every file that owns a pick volume, and the kind it must paint it with. */
const HIT_SITES: readonly (readonly [string, string])[] = [
  ['src/galaxy/PlanetField.tsx', 'planet'],
  ['src/galaxy/Asteroids.tsx', 'asteroid'],
  ['src/galaxy/MiningFlights.tsx', 'miner'],
  ['src/galaxy/TradeShip.tsx', 'trade'],
  ['src/galaxy/IntergalacticConvoy.tsx', 'convoy'],
  ['src/galaxy/Wrecks.tsx', 'wreck'],
  ['src/galaxy/Fleets.tsx', 'pirate'],
];

beforeEach(() => {
  setHitboxDebug(false);
});

describe('the hit-box colour key', () => {
  it('covers every kind of tappable thing on the disc', () => {
    expect([...HITBOX_KINDS].sort()).toEqual(
      [
        'asteroid',
        'contact',
        'convoy',
        'deathStar',
        'fleet',
        'miner',
        'pirate',
        'planet',
        'probe',
        'trade',
        'wreck',
      ].sort(),
    );
  });

  it('gives each kind its own colour, because two the same is one unreadable overlap', () => {
    const colours = HITBOX_KINDS.map((kind) => HITBOX_COLOURS[kind]);
    expect(new Set(colours).size).toBe(HITBOX_KINDS.length);
    for (const colour of colours) expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('stays translucent: a solid fill would hide the thing it is measuring', () => {
    expect(HITBOX_OPACITY).toBeGreaterThan(0.1);
    expect(HITBOX_OPACITY).toBeLessThan(0.5);
  });

  it('names a hit-box kind for every contact the radar can return', () => {
    expect(CONTACT_HITBOX_KIND).toEqual({
      unknown: 'contact',
      fleet: 'contact',
      probe: 'probe',
      mining: 'miner',
      harvest: 'miner',
      death_star: 'deathStar',
      pirate: 'pirate',
    });
  });
});

describe('the material a pick volume wears', () => {
  it('is completely invisible while the switch is off', () => {
    const props = hitboxMaterialProps('fleet', false);
    expect(props.opacity).toBe(0);
    expect(props.colorWrite).toBe(false);
    // The pick behaviour must not change with the switch: a ray from inside the
    // volume misses it in the real game, so it has to miss it here too.
    expect(props.side).toBe(THREE.FrontSide);
  });

  it('paints the kind colour, both faces, while the switch is on', () => {
    const props = hitboxMaterialProps('pirate', true);
    expect(props.opacity).toBe(HITBOX_OPACITY);
    expect(props.colorWrite).toBe(true);
    expect(props.color).toBe(HITBOX_COLOURS.pirate);
    expect(props.side).toBe(THREE.DoubleSide);
  });

  it('never writes depth, so a volume cannot hide the galaxy behind it', () => {
    for (const debug of [false, true]) {
      expect(hitboxMaterialProps('planet', debug).depthWrite).toBe(false);
      expect(hitboxMaterialProps('planet', debug).transparent).toBe(true);
    }
  });
});

describe('the switch', () => {
  it('is off unless something asks for it', () => {
    expect(initialHitboxDebug('', null)).toBe(false);
    expect(initialHitboxDebug('?zoom=3', null)).toBe(false);
  });

  it('reads the query string, in the spellings a person actually types', () => {
    expect(initialHitboxDebug('?hitboxes=1', null)).toBe(true);
    expect(initialHitboxDebug('?hitboxes=true', null)).toBe(true);
    expect(initialHitboxDebug('?hitboxes', null)).toBe(true);
    expect(initialHitboxDebug('?hitboxes=0', '1')).toBe(false);
    expect(initialHitboxDebug('?hitboxes=off', '1')).toBe(false);
  });

  it('remembers the last answer when the query string is silent', () => {
    expect(initialHitboxDebug('', '1')).toBe(true);
    expect(initialHitboxDebug('', '0')).toBe(false);
  });

  it('notifies every subscriber, so the whole disc repaints at once', () => {
    const { result } = renderHook(() => useHitboxDebug());
    expect(result.current).toBe(false);
    act(() => { setHitboxDebug(true); });
    expect(result.current).toBe(true);
    expect(hitboxDebug()).toBe(true);
    act(() => { setHitboxDebug(false); });
    expect(result.current).toBe(false);
  });

  it('survives a storage that throws, which is Safari in private browsing', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => { throw new Error('denied'); },
    });
    try {
      expect(() => { setHitboxDebug(true); }).not.toThrow();
      expect(hitboxDebug()).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('the legend', () => {
  it('draws nothing at all while the switch is off', () => {
    const { container } = render(<HitboxLegend />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names every colour once the volumes are on screen', () => {
    act(() => { setHitboxDebug(true); });
    render(<HitboxLegend />);
    const rows = screen.getAllByTestId('hitbox-legend-row');
    expect(rows).toHaveLength(HITBOX_KINDS.length);
    for (const kind of HITBOX_KINDS) {
      expect(screen.getByText(kind)).toBeTruthy();
    }
  });
});

describe('every pick volume in the galaxy', () => {
  it.each(HIT_SITES)('%s paints its volume as %s', (file, kind) => {
    const text = source(file);
    expect(text).toContain('HitboxMaterial');
    expect(text).toContain(`kind="${kind}"`);
  });

  it('leaves no hand-written invisible material behind', () => {
    for (const [file] of HIT_SITES) {
      expect(source(file)).not.toContain('<meshBasicMaterial transparent opacity={0}');
    }
  });

  /**
   * A world's pick target IS its billboard, with the planet's own art on it, so
   * this is the one volume that cannot simply change material. It gets a second
   * instanced quad on the same matrices — which must never be raycast, or every
   * world on the disc would have two hit targets stacked on it.
   */
  it('gives a world a separate painted quad that is not itself tappable', () => {
    const text = source('src/galaxy/PlanetField.tsx');
    expect(text).toContain('name="planet-hitboxes"');
    expect(text).toMatch(/name="planet-hitboxes"[\s\S]*?raycast=\{\(\) => null\}/);
  });

  it('tells a squadron, a probe and a strategic weapon apart', () => {
    const text = source('src/galaxy/Fleets.tsx');
    // Your own craft: one box, three meanings, chosen from the flags already here.
    expect(text).toMatch(/<HitboxMaterial[\s\S]{0,160}'deathStar'[\s\S]{0,160}'probe'/);
    // Somebody else's craft: the radar's own vocabulary, mapped once.
    expect(text).toContain('CONTACT_HITBOX_KIND[contact.kind]');
  });
});
