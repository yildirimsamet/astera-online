import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RENDER_QUALITIES } from '../src/lib/quality.js';
import { DISC_RADIUS } from '../src/galaxy/scene.js';
import {
  BRIGHT_STAR_VERTEX,
  CLOUD_STAR_VERTEX,
  coreProfile,
  skyBehindPlanets,
} from '../src/galaxy/Environment.jsx';
import {
  MILKY_WAY_POLE,
  SKY_BAKE_SIZE,
  SKY_BAKE_STEPS,
  skyBakeStep,
  HERO_CARD_SPAN,
  SKY_GALAXY_CARDS,
  SKY_HERO,
  SKY_LUMINANCE_CEILING,
  SKY_SITES,
  SKY_DEEP_STAR_COUNT,
  SKY_DEEP_STAR_REACH,
  SKY_RADIUS,
  SKY_STAR_COUNT,
  STAR_VERTEX,
  DEEP_STAR_VERTEX,
  STAR_TWINKLE_DEPTH,
  buildDeepStars,
  buildSkyStars,
  galaxyCardSize,
  heroCardCorners,
  compositionView,
} from '../src/galaxy/sky.js';

/**
 * THE SKY. Owner instruction: *"nasa fotoğraflarındaki gibi olmalı… cihazları
 * öldürme."*
 *
 * Most of what makes the sky read as a photograph is judged from a photograph,
 * and `tools/sky-visual.mjs` takes those. What is here are the properties that
 * would ship a visible defect or a hot phone rather than a different-looking
 * picture — the ones no screenshot proves on its own.
 */

const latitudeOf = (x: number, y: number, z: number): number =>
  x * MILKY_WAY_POLE[0] + y * MILKY_WAY_POLE[1] + z * MILKY_WAY_POLE[2];

describe('the baked sky', () => {
  it('lets a solid world hide stars and gas behind it', () => {
    for (const material of [
      new THREE.ShaderMaterial({ depthTest: false, depthWrite: true }),
      new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: true }),
    ]) {
      expect(skyBehindPlanets(material)).toBe(material);
      expect(material.depthTest).toBe(true);
      expect(material.depthWrite).toBe(false);
    }
  });

  it('keeps even nearby decorative stars behind a planet silhouette', () => {
    for (const shader of [STAR_VERTEX, DEEP_STAR_VERTEX, BRIGHT_STAR_VERTEX, CLOUD_STAR_VERTEX]) {
      expect(typeof shader).toBe('string');
      const source = typeof shader === 'string' ? shader : '';
      const match = /gl_Position\.z\s*=\s*gl_Position\.w\s*\*\s*([0-9.]+)/.exec(source);
      expect(match, 'star must keep screen position but move behind solid worlds').not.toBeNull();
      const clipDepth = Number(match?.[1]);
      expect(clipDepth).toBeGreaterThan(0.999);
      expect(clipDepth).toBeLessThan(1);
    }
  });
  /**
   * SIX FACES OF RGBA8 IS THE WHOLE BILL, AND IT IS PAID ONCE.
   *
   * No mipmaps: the sky sits at infinity under a fixed field of view, so it is
   * never drawn smaller than it was baked and a mip chain would be memory that is
   * never sampled.
   */
  it.each(RENDER_QUALITIES)('%s bakes a power-of-two cube under 32 MB', (quality) => {
    const size = SKY_BAKE_SIZE[quality];
    expect(Math.log2(size) % 1).toBe(0);
    expect(6 * size * size * 4).toBeLessThanOrEqual(32 * 1024 * 1024);
  });

  it('never gives a cheaper preset a sharper sky', () => {
    expect(SKY_BAKE_SIZE.high).toBeGreaterThanOrEqual(SKY_BAKE_SIZE.balanced);
    expect(SKY_BAKE_SIZE.balanced).toBeGreaterThanOrEqual(SKY_BAKE_SIZE.low);
    expect(SKY_STAR_COUNT.high).toBeGreaterThanOrEqual(SKY_STAR_COUNT.balanced);
    expect(SKY_STAR_COUNT.balanced).toBeGreaterThanOrEqual(SKY_STAR_COUNT.low);
  });

  /**
   * THE PHONE PAYS FOR EVERY STAR ON EVERY FRAME. Owner: *"Çok fazla yıldız var…
   * oyun alanı olan galaksi belirginliğini kaybediyor ve cihazımı kastırıyor."*
   * A ceiling on what the sky asks of the vertex stage, per preset.
   */
  it.each([
    ['high', 28_000],
    ['balanced', 22_000],
    ['low', 13_000],
  ] as const)('%s keeps the whole starfield under %i vertices', (quality, ceiling) => {
    expect(SKY_STAR_COUNT[quality] + SKY_DEEP_STAR_COUNT[quality]).toBeLessThanOrEqual(ceiling);
  });

  /**
   * NO FRAME CARRIES MORE THAN A QUARTER OF A FACE. The bake is the one expensive
   * thing the sky does; one whole face in one frame was a visible hitch on a phone.
   */
  it.each(RENDER_QUALITIES)('%s bakes every row of every face exactly once, a strip at a time', (quality) => {
    const size = SKY_BAKE_SIZE[quality];
    const painted = new Map<number, number[]>();
    const cards: number[] = [];
    for (let step = 0; step < SKY_BAKE_STEPS; step++) {
      const work = skyBakeStep(step, size);
      if (work.kind === 'card') { cards.push(work.index); continue; }
      expect(work.kind).toBe('face');
      if (work.kind !== 'face') continue;
      expect(work.rows * size).toBeLessThanOrEqual((size * size) / 4);
      const rows = painted.get(work.face) ?? new Array<number>(size).fill(0);
      for (let y = work.y; y < work.y + work.rows; y++) rows[y]! += 1;
      painted.set(work.face, rows);
    }
    expect(cards).toEqual(SKY_GALAXY_CARDS.map((_, index) => index));
    expect([...painted.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const rows of painted.values()) expect(rows.every((n) => n === 1)).toBe(true);
    expect(skyBakeStep(SKY_BAKE_STEPS, size).kind).toBe('done');
    expect(skyBakeStep(-1, size).kind).toBe('waiting');
  });

  /**
   * SCENERY IS NOT ALLOWED TO GLOW. The worlds are the subject (DISC_OPACITY's
   * rule). Gas that crosses a bloom threshold turns from a photograph into a
   * neon sign — which is precisely what the owner said not to build — so the
   * ceiling sits under the LOWEST threshold any canvas that draws this sky uses.
   */
  it('keeps the gas under every bloom threshold that draws it', () => {
    const thresholds = ['src/galaxy/GalaxyCanvas.tsx', 'src/landing/LandingScene.tsx'].map(
      (path) => {
        const source = readFileSync(resolve(process.cwd(), path), 'utf8');
        const match = /luminanceThreshold=\{([0-9.]+)\}/.exec(source);
        expect(match, `${path} has no bloom threshold to check`).not.toBeNull();
        return Number(match![1]);
      },
    );
    expect(SKY_LUMINANCE_CEILING).toBeGreaterThan(0);
    expect(SKY_LUMINANCE_CEILING).toBeLessThan(Math.min(...thresholds));
  });
});

describe('the composition', () => {
  const opening = compositionView();
  const angle = (a: readonly number[], b: readonly number[]): number =>
    (Math.acos(Math.min(1, Math.max(-1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!))) * 180) /
    Math.PI;

  /** Composed for a camera looking down at a world, as the orbit mostly does. */
  it('is composed for a view looking down at a world', () => {
    const elevation = (Math.asin(opening[1]) * 180) / Math.PI;
    expect(elevation).toBeLessThan(-25);
    expect(elevation).toBeGreaterThan(-45);
    expect(Math.hypot(...opening)).toBeCloseTo(1, 9);
  });

  /**
   * THE FIRST THING A PLAYER SEES IS THEIR WORLD IN FRONT OF THE MILKY WAY.
   * The band was first placed by taste and the home camera opened looking at the
   * one empty half of the sky.
   */
  it('puts the Milky Way behind the world the camera opens on', () => {
    expect(Math.abs(latitudeOf(...opening))).toBeLessThan(0.02);
  });

  /**
   * THE HERO: A GALAXY BEYOND THIS ONE, STANDING OVER THE PLAYER'S WORLD. Owner:
   * *"görünce ağzım açık kalsın"* — and, of a painted range of dust cliffs,
   * *"bir yağlı boya tablosunun içinde değil."* A galaxy is a crisp, structured
   * object rather than a wash, and it is the thing that says how big space is.
   *
   * Whole in the opening frame (half-height 22.5°, half-width ~10.8°), clear of
   * the world at its centre, and off the band — real galaxies are hidden behind a
   * Milky Way's dust, and one drawn through it would read as a sticker.
   */
  it('hangs a whole galaxy above the world the camera opens on', () => {
    const hero = SKY_HERO;
    for (const other of SKY_SITES.galaxies) expect(hero.brightness).toBeGreaterThanOrEqual(other.brightness);
    const away = angle(opening, hero.direction);
    expect(away - hero.radius, 'clear of the world').toBeGreaterThan(4);
    expect(away + hero.radius, 'inside the frame').toBeLessThan(21);
    const [x, , z] = opening;
    const right = [-z, 0, x];
    const length = Math.hypot(right[0]!, right[2]!);
    const sideways =
      (Math.asin(Math.abs(right[0]! * hero.direction[0] + right[2]! * hero.direction[2]) / length) * 180) /
      Math.PI;
    expect(sideways + hero.radius * 0.7, 'inside the frame sideways').toBeLessThan(10.8);
    const offBand = (Math.asin(Math.abs(latitudeOf(...hero.direction))) * 180) / Math.PI;
    expect(offBand).toBeGreaterThan(hero.radius);
  });

  /**
   * THE HERO'S CARD IS THE GNOMONIC PLANE ITSELF: tangent to the sky at the
   * galaxy's centre, so the sharper texture lands exactly where the cube would
   * have put the softer one, with no distortion to hide.
   */
  it('lays the hero galaxy card tangent to the sky, spanning its gnomonic extent', () => {
    const distance = 450;
    const corners = heroCardCorners(SKY_HERO, distance);
    expect(corners).toHaveLength(4);
    const centre = [0, 1, 2].map((k) => corners.reduce((sum, c) => sum + c[k]!, 0) / 4);
    SKY_HERO.direction.forEach((v, k) => {
      expect(centre[k]).toBeCloseTo(v * distance, 6);
    });
    for (const corner of corners) {
      const offset = corner.map((v, k) => v - centre[k]!);
      const along = offset[0]! * SKY_HERO.direction[0] + offset[1]! * SKY_HERO.direction[1] + offset[2]! * SKY_HERO.direction[2];
      expect(along).toBeCloseTo(0, 6);
    }
    // Midpoint of an edge sits at atan(span · tan R) from the centre.
    const edge = corners[0]!.map((v, k) => (v + corners[1]![k]!) / 2);
    const length = Math.hypot(...edge);
    const cos = (edge[0]! * SKY_HERO.direction[0] + edge[1]! * SKY_HERO.direction[1] + edge[2]! * SKY_HERO.direction[2]) / length;
    const expected = Math.atan(HERO_CARD_SPAN * Math.tan((SKY_HERO.radius * Math.PI) / 180));
    expect(Math.acos(cos)).toBeCloseTo(expected, 6);
  });

  /**
   * SCATTERED, LARGE AND SMALL, NEVER STACKED. Owner, 2026-09-25: *"Şu bulutsulardan
   * sağa sola irili ufaklı birazcık daha dağıt."* No two clouds or galaxies overlap,
   * and they come in several sizes and colours.
   */
  it('scatters the clouds and galaxies without stacking any two', () => {
    const things = [
      ...SKY_SITES.emission,
      ...SKY_SITES.reflection,
      SKY_SITES.dark,
      ...SKY_SITES.galaxies,
      ...SKY_GALAXY_CARDS,
    ];
    for (let i = 0; i < things.length; i++) {
      for (let j = i + 1; j < things.length; j++) {
        const a = things[i]!;
        const b = things[j]!;
        expect(angle(a.direction, b.direction), `${String(i)} vs ${String(j)}`).toBeGreaterThan(
          a.radius + b.radius,
        );
      }
    }
    expect(SKY_SITES.emission.length + SKY_SITES.reflection.length).toBeGreaterThanOrEqual(7);
    expect(new Set(SKY_SITES.emission.map((cloud) => cloud.radius)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(SKY_SITES.emission.map((cloud) => cloud.oxygen)).size).toBeGreaterThanOrEqual(3);
    // Each in its own shape: round ones and drawn-out ones, turned every which way.
    const stretches = SKY_SITES.emission.map((cloud) => cloud.stretch);
    expect(new Set(stretches).size).toBeGreaterThanOrEqual(3);
    for (const stretch of stretches) {
      expect(stretch).toBeGreaterThanOrEqual(1);
      expect(stretch).toBeLessThanOrEqual(2.5);
    }
    expect(new Set(SKY_SITES.emission.map((cloud) => cloud.turn)).size).toBe(SKY_SITES.emission.length);
  });

  /**
   * MORE GALAXIES LIKE THE HERO, NEVER RIVALS TO IT. Owner, 2026-09-25: *"Hero
   * galaksiye benzer bir iki tane daha farklı boyutlarda ve farklı renklerde galaksi
   * çiz."* Each is crisp on its own card; each is smaller and dimmer than the hero,
   * in its own colours, and away from the first frame so the hero keeps it.
   */
  it('adds galaxies like the hero in their own sizes and colours, all below it', () => {
    expect(SKY_GALAXY_CARDS[0]).toBe(SKY_HERO);
    expect(SKY_GALAXY_CARDS.length).toBeGreaterThanOrEqual(3);
    const others = SKY_GALAXY_CARDS.slice(1);
    for (const galaxy of others) {
      expect(galaxy.radius).toBeLessThan(SKY_HERO.radius);
      expect(galaxy.brightness).toBeLessThanOrEqual(SKY_HERO.brightness);
      expect(angle(galaxy.direction, opening)).toBeGreaterThan(25);
    }
    expect(new Set(SKY_GALAXY_CARDS.map((galaxy) => galaxy.radius)).size).toBe(SKY_GALAXY_CARDS.length);
    const arms = SKY_GALAXY_CARDS.map((galaxy) => galaxy.palette.arms);
    for (let i = 0; i < arms.length; i++) {
      for (let j = i + 1; j < arms.length; j++) {
        const difference = Math.max(...arms[i]!.map((v, k) => Math.abs(v - arms[j]![k]!)));
        expect(difference, 'two galaxies share a colour').toBeGreaterThan(0.08);
      }
    }
  });

  /** Sharp on a phone at DPR 2 (~36 texels a degree), and never wasteful. */
  it('bakes every galaxy card sharp enough for a phone', () => {
    for (const galaxy of SKY_GALAXY_CARDS) {
      const size = galaxyCardSize(galaxy);
      const span = 2 * HERO_CARD_SPAN * galaxy.radius;
      expect(size / span).toBeGreaterThanOrEqual(36);
      expect(size).toBeLessThanOrEqual(768);
    }
  });

  /**
   * A FEW SMALL SHAPES, NEVER A COVER. Owner: *"Toz bulutlarını abartma… gazlar
   * bir kaç tane görece daha ufak şekiller olarak yine kalabilir ama tüm galaksiyi
   * kaplamamalı."* Most of the sky is black and full of stars; the gas is accents.
   */
  it('keeps the gas to a few small shapes', () => {
    const shapes = [...SKY_SITES.emission, ...SKY_SITES.reflection, SKY_SITES.dark];
    expect(shapes.length).toBeLessThanOrEqual(9);
    const sky = 4 * Math.PI;
    let covered = 0;
    for (const shape of shapes) {
      expect(shape.radius, 'no single cloud may dominate a frame').toBeLessThanOrEqual(11);
      covered += 2 * Math.PI * (1 - Math.cos((shape.radius * Math.PI) / 180));
    }
    expect(covered / sky).toBeLessThan(0.03);
  });
});

describe('the stars', () => {
  const stars = buildSkyStars(24_000, 0x5a17f13d);

  it('is the same sky every time, so a visual regression is a comparison', () => {
    const again = buildSkyStars(24_000, 0x5a17f13d);
    expect(again.positions).toEqual(stars.positions);
    expect(again.colours).toEqual(stars.colours);
    expect(again.flux).toEqual(stars.flux);
    expect(buildSkyStars(24_000, 7).positions).not.toEqual(stars.positions);
  });

  it('places every star on the unit sphere', () => {
    expect(stars.positions).toHaveLength(24_000 * 3);
    expect(stars.flux).toHaveLength(24_000);
    for (let i = 0; i < 24_000; i++) {
      const p = stars.positions;
      const length = Math.hypot(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
      expect(Math.abs(length - 1)).toBeLessThan(1e-5);
    }
  });

  /**
   * FROM INSIDE A GALAXY THE STARS ARE A BAND. It is what ties the sky's gas to
   * its stars: a Milky Way of glow with a uniform scatter in front of it reads as
   * two unrelated layers.
   */
  it('crowds the Milky Way band without emptying the rest of the sky', () => {
    const band = Math.sin((10 * Math.PI) / 180);
    let inBand = 0;
    let high = 0;
    for (let i = 0; i < 24_000; i++) {
      const p = stars.positions;
      const latitude = Math.abs(latitudeOf(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!));
      if (latitude < band) inBand += 1;
      if (latitude > 0.5) high += 1;
    }
    // A uniform sky puts sin(10°) ≈ 17% of its stars inside ±10°.
    expect(inBand / 24_000).toBeGreaterThan(band * 2.2);
    // …and half of them above 30°. The poles keep a real share.
    expect(high / 24_000).toBeGreaterThan(0.2);
  });

  /**
   * THE BAND, THINNED BY A THIRD. Owner, 2026-09-25: *"Yıldız kuşağındaki yıldızlar
   * çok sık. %30 civarı azalt."* Measured on the balanced field before the change:
   * 11,236 stars within ±10° of the band and 4,250 more than 30° off it. The band
   * loses about thirty per cent; the rest of the sky keeps what it had.
   */
  it('holds about 30% fewer stars in the band, and the same everywhere else', () => {
    const count = SKY_STAR_COUNT.balanced;
    const field = buildSkyStars(count, 0x5a17f13d);
    const band = Math.sin((10 * Math.PI) / 180);
    let inBand = 0;
    let away = 0;
    for (let i = 0; i < count; i++) {
      const p = field.positions;
      const latitude = Math.abs(latitudeOf(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!));
      if (latitude < band) inBand += 1;
      else if (latitude > 0.5) away += 1;
    }
    expect(inBand / 11_236).toBeGreaterThan(0.66);
    expect(inBand / 11_236).toBeLessThan(0.74);
    expect(Math.abs(away / 4_250 - 1)).toBeLessThan(0.07);
  });

  /**
   * A POWER LAW. Uniform brightness is the single biggest tell of a fake sky;
   * a real one is overwhelmingly faint stars and a handful of bright ones.
   */
  it('is overwhelmingly faint, with a few bright stars', () => {
    const flux = Array.from(stars.flux).sort((a, b) => a - b);
    const max = flux[flux.length - 1]!;
    const median = flux[Math.floor(flux.length / 2)]!;
    expect(median).toBeLessThan(max * 0.08);
    expect(flux.filter((value) => value > max * 0.5).length / flux.length).toBeLessThan(0.01);
    expect(flux[0]).toBeGreaterThan(0);
  });

  /**
   * SOME OF THEM SHIMMER, GENTLY. Owner: *"bazıları hafif hafif ışıldıyor şeklinde
   * olması daha gerçekçi olmaz mı?"* Space has no air to make stars twinkle, so it
   * is a light touch: a minority, among the stars bright enough to be noticed, on a
   * slow pulse — a shimmer, never a blink.
   */
  it('lets a minority of the visible stars shimmer slowly and gently', () => {
    const flux = Array.from(stars.flux).sort((a, b) => a - b);
    const median = flux[Math.floor(flux.length / 2)]!;
    let shimmering = 0;
    for (let i = 0; i < 24_000; i++) {
      const rate = stars.twinkle[i * 2]!;
      if (rate === 0) continue;
      shimmering += 1;
      expect(stars.flux[i]!).toBeGreaterThanOrEqual(median);
      // One pulse every ~3 to ~15 seconds.
      expect(rate).toBeGreaterThanOrEqual(0.4);
      expect(rate).toBeLessThanOrEqual(2.2);
    }
    expect(shimmering / 24_000).toBeGreaterThan(0.08);
    expect(shimmering / 24_000).toBeLessThan(0.2);
    expect(STAR_TWINKLE_DEPTH).toBeGreaterThan(0);
    expect(STAR_TWINKLE_DEPTH).toBeLessThanOrEqual(0.4);
  });

  /**
   * STAR COLOUR IS A TEMPERATURE, NOT A PALETTE. A blackbody runs orange →
   * white → blue-white, so green always sits between red and blue. A green or
   * magenta star is the screensaver tell.
   */
  it('colours every star from the blackbody locus', () => {
    for (let i = 0; i < 24_000; i++) {
      const r = stars.colours[i * 3]!;
      const g = stars.colours[i * 3 + 1]!;
      const b = stars.colours[i * 3 + 2]!;
      expect(g).toBeGreaterThanOrEqual(Math.min(r, b) - 1e-6);
      expect(g).toBeLessThanOrEqual(Math.max(r, b) + 1e-6);
      expect(Math.max(r, g, b)).toBeLessThanOrEqual(1);
      expect(Math.min(r, g, b)).toBeGreaterThan(0);
    }
  });
});

/**
 * DEPTH. Owner: *"insanlar kendini uzayda hissetmeli, bir yağlı boya tablosunun
 * içinde değil."* A sky at infinity never moves against itself, however it is
 * painted — that is what makes it a backdrop. These stars stand at real
 * distances, so every orbit and every flight slides the near ones across the far.
 */
describe('the deep stars', () => {
  const deep = buildDeepStars(4_000, 0x2bd1e6a5);

  it('is the same field every time', () => {
    expect(buildDeepStars(4_000, 0x2bd1e6a5).positions).toEqual(deep.positions);
  });

  /**
   * OUTSIDE THE WORLDS, INSIDE THE SKY. A star among the worlds is clutter the
   * eye has to sort from a craft; one past the sky sphere is never drawn.
   */
  it('stands between the playfield and the sky', () => {
    const [near, far] = SKY_DEEP_STAR_REACH;
    expect(near).toBeGreaterThan(DISC_RADIUS * 1.5);
    expect(far).toBeLessThan(SKY_RADIUS * 0.85);
    for (let i = 0; i < 4_000; i++) {
      const r = Math.hypot(deep.positions[i * 3]!, deep.positions[i * 3 + 1]!, deep.positions[i * 3 + 2]!);
      expect(r).toBeGreaterThanOrEqual(near - 1e-3);
      expect(r).toBeLessThanOrEqual(far + 1e-3);
    }
  });

  /** Evenly through the volume, so the near shell is not crowded and the far one empty. */
  it('fills the volume evenly rather than crowding the inner shell', () => {
    const [near, far] = SKY_DEEP_STAR_REACH;
    const middle = Math.cbrt((near ** 3 + far ** 3) / 2);
    let inner = 0;
    for (let i = 0; i < 4_000; i++) {
      const r = Math.hypot(deep.positions[i * 3]!, deep.positions[i * 3 + 1]!, deep.positions[i * 3 + 2]!);
      if (r < middle) inner += 1;
    }
    expect(inner / 4_000).toBeGreaterThan(0.44);
    expect(inner / 4_000).toBeLessThan(0.56);
  });

  it('never gives a cheaper preset more of them', () => {
    expect(SKY_DEEP_STAR_COUNT.high).toBeGreaterThanOrEqual(SKY_DEEP_STAR_COUNT.balanced);
    expect(SKY_DEEP_STAR_COUNT.balanced).toBeGreaterThanOrEqual(SKY_DEEP_STAR_COUNT.low);
  });
});

/**
 * THE GRID. Owner: *"ızgara deseni nedir? gereksizse görüntüyü bozuyorsa sil
 * gitsin."* It was the core's texture: a canvas radial gradient, which Chrome
 * paints with an ordered 4×4 dither, magnified by the sprite until the pattern
 * showed as a grid of coloured dots across the middle of the galaxy. The falloff
 * is computed now, so there is no pattern in it to magnify.
 */
describe('the galactic core', () => {
  it('computes its falloff rather than painting a dithered canvas gradient', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/galaxy/Environment.tsx'), 'utf8');
    const core = source.slice(source.indexOf('export function Core()'), source.indexOf('/* ── stars and dust'));
    expect(core).not.toContain('createRadialGradient');
  });

  it('is brightest in the middle, smooth, and nothing at its edge', () => {
    const [, , , centre] = coreProfile(0);
    expect(centre).toBeGreaterThan(0.4);
    expect(coreProfile(1)[3]).toBe(0);
    expect(coreProfile(1.4)[3]).toBe(0);
    let previous = centre;
    for (let r = 0.01; r <= 1; r += 0.01) {
      const alpha = coreProfile(r)[3];
      expect(alpha).toBeLessThanOrEqual(previous + 1e-9);
      expect(previous - alpha).toBeLessThan(0.05);
      previous = alpha;
    }
  });
});
