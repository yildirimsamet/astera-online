import type { Vec3 } from '../types.js';

/**
 * ONE UNIVERSE PER SERVER: the main galaxy at its centre, and the starter galaxies around it, opened
 * as they fill. A galaxy's place comes from its number alone, so nothing is stored and every client
 * and server agrees on it (owner, 2026-11-05).
 *
 * The first shell stands 10,500 from the centre: 3000 of open space beyond the monument shell (6000),
 * so the main galaxy fills the sky and no sensor reaches it. Past the first shell's places a further
 * one opens outside it. No two galaxies, or their sensors, can touch.
 */
const SHELL = 10_500;
const SHELL_STEP = 6500;
const PLACES = 28;
/** The first galaxy's place: the main galaxy lies about 50 degrees below it. */
const FIRST_PLACE = 3;
/** Coprime with `PLACES`, so that the next galaxy to open stands well away from the last. */
const STRIDE = 11;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function starterGalaxyCentre(ordinal: number): Vec3 {
  const index = ordinal - 1;
  const place = (FIRST_PLACE + index * STRIDE) % PLACES;
  const radius = SHELL + Math.floor(index / PLACES) * SHELL_STEP;
  const y = 1 - ((place + 0.5) * 2) / PLACES;
  const around = Math.sqrt(1 - y * y);
  const turn = (place - FIRST_PLACE) * GOLDEN_ANGLE;
  return { x: radius * around * Math.cos(turn), y: radius * y, z: radius * around * Math.sin(turn) };
}

/** Where the main galaxy's centre stands, in the local coordinates of this starter galaxy. */
export function mainOffsetOf(ordinal: number): Vec3 {
  const { x, y, z } = starterGalaxyCentre(ordinal);
  return { x: 0 - x, y: 0 - y, z: 0 - z };
}
