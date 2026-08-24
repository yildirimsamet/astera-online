/**
 * A nebula that looks photographed rather than airbrushed.
 *
 * The previous version was radial gradients. Real deep-field images do not look
 * like that: emission nebulae are FILAMENTARY — fibrous, stringy structure with
 * hard bright rims, and dark dust lanes crossing in front of them. That texture is
 * what the eye reads as "a photograph of space" versus "a background".
 *
 * Three things make it, and all three are needed:
 *
 *   DOMAIN WARP. Plain fBm gives clouds. Feeding fBm through *another* fBm before
 *   sampling stretches and folds those clouds into filaments. It is the whole
 *   difference, and it costs one extra noise field.
 *
 *   DUST. A second, independent field SUBTRACTS. Real nebulae are half absorption,
 *   and the dark lanes are what give a flat glow depth.
 *
 *   A NARROW PALETTE. Hubble-ish: deep blue in the thin gas, teal through the body,
 *   and warm gold only at the densest cores. Space photographs are nearly
 *   monochrome with two accents; a rainbow reads as a screensaver.
 *
 * Painted once into a canvas and handed to a backdrop sphere. Never per-frame.
 */

/* ── noise ──────────────────────────────────────────────────── */

/** Cheap integer hash. Deterministic, fast enough to run ten million times. */
function hash(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * 3D value noise.
 *
 * Three dimensions rather than two so the texture can be sampled on a CYLINDER —
 * feeding it `cos(θ), sin(θ), v` makes it seamless all the way around the sphere,
 * with no visible join behind the player.
 */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);

  const c000 = hash(xi, yi, zi);
  const c100 = hash(xi + 1, yi, zi);
  const c010 = hash(xi, yi + 1, zi);
  const c110 = hash(xi + 1, yi + 1, zi);
  const c001 = hash(xi, yi, zi + 1);
  const c101 = hash(xi + 1, yi, zi + 1);
  const c011 = hash(xi, yi + 1, zi + 1);
  const c111 = hash(xi + 1, yi + 1, zi + 1);

  return mix(
    mix(mix(c000, c100, xf), mix(c010, c110, xf), yf),
    mix(mix(c001, c101, xf), mix(c011, c111, xf), yf),
    zf,
  );
}

/**
 * Exported for the galactic plane, which is painted with the same three ideas —
 * domain warp for filaments, an independent field for dust, a narrow palette — and
 * must not have its own copy of the noise. A second implementation of "what space
 * looks like" is how two surfaces in one photograph come to disagree.
 */
export function fbm(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise3(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

/* ── the plate ──────────────────────────────────────────────── */

/**
 * Deliberately modest.
 *
 * Nebulae have no hard edges, so a 1024x512 plate stretched over the whole sky is
 * indistinguishable from 4K once bilinear filtering has it — and this is CPU work
 * that has to finish before anyone sees the galaxy.
 */
const WIDTH = 1024;
const HEIGHT = 512;

/** Hubble-ish. Deep blue → teal through the body → warm gold in the cores only. */
function palette(density: number, out: [number, number, number]): void {
  const d = Math.min(1, Math.max(0, density));
  if (d < 0.45) {
    const t = d / 0.45;
    out[0] = 10 + t * 22;
    out[1] = 18 + t * 52;
    out[2] = 42 + t * 96;
  } else if (d < 0.78) {
    const t = (d - 0.45) / 0.33;
    out[0] = 32 + t * 46;
    out[1] = 70 + t * 92;
    out[2] = 138 + t * 42;
  } else {
    // Only the densest cores go warm, and they are a small fraction of the sky.
    const t = (d - 0.78) / 0.22;
    out[0] = 78 + t * 150;
    out[1] = 162 + t * 44;
    out[2] = 180 - t * 70;
  }
}

export function paintNebulaCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const image = ctx.createImageData(WIDTH, HEIGHT);
  const data = image.data;
  const rgb: [number, number, number] = [0, 0, 0];

  for (let j = 0; j < HEIGHT; j++) {
    const v = j / HEIGHT;

    /**
     * The galactic band.
     *
     * Structure concentrated toward the horizon, thinning to almost nothing at the
     * poles — which is both what the sky actually looks like from inside a disc,
     * and what keeps the player's view of the playfield clean while the edges of
     * the frame stay interesting.
     */
    const fromPlane = Math.abs(v - 0.5) * 2;
    // A defined band, not a wash. Most of the sky must stay empty or the worlds in
    // front of it lose their silhouettes — which is what happened twice.
    const band = Math.pow(1 - fromPlane, 3.6);

    for (let i = 0; i < WIDTH; i++) {
      const theta = (i / WIDTH) * Math.PI * 2;
      // Cylindrical sampling: seamless the whole way around, no join to hide.
      // Higher frequency than feels right at first: fine filaments read as
      // something enormous and far away, coarse ones read as fog in front of the
      // camera. Distance is carried by detail, not by dimming.
      const cx = Math.cos(theta) * 3.6;
      const cy = Math.sin(theta) * 3.6;
      const cz = v * 6.2;

      // Warp the sample point with its own noise field. This is what turns
      // clouds into filaments.
      const wx = fbm(cx + 5.2, cy + 1.3, cz, 3) * 2.4;
      const wy = fbm(cx - 3.7, cy + 9.1, cz + 4.4, 3) * 2.4;

      const body = fbm(cx + wx, cy + wy, cz + wx * 0.4, 5);
      // A narrow isodensity ridge over the broad body. Real emission fronts form
      // lit fibres and torn rims; another blanket of low-frequency noise would
      // only make thicker fog.
      const ridgeField = fbm(cx * 1.55 + wx + 7.4, cy * 1.55 + wy - 2.8, cz * 1.35, 4);
      const ridge = Math.pow(Math.max(0, 1 - Math.abs(ridgeField - 0.53) * 7.2), 3.4);
      // Steep gamma, modest gain. Contrast is what makes gas look like gas; a high
      // gain just makes the whole sphere glow.
      let density = (Math.pow(body, 3.35) * 1.38 + ridge * 0.13) * band;

      // Absorption. Independent field, subtracts — the dark lanes are half of why
      // a real nebula reads as three-dimensional.
      const dust = fbm(cx * 1.9 - 11.0, cy * 1.9 + 6.0, cz * 1.9, 4);
      density *= 1 - Math.pow(Math.max(0, dust - 0.42) / 0.58, 1.1) * 0.92;

      palette(density, rgb);

      // Everything fades to the same near-black the page uses, so the sphere and
      // the interface behind it are the same colour where there is no gas.
      // Ceiling on the brightest gas. Nothing in the backdrop may approach the
      // brightness of a planet, or the planet stops being the subject.
      const intensity = Math.min(0.5, density);
      const p = (j * WIDTH + i) * 4;
      data[p] = 4 + rgb[0] * intensity;
      data[p + 1] = 6 + rgb[1] * intensity;
      data[p + 2] = 12 + rgb[2] * intensity;
      data[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/* ── the galactic plane ─────────────────────────────────────── */

/**
 * THE PLANE, PHOTOGRAPHED RATHER THAN PLOTTED. D53b.
 *
 * A disc with nothing in it reads as a scatter plot, so the camera needs something
 * to orbit and the eye needs to know which way is up. That much was always right.
 * What was wrong is that it was drawn with LINES — five rings and sixteen spokes,
 * and later the same rings modulated into arcs.
 *
 * Modulating them was treating the symptom. The graph-paper quality does not come
 * from the lines being even; it comes from them being LINES. Seen from above, thin
 * hard strokes at constant width are vector graphics, and a telescope image has no
 * vector graphics in it — so the plane read as a radar screen no matter how the
 * brightness was varied around it. Photographed from overhead after the first pass,
 * it still read as a targeting reticle.
 *
 * So the strokes are gone and the plane is a painted plate: spiral arms of gas and
 * dust, lying flat, fading to nothing at the rim. It orients BETTER than the rings
 * did — the arms carry rotation as well as extent, which concentric circles cannot
 * — and it is the same one draw call.
 *
 * SAME THREE IDEAS AS THE NEBULA, and deliberately: domain-warped noise for
 * filaments, an independent field subtracting for dust lanes, and a narrow palette.
 * Two surfaces in one photograph that were built from different ideas about what
 * space looks like will always disagree with each other.
 *
 * IT LEAVES THE MIDDLE ALONE. `Core` already puts a warm brightening at the centre,
 * and the design has no star there — this fades out before it reaches it, so the
 * two never stack into something that reads as a sun.
 */
const PLATE = 768;

/** How much of the middle the plate leaves entirely to `Core`. */
const DISC_HOLE = 0.08;
/** Where the body of the disc stops being flat and starts falling away. */
const DISC_SHOULDER = 0.3;

/**
 * HOW MUCH DISC THERE IS AT A GIVEN DISTANCE FROM THE CENTRE, 0 at the middle and
 * 0 at the rim.
 *
 * Pulled out of the painter because it is the part that can produce a VISIBLE
 * defect rather than a different-looking one, and neither failure is subtle:
 *
 *   · A non-zero value at the rim gives the plate a hard circular edge — a disc
 *     with a cut boundary is the exact "drawn" quality this replaced lines to be
 *     rid of.
 *   · A non-zero value at the centre stacks on top of `Core`, and the two together
 *     read as a star. The design deliberately has none, and worlds do not orbit it.
 *
 * The painter's pixels cannot be asserted — jsdom has no 2D context — but this can.
 */
export function discProfile(r: number): number {
  if (!(r > 0) || r >= 1) return 0;
  const inner = Math.min(1, Math.max(0, (r - DISC_HOLE) / 0.22));
  const outer = Math.pow(Math.max(0, 1 - (r - DISC_SHOULDER) / 0.7), 1.9);
  return inner * (r < DISC_SHOULDER ? 1 : outer);
}

/** Logarithmic, like a real spiral. Higher is more tightly wound. */
const ARM_TIGHTNESS = 2.6;
const ARMS = 2;

export function paintDiscCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PLATE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const image = ctx.createImageData(PLATE, PLATE);
  const data = image.data;
  const half = PLATE / 2;
  const sector = (Math.PI * 2) / ARMS;

  for (let j = 0; j < PLATE; j++) {
    for (let i = 0; i < PLATE; i++) {
      const dx = (i - half) / half;
      const dy = (j - half) / half;
      const r = Math.hypot(dx, dy);
      const p = (j * PLATE + i) * 4;

      const profile = discProfile(r);
      if (profile <= 0) {
        data[p + 3] = 0;
        continue;
      }

      const theta = Math.atan2(dy, dx);

      /**
       * HOW FAR THIS PIXEL IS FROM THE NEAREST ARM.
       *
       * A logarithmic spiral is `θ = ln(r) / tan(pitch)`, so the offset from an arm
       * is the angle modulo the sector once that term is taken out. Wrapped to the
       * half-sector either side, so the falloff is symmetric across an arm rather
       * than sawtoothed on one edge of it.
       */
      let offset = (theta - Math.log(r) * ARM_TIGHTNESS) % sector;
      if (offset < 0) offset += sector;
      if (offset > sector / 2) offset = sector - offset;
      // Arms are broad near the core and narrow further out, which is what stops
      // the spiral from reading as a drawn line at the rim.
      const width = 0.42 + r * 0.4;
      const arm = Math.pow(Math.max(0, 1 - offset / width), 2.4);

      /**
       * Filaments, from the same warped noise the backdrop uses — and at a HIGHER
       * frequency than feels right at first, for the reason written there: fine
       * structure reads as something enormous and far away, coarse structure reads
       * as fog in front of the camera. The first plate was sampled at 3.1 and came
       * back airbrushed: two smooth ribbons with no grain in them at all.
       */
      const nx = dx * 5.4;
      const ny = dy * 5.4;
      const wx = fbm(nx + 12.3, ny - 4.1, 0.7, 3) * 2.1;
      const wy = fbm(nx - 8.8, ny + 3.4, 2.2, 3) * 2.1;
      // Gamma on the grain rather than gain: contrast is what makes gas look like
      // gas, and a higher gain just makes the whole plate glow.
      const grain = Math.pow(fbm(nx + wx, ny + wy, 1.4, 5), 1.5);

      // Dust. An independent field that SUBTRACTS, which is what gives a flat glow
      // depth — the dark lanes are half of why a real disc reads as three-dimensional.
      const dust = fbm(nx * 2.1 - 5.5, ny * 2.1 + 7.7, 3.9, 4);
      const absorbed = 1 - Math.min(1, Math.pow(Math.max(0, dust - 0.4) / 0.6, 1) * 1.15);

      // A floor of diffuse haze under the arms, so the disc is a body rather than
      // two ribbons on nothing.
      const density = profile * (0.16 + arm * 0.84) * (0.2 + grain * 2.2) * absorbed;

      /**
       * Cool through the body, a little warmer toward the middle. The same narrow
       * palette rule as the backdrop: space photographs are nearly monochrome with
       * one accent, and a rainbow reads as a screensaver.
       */
      const warmth = Math.pow(Math.max(0, 1 - r / 0.55), 2);
      const intensity = Math.min(1, density);
      data[p] = 90 + warmth * 150;
      data[p + 1] = 120 + warmth * 70;
      data[p + 2] = 190 - warmth * 40;
      data[p + 3] = Math.round(intensity * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}
