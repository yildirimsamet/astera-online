import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODEL_PICK_SCALE, PLANET_LOD, groupPlanetsByLod, lodFor, screenRadius, type PlanetLod } from '../src/galaxy/planetLod.js';
import { planetArt, planetLook, planetModel } from '../src/ui/assets.js';

/**
 * THE WORLDS IN 3D, AT THE COST THE DISC CAN PAY (F9 · K7).
 *
 * Every world is a model, chosen from what it occupies on screen (owner, 2026-09-25:
 * "çok küçükse yine de eski PNG billboard kullanmayalım"): a speck is the far model, a
 * few hundred triangles; a world a few dozen pixels across is the light model; a world
 * the camera is close to is the full one, cut to four thousand ("5k yerine 4k"). A
 * world near a boundary does not flicker across it while the camera settles.
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

/**
 * WHERE THE TIERS FALL, IN THE OWNER'S TERMS: the camera's distance over the world's
 * radius, on a phone held upright (812 px tall, 45° lens). "~14 çok yakın kalıyor. ~34
 * falan yapalım" — the full model from 34 radii in, the far one past ~163.
 */
describe('the tiers on a phone', () => {
  const ratioAt = (px: number) => (812 / 2) / (Math.tan((22.5 * Math.PI) / 180) * px);

  it('draws the full model from about 34 radii in', () => {
    expect(ratioAt(PLANET_LOD.full)).toBeGreaterThan(32);
    expect(ratioAt(PLANET_LOD.full)).toBeLessThan(36);
  });

  it('draws the far model past about 163 radii', () => {
    expect(Math.round(ratioAt(PLANET_LOD.lite))).toBe(163);
  });
});

describe('which model a world is drawn with', () => {
  it('draws a speck as the far model, a planet as the light one, a close one as the full one', () => {
    expect(lodFor(PLANET_LOD.lite * 0.5)).toBe('far');
    expect(lodFor(PLANET_LOD.lite * 2)).toBe('lite');
    expect(lodFor(PLANET_LOD.full * 2)).toBe('full');
  });

  /** A world sitting on a threshold keeps what it is until it clearly crosses it. */
  it('holds a world near a threshold where it already is', () => {
    const edge = PLANET_LOD.lite;
    expect(lodFor(edge * 1.02, 'far')).toBe('far');
    expect(lodFor(edge * 1.2, 'far')).toBe('lite');
    expect(lodFor(edge * 0.98, 'lite')).toBe('lite');
    expect(lodFor(edge * 0.8, 'lite')).toBe('far');
    const near = PLANET_LOD.full;
    expect(lodFor(near * 1.02, 'lite')).toBe('lite');
    expect(lodFor(near * 0.98, 'full')).toBe('full');
    expect(lodFor(near * 0.8, 'full')).toBe('lite');
  });
});

describe('the draws the field makes', () => {
  const node = (id: string) => ({ id });

  it('groups each tier by look, so every tier is one draw per look — models all the way down', () => {
    const lods = new Map<string, PlanetLod>([['a', 'far'], ['b', 'lite'], ['c', 'lite'], ['d', 'full']]);
    const groups = groupPlanetsByLod([node('a'), node('b'), node('c'), node('d')], (id) => lods.get(id) ?? 'far');
    const far = groups.filter((group) => group.lod === 'far');
    expect(far.flatMap((group) => group.nodes.map((n) => n.id))).toEqual(['a']);
    expect(groups.filter((group) => group.lod === 'lite').flatMap((group) => group.nodes.map((n) => n.id)).sort()).toEqual(['b', 'c']);
    expect(groups.filter((group) => group.lod === 'full').flatMap((group) => group.nodes.map((n) => n.id))).toEqual(['d']);
    for (const group of groups) {
      expect(group.url).toBe(planetModel(group.nodes[0]!.id, group.lod));
      for (const member of group.nodes) expect(planetLook(member.id)).toBe(planetLook(group.nodes[0]!.id));
    }
  });
});

/** The card and the disc show the same world: the models are the card's own look. */
describe('a world’s model', () => {
  it('is the same look as its card, at every tier', () => {
    for (const id of ['p1', 'p2', 'kestrel', 'a-long-planet-id-0042']) {
      const look = /planet_(\d+)\.png\?v=/.exec(planetArt(id))?.[1];
      expect(look).toBe(String(planetLook(id)));
      expect(planetModel(id, 'full')).toMatch(new RegExp(`/planet_${look ?? ''}\\.glb\\?v=`));
      expect(planetModel(id, 'lite')).toMatch(new RegExp(`/planet_${look ?? ''}-lod\\.glb\\?v=`));
      expect(planetModel(id, 'far')).toMatch(new RegExp(`/planet_${look ?? ''}-far\\.glb\\?v=`));
    }
  });
});

/**
 * THE FIELD'S WIRING (F9): every default world goes through the tiers as a model, and a
 * model that fails or is still on its way leaves the world on its card — rendered from
 * the same model — never blank.
 */
describe('the field draws the default worlds by tier', () => {
  const field = readFileSync('src/galaxy/PlanetField.tsx', 'utf8');

  it('groups the default worlds by the tier the camera puts them in', () => {
    expect(field).toMatch(/groupPlanetsByLod\(defaults,/);
    expect(field).toMatch(/lodFor\(screenRadius\(/);
  });

  it('draws every tier as a model, the card only while the model is not there', () => {
    const models = field.slice(field.indexOf('<DefaultPlanetModel') - 900, field.indexOf('<DefaultPlanetModel') + 400);
    expect(models).toMatch(/<SkinAssetBoundary/);
    expect(models).toMatch(/<Suspense fallback=/);
    expect(models).toMatch(/lod=\{group\.lod\}/);
    expect(field).not.toMatch(/tiers\.dots/);
  });
});

/**
 * THE SAME TAP OPENS A WORLD IN 3D AS IT DID AS A CARD (owner: "hitboxlara da bakmayı
 * unutma"). A billboard was picked by its whole square, twice the radius on a side; a
 * model by a sphere. The sphere is sized to the square's area, so going 3D neither
 * shrinks the target under a thumb nor grows it over its neighbours.
 */
describe('a modelled world’s pick volume', () => {
  it('covers the same area on screen as the billboard it replaces', () => {
    const radius = 3;
    expect(Math.PI * (MODEL_PICK_SCALE * radius) ** 2).toBeCloseTo((2 * radius) ** 2);
  });

  it('is placed once per change of members, never in the frame loop (`planetPick.ts`)', () => {
    const model = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(model).toMatch(/placePickSpheres\(hits\.current, nodes\)/);
    expect(model).not.toMatch(/hits\.current\?\.setMatrixAt/);
    expect(model).toMatch(/<HitboxMaterial kind="planet" \/>/);
  });
});

/**
 * A WORLD NEVER VANISHES WHILE ITS NEXT MODEL LOADS (owner, on a phone: "gezegenler
 * aslında yok ama çiziliyor mu"). The disc's scene sits under ONE Suspense boundary; a
 * tier change mounted a model that was not loaded yet, its stand-in card suspended on its
 * own texture, and the suspension climbed to that boundary — which hid every world, pin
 * and fleet at once, while R3F kept the hidden worlds tappable. Three guards:
 */
describe('a tier change never empties the disc', () => {
  const field = readFileSync('src/galaxy/PlanetField.tsx', 'utf8');

  it('changes tier as a transition, so the old models stay up until the new ones are ready', () => {
    expect(field).toMatch(/startTransition\(\(\) => \{ setLods\(next\); \}\)/);
  });

  it('keeps a stand-in card’s own loading inside the group', () => {
    expect(field).toMatch(/<Suspense fallback=\{<Suspense fallback=\{null\}>\{render\}<\/Suspense>\}>/);
  });

  it('loads the far and light models of every look up front, the full ones on demand', () => {
    expect(field).toMatch(/useGLTF\.preload\(planetModel\(node\.id, 'far'\)\)/);
    expect(field).toMatch(/useGLTF\.preload\(planetModel\(node\.id, 'lite'\)\)/);
    expect(field).not.toMatch(/useGLTF\.preload\(planetModel\(node\.id, 'full'\)\)/);
  });
});
