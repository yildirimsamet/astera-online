import { describe, expect, it } from 'vitest';
import { GALAXY, STARTER, mainOffsetOf, starterGalaxyCentre } from '../src/index.js';

/** The monuments circle the main centre this far out: past `GALAXY.radius`, and the real edge of the place. */
const MONUMENT_SHELL = 6000;

const { x, y, z } = mainOffsetOf(1);
const centres = Math.hypot(x, y, z);
const widestSensor = Math.max(...STARTER.telescope, ...STARTER.radar);
const degrees = (radians: number) => (radians * 180) / Math.PI;
/** The angle a sphere of `GALAXY.radius` fills, seen from `distance` away. */
const span = (distance: number) => degrees(2 * Math.asin(GALAXY.radius / distance));

describe('the starter galaxy beside the main one', () => {
  it('stands 10,500 units from the main centre: right beside it, not across the sky', () => {
    expect(centres).toBeGreaterThan(10_490);
    expect(centres).toBeLessThan(10_510);
  });

  it('never overlaps the main galaxy, and 3000 units of open space lie beyond its monuments', () => {
    expect(centres - MONUMENT_SHELL - STARTER.radius).toBeGreaterThanOrEqual(2990);
  });

  it('keeps every sensor out of the main galaxy, even from its own rim', () => {
    expect(STARTER.radius + widestSensor).toBeLessThan(centres - MONUMENT_SHELL);
  });

  it('shows the main galaxy as an ellipse below, not as a line on the horizon', () => {
    const elevation = degrees(Math.atan2(-y, Math.hypot(x, z)));
    expect(elevation).toBeGreaterThan(40);
    expect(elevation).toBeLessThan(60);
  });

  it('fills the sky, from anywhere a ship can stand', () => {
    expect(span(centres + STARTER.radius)).toBeGreaterThan(40);
    expect(span(centres - STARTER.radius)).toBeGreaterThan(50);
  });

  it('gives each sensor rung more reach, starting from nothing', () => {
    for (const ladder of [STARTER.telescope, STARTER.radar]) {
      expect(ladder[0]).toBe(0);
      for (let rung = 1; rung < ladder.length; rung++) expect(ladder[rung]!).toBeGreaterThan(ladder[rung - 1]!);
    }
  });

  it('hides every neighbour from the naked eye', () => {
    expect(STARTER.nakedEye).toBeLessThan(STARTER.minSeparation);
  });
});

describe('the galaxies around the main one', () => {
  const centres60 = Array.from({ length: 60 }, (_, index) => starterGalaxyCentre(index + 1));
  const between = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  it('sees the main galaxy from where it stands: the offset is the way back to the centre', () => {
    for (const ordinal of [1, 2, 17, 31]) {
      const centre = starterGalaxyCentre(ordinal), offset = mainOffsetOf(ordinal);
      expect(offset.x + centre.x).toBe(0);
      expect(offset.y + centre.y).toBe(0);
      expect(offset.z + centre.z).toBe(0);
    }
  });

  it('gives a galaxy the same place every time, since only its number is stored', () => {
    expect(starterGalaxyCentre(7)).toEqual(starterGalaxyCentre(7));
  });

  it('never lets two galaxies, or their sensors, reach each other', () => {
    const reach = 2 * (STARTER.radius + widestSensor);
    for (let a = 0; a < centres60.length; a++) {
      for (let b = a + 1; b < centres60.length; b++) expect(between(centres60[a]!, centres60[b]!), `${String(a)}-${String(b)}`).toBeGreaterThanOrEqual(reach);
    }
  });

  it('keeps every one of them, and its sensors, out of the main galaxy', () => {
    for (const centre of centres60) expect(Math.hypot(centre.x, centre.y, centre.z) - STARTER.radius - widestSensor).toBeGreaterThan(MONUMENT_SHELL);
  });

  it('spreads new galaxies around rather than in a line', () => {
    expect(between(starterGalaxyCentre(1), starterGalaxyCentre(2))).toBeGreaterThan(10_000);
  });

  it('has a place for any number of them', () => {
    expect(Number.isFinite(starterGalaxyCentre(500).x)).toBe(true);
  });
});
