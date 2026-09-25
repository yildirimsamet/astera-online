import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODEL_PICK_SCALE, PLANET_LOD, groupPlanetsByLod, lodFor, screenRadius, type PlanetLod } from '../src/galaxy/planetLod.js';
import { planetArt, planetModel } from '../src/ui/assets.js';

/**
 * THE WORLDS IN 3D, AT THE COST THE DISC CAN PAY (F9 · K7).
 *
 * Every world is drawn from what it occupies on screen: a speck is the PNG billboard it
 * always was (a thousand of them cost a quad each and a sphere a few pixels across is
 * a circle whatever it is made of); a world a few dozen pixels across is the light
 * model, lit by the scene and turning; a world the camera is close to is the full
 * model. A world near a boundary does not flicker across it while the camera settles.
 */

describe('how big a world stands on screen', () => {
  it('is its radius over the distance, in half-viewport pixels', () => {
    const px = screenRadius(1, 10, 45, 800);
    expect(px).toBeCloseTo(400 / (10 * Math.tan((22.5 * Math.PI) / 180)));
  });

  it('never divides by nothing', () => {
    expect(Number.isFinite(screenRadius(1, 0, 45, 800))).toBe(true);
  });
});

describe('which model a world is drawn with', () => {
  it('draws a speck as a billboard, a planet as the light model, a close one as the full model', () => {
    expect(lodFor(PLANET_LOD.lite * 0.5)).toBe('dot');
    expect(lodFor(PLANET_LOD.lite * 2)).toBe('lite');
    expect(lodFor(PLANET_LOD.full * 2)).toBe('full');
  });

  /** A world sitting on a threshold keeps what it is until it clearly crosses it. */
  it('holds a world near a threshold where it already is', () => {
    const edge = PLANET_LOD.lite;
    expect(lodFor(edge * 1.02, 'dot')).toBe('dot');
    expect(lodFor(edge * 1.2, 'dot')).toBe('lite');
    expect(lodFor(edge * 0.98, 'lite')).toBe('lite');
    expect(lodFor(edge * 0.8, 'lite')).toBe('dot');
    const near = PLANET_LOD.full;
    expect(lodFor(near * 1.02, 'lite')).toBe('lite');
    expect(lodFor(near * 0.98, 'full')).toBe('full');
    expect(lodFor(near * 0.8, 'full')).toBe('lite');
  });
});

describe('the draws the field makes', () => {
  const node = (id: string) => ({ id });

  it('groups each tier by look, so every tier is one draw per look', () => {
    const lods = new Map<string, PlanetLod>([['a', 'dot'], ['b', 'lite'], ['c', 'lite'], ['d', 'full']]);
    const groups = groupPlanetsByLod([node('a'), node('b'), node('c'), node('d')], (id) => lods.get(id) ?? 'dot');
    expect(groups.dots.flatMap((group) => group.nodes.map((n) => n.id))).toEqual(['a']);
    expect(groups.dots[0]?.texture).toBe(planetArt('a'));
    expect(groups.lite.flatMap((group) => group.nodes.map((n) => n.id)).sort()).toEqual(['b', 'c']);
    for (const group of groups.lite) expect(group.url).toBe(planetModel(group.nodes[0]!.id, 'lite'));
    expect(groups.full.map((group) => group.url)).toEqual([planetModel('d', 'full')]);
  });
});

/** The card and the disc show the same world: the model is the render's own look. */
describe('a world’s model', () => {
  it('is the same look as its render, light or full', () => {
    for (const id of ['p1', 'p2', 'kestrel', 'a-long-planet-id-0042']) {
      const look = /planet_(\d+)\.png$/.exec(planetArt(id))?.[1];
      expect(planetModel(id, 'full')).toBe(`/assets/models/planets/defaults/planet_${look ?? ''}.glb`);
      expect(planetModel(id, 'lite')).toBe(`/assets/models/planets/defaults/planet_${look ?? ''}-lod.glb`);
    }
  });
});

/**
 * THE FIELD'S WIRING (F9): the default worlds go through the tiers — billboards for
 * specks, the light or full model otherwise — and a model that fails or is still on its
 * way leaves the world on its render, never blank.
 */
describe('the field draws the default worlds by tier', () => {
  const field = readFileSync('src/galaxy/PlanetField.tsx', 'utf8');

  it('groups the default worlds by the tier the camera puts them in', () => {
    expect(field).toMatch(/groupPlanetsByLod\(defaults,/);
    expect(field).toMatch(/lodFor\(screenRadius\(/);
  });

  it('draws the light and full tiers as models, falling back to the render', () => {
    const models = field.slice(field.indexOf('<DefaultPlanetModel') - 900, field.indexOf('<DefaultPlanetModel') + 400);
    expect(models).toMatch(/<SkinAssetBoundary/);
    expect(models).toMatch(/<Suspense fallback=/);
    expect(models).toMatch(/lite=\{group\.lite\}/);
  });
});

/**
 * THE SAME TAP OPENS A WORLD IN 3D AS IT DID AS A CARD (owner: "hitboxlara da bakmayı
 * unutma"). A billboard is picked by its whole square, twice the radius on a side; a
 * model by a sphere. The sphere is sized to the square's area, so going 3D neither
 * shrinks the target under a thumb nor grows it over its neighbours.
 */
describe('a modelled world’s pick volume', () => {
  it('covers the same area on screen as the billboard it replaces', () => {
    const radius = 3;
    expect(Math.PI * (MODEL_PICK_SCALE * radius) ** 2).toBeCloseTo((2 * radius) ** 2);
  });

  it('is scaled by that factor, apart from the body it is drawn on', () => {
    const model = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(model).toMatch(/node\.radius \* MODEL_PICK_SCALE/);
    expect(model).toMatch(/<HitboxMaterial kind="planet" \/>/);
  });
});
