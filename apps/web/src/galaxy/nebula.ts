/**
 * The galactic plane's painted plate, and the value noise it is painted with.
 *
 * The sky's nebulae used to be painted here too, on the CPU, at 1024×512 — under
 * three texels a degree, which is why they could only ever be a vague navy wash.
 * They are baked on the GPU now (`sky.ts`); what is left is the plate the worlds
 * sit in, painted with the same three ideas: domain warp for filaments, an
 * independent field that subtracts for dust, and a narrow palette.
 *
 * Painted once into a canvas. Never per-frame.
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
const ARM_TIGHTNESS = 3;
const ARMS = 3;
/** Keep the S-shaped arms present, but half as prominent as the surrounding gas. */
const ARM_VISIBILITY = 0.1;

export function paintDiscCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PLATE;
  const ctx = canvas.getContext("2d");
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
      const absorbed =
        1 - Math.min(1, Math.pow(Math.max(0, dust - 0.4) / 0.6, 1) * 1.15);

      // A floor of diffuse haze under the arms, so the disc is a body rather than
      // two ribbons on nothing.
      const density =
        profile *
        (0.16 + arm * 0.84 * ARM_VISIBILITY) *
        (0.2 + grain * 2.2) *
        absorbed;

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
