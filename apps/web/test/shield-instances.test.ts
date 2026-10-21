import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  REMEMBERED_SHIELD,
  SHIELD_FAR_PX,
  SHIELD_FAR_SEGMENTS,
  SHIELD_SEGMENTS,
  SHIELD_TIER,
  shieldInstances,
  shieldLook,
  shieldTier,
} from '../src/galaxy/Satellites.js';
import type { PlanetNode } from '../src/galaxy/scene.js';

/**
 * EVERY DOME IN ONE DRAW. Owner decision, 2026-09-19.
 *
 * A dome was its own mesh, its own material and its own frame callback — a draw
 * call and a JS breath per shielded world, three hundred to seven hundred of them
 * in a full thousand-seat galaxy. They are one instanced draw now, and this is the
 * table that draw is filled from: the SAME looks `shieldLook` has always given,
 * placed where the old groups stood.
 */

const node = (over: Partial<PlanetNode> & { id: string }): PlanetNode => ({
  position: [1, 2, 3],
  radius: 0.5,
  shielded: true,
  intel: 'RESOLVED',
  ...over,
} as PlanetNode);

const colourOf = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

describe('the dome table', () => {
  it('holds only the shielded worlds the player may see', () => {
    const table = shieldInstances([
      node({ id: 'a' }),
      node({ id: 'b', shielded: false }),
      node({ id: 'c', intel: 'UNKNOWN' }),
      node({ id: 'd', intel: 'REMEMBERED' }),
    ], 0, undefined);
    expect(table.map((row) => row.id)).toEqual(['a', 'd']);
  });

  it('gives a stranger’s dome the uniform look, sized and placed as before', () => {
    const [row] = shieldInstances([node({ id: 'a', position: [4, 5, 6], radius: 0.8 })], 9, 'me');
    const look = shieldLook(0, false, false);
    expect(row).toEqual({
      id: 'a',
      position: [4, 5, 6],
      radius: 0.8 * look.scale,
      colour: colourOf(look.colour),
      opacity: look.opacity,
      breathes: true,
      phase: 4,
    });
  });

  it('grades only your own dome, by your own level', () => {
    const [own] = shieldInstances([node({ id: 'me' })], 5, 'me');
    expect(own?.colour).toEqual(colourOf(SHIELD_TIER[2].colour));
    expect(own?.opacity).toBe(shieldLook(2, true, false).opacity);
    expect(own?.radius).toBe(0.5 * SHIELD_TIER[2].scale);
  });

  it('keeps a remembered dome charcoal, faint and still', () => {
    const [memory] = shieldInstances([node({ id: 'd', intel: 'REMEMBERED' })], 5, 'd');
    expect(memory?.colour).toEqual(colourOf(REMEMBERED_SHIELD.colour));
    expect(memory?.opacity).toBe(REMEMBERED_SHIELD.opacity);
    expect(memory?.breathes).toBe(false);
  });

  it('is empty for a galaxy with no domes', () => {
    expect(shieldInstances([node({ id: 'a', shielded: false })], 0, undefined)).toEqual([]);
  });
});

/**
 * A DOME IS A FAINT SHELL, AND IT WAS THE HEAVIEST THING ON THE DISC. The owner's
 * first phone recording, 2026-09-19: 165 domes at 48×32 were ~490k of the frame's
 * ~590k triangles. The panels are drawn in the fragment shader, so the sphere only
 * has to be round at the size a dome is seen.
 */
describe('the dome sphere', () => {
  it('costs under eight hundred triangles a dome', () => {
    const sphere = new THREE.SphereGeometry(1, SHIELD_SEGMENTS[0], SHIELD_SEGMENTS[1]);
    const triangles = (sphere.index?.count ?? 0) / 3;
    expect(triangles).toBeLessThan(800);
    // Still round: never fewer than twenty-four segments around.
    expect(SHIELD_SEGMENTS[0]).toBeGreaterThanOrEqual(24);
    sphere.dispose();
  });
});


/*
  OWNER, 2026-10-20: the evening recording's heaviest single draw was the Aegis domes — 126 domes
  at 720 triangles each, most of them a few pixels across on a zoomed-out disc. A dome that small
  is drawn from a sphere a quarter of the size; its facets are under half a pixel.
*/
describe('a far dome is a lighter sphere', () => {
  const triangles = ([width, height]: readonly [number, number]) =>
    new THREE.SphereGeometry(1, width, height).index!.count / 3;

  it('carries about a quarter of the near dome\'s triangles', () => {
    expect(triangles(SHIELD_FAR_SEGMENTS)).toBeLessThan(triangles(SHIELD_SEGMENTS) / 4);
  });

  it('keeps its outline within half a pixel at the size it is used up to', () => {
    const sag = SHIELD_FAR_PX * (1 - Math.cos(Math.PI / SHIELD_FAR_SEGMENTS[0]));
    expect(sag).toBeLessThan(0.5);
  });

  it('switches by size on screen, not by distance alone', () => {
    expect(shieldTier(SHIELD_FAR_PX - 0.1)).toBe('far');
    expect(shieldTier(SHIELD_FAR_PX)).toBe('near');
    expect(shieldTier(80)).toBe('near');
  });
});
