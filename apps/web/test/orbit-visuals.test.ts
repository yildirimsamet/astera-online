import { describe, expect, it } from 'vitest';
import { SATELLITE_IDS } from '@astera/rules';
import { SATELLITE_NEON } from '../src/ui/assets.js';
import {
  SATELLITE_RIM_EXPANSION,
  REMEMBERED_HARDWARE,
  REMEMBERED_SHIELD,
  SHIELD_TIER,
  bodySizeFor,
  satelliteLook,
  shieldLook,
  shieldTierOf,
} from '../src/galaxy/Satellites.js';
import { STANCE_COLOUR } from '../src/galaxy/scene.js';

/**
 * WHAT SITS AROUND A WORLD, AND WHAT IT IS ALLOWED TO SAY.
 *
 * Everything here is public under D15 — hardware is a physical object anyone can
 * see — so the rules are about LEGIBILITY rather than about fog: a marker has to
 * name a kind of thing at a glance, and must never accidentally borrow a colour
 * that means something else.
 */

/** Parse '#rrggbb' into channels, so a palette can be reasoned about. */
const rgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`${hex} is not a six-digit hex colour`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
};

describe('the satellite marker lights', () => {
  /**
   * A LIGHT FOR EVERY SATELLITE, exhaustively. A new satellite without one is a
   * dark speck in orbit that the player finds only by watching it move.
   */
  it('gives every satellite a colour', () => {
    for (const id of SATELLITE_IDS) {
      expect(SATELLITE_NEON[id], `${id} has no marker light`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(Object.keys(SATELLITE_NEON)).toHaveLength(SATELLITE_IDS.length);
  });

  /** Four satellites, four colours. A shared hue names two things as one. */
  it('gives each of them a different one', () => {
    const used = Object.values(SATELLITE_NEON).map((c) => c.toLowerCase());
    expect(new Set(used).size).toBe(used.length);
  });

  /**
   * FAR ENOUGH APART TO TELL AT A GLANCE.
   *
   * Four distinct strings is not four distinct colours: two hues a few points
   * apart are one colour at the thirty pixels a satellite actually occupies. This
   * asks for real separation in channel space rather than mere inequality.
   */
  it('keeps them far enough apart to be told apart', () => {
    const all = Object.entries(SATELLITE_NEON);
    for (const [aId, a] of all) {
      for (const [bId, b] of all) {
        if (aId >= bId) continue;
        const [ar, ag, ab] = rgb(a);
        const [br, bg, bb] = rgb(b);
        const apart = Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
        expect(apart, `${aId} and ${bId} are nearly the same colour`).toBeGreaterThan(120);
      }
    }
  });

  /**
   * A MARKER MUST NOT BORROW A COLOUR THAT MEANS A STATE.
   *
   * `STANCE_COLOUR` says how well you can see a world — the fog layer's own
   * palette. A satellite light that landed on one of those would read as a
   * reading about the planet rather than as a piece of hardware on it.
   */
  it('never reuses a colour that already means something', () => {
    const taken = new Set(Object.values(STANCE_COLOUR).map((c) => c.toLowerCase()));
    for (const [id, colour] of Object.entries(SATELLITE_NEON)) {
      expect(taken.has(colour.toLowerCase()), `${id} reuses a stance colour`).toBe(false);
    }
  });
});

describe('the satellite silhouette rim', () => {
  const RADII = [0.44, 0.82, 1.4];

  it('uses a narrow geometry expansion instead of a circular marker', () => {
    expect(SATELLITE_RIM_EXPANSION).toBeGreaterThan(0);
    expect(SATELLITE_RIM_EXPANSION).toBeLessThan(0.1);
  });

  it('inherits planet scale through the instanced body', () => {
    const sizes = RADII.map(bodySizeFor);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]!);
    }
    expect(bodySizeFor(2)).toBeCloseTo(bodySizeFor(1) * 2, 6);
  });

  it('still draws a unit-radius world’s body at diameter 0.6', () => {
    expect(bodySizeFor(1)).toBeCloseTo(0.6, 6);
  });

  it('turns every remembered satellite into the same dim, motionless record', () => {
    const looks = SATELLITE_IDS.map((id) => satelliteLook(id, true));
    expect(new Set(looks.map((look) => look.colour))).toEqual(
      new Set([REMEMBERED_HARDWARE.colour]),
    );
    for (const look of looks) {
      expect(look.turning).toBe(false);
      expect(look.rimOpacity).toBeLessThan(satelliteLook('UPLINK', false).rimOpacity);
    }
  });

  it('keeps live satellite colours and motion unchanged', () => {
    for (const id of SATELLITE_IDS) {
      expect(satelliteLook(id, false)).toMatchObject({
        colour: SATELLITE_NEON[id],
        turning: true,
      });
    }
  });
});

/**
 * THE AEGIS DOME.
 *
 * Rebuilt at owner request: the old shell was a plain sphere running cyan through
 * teal to mint, which read as tinted glass and hid the world inside it. What
 * replaced it is a hexagonal panel grid in a cold blue family, smaller and much
 * fainter. These assertions pin the parts of that which are not a matter of taste.
 */
describe('the shield', () => {
  it('grades at the levels the design says, and nowhere else', () => {
    expect(shieldTierOf(0)).toBe(0);
    expect(shieldTierOf(2)).toBe(0);
    expect(shieldTierOf(3)).toBe(1);
    expect(shieldTierOf(4)).toBe(1);
    expect(shieldTierOf(5)).toBe(2);
    expect(shieldTierOf(40)).toBe(2);
  });

  /** Negative is not a real level, but it must not index off the front of the table. */
  it('survives a level below zero', () => {
    expect(shieldTierOf(-3)).toBe(0);
    expect(SHIELD_TIER[shieldTierOf(-3)]).toBeDefined();
  });

  it('has exactly one style per tier', () => {
    expect(SHIELD_TIER).toHaveLength(3);
    for (const tier of [0, 1, 2] as const) expect(SHIELD_TIER[tier]).toBeDefined();
  });

  /**
   * IT MUST ENCLOSE THE WORLD, AND MUST NOT SWALLOW IT.
   *
   * Below 1 the dome would sit inside the planet and be invisible; far above it
   * and a shielded world becomes a bubble that overlaps its own wreck ring and its
   * neighbours' markers. The upper bound is what the owner's "make it smaller"
   * actually pins down.
   */
  it('sits just outside the planet at every tier', () => {
    for (const style of SHIELD_TIER) {
      expect(style.scale).toBeGreaterThan(1);
      expect(style.scale).toBeLessThanOrEqual(1.35);
    }
  });

  it('grows with level, so raising an Aegis is visible on your own world', () => {
    for (let i = 1; i < SHIELD_TIER.length; i++) {
      expect(SHIELD_TIER[i]!.scale).toBeGreaterThan(SHIELD_TIER[i - 1]!.scale);
      expect(SHIELD_TIER[i]!.opacity).toBeGreaterThan(SHIELD_TIER[i - 1]!.opacity);
    }
  });

  /**
   * STAYS FAINT. The dome is a marker, not a wrapper: the owner has to be able to
   * read their own world through it, and a stranger has to be able to recognise
   * the world they are deciding whether to raid.
   */
  it('never gets opaque enough to hide the planet', () => {
    for (const style of SHIELD_TIER) {
      expect(style.opacity).toBeGreaterThan(0);
      expect(style.opacity).toBeLessThan(0.4);
    }
  });

  /**
   * COLD BLUE, NEVER GREEN — the specific complaint that prompted the rewrite.
   *
   * Green is also the probe neon and the `window` stance, so a green dome said
   * "scout" and "you can see in here" at the same time as "armoured".
   */
  it('is a cold blue at every tier', () => {
    for (const style of SHIELD_TIER) {
      const [r, g, b] = rgb(style.colour);
      expect(b, `${style.colour} is not blue-dominant`).toBeGreaterThan(r);
      expect(b, `${style.colour} is not blue-dominant`).toBeGreaterThan(g);
      // And not a green cast: green must not lead red by much, or it reads teal.
      expect(g - r, `${style.colour} reads green`).toBeLessThan(70);
    }
  });

  /** It gets whiter with level rather than changing hue — a brighter shield, not a different one. */
  it('brightens rather than changing colour as it grades', () => {
    const luma = (hex: string): number => {
      const [r, g, b] = rgb(hex);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (let i = 1; i < SHIELD_TIER.length; i++) {
      expect(luma(SHIELD_TIER[i]!.colour)).toBeGreaterThan(luma(SHIELD_TIER[i - 1]!.colour));
    }
  });

  it('renders a remembered dome as dim charcoal with no breathing animation', () => {
    const memory = shieldLook(2, true, true);
    const [r, g, b] = rgb(memory.colour);

    expect(memory).toMatchObject({ ...REMEMBERED_SHIELD, animated: false });
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
    expect(memory.opacity).toBeLessThan(shieldLook(0, false, false).opacity);
  });

  it('keeps live domes animated and graded', () => {
    expect(shieldLook(0, false, false).animated).toBe(true);
    expect(shieldLook(2, true, false).opacity).toBeGreaterThan(
      shieldLook(0, false, false).opacity,
    );
  });
});
