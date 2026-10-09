import { RING_SPANS } from './cosmeticRings.js';

/**
 * Programs for the second premium wave. Each new ring and drive compiles alone, so a driver
 * that rejects one leaves every other product drawing, and an unused look never compiles.
 * Animation reads `uTime`; nothing here allocates per frame.
 */
const NOISE = `
  #define TAU 6.28318530718
  #define PI 3.14159265359
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise21(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0, amp = .55;
    for (int i = 0; i < 3; i++) { sum += noise21(p) * amp; p = p * 2.03 + vec2(17.1, 9.2); amp *= .5; }
    return sum;
  }
  vec2 spin(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  vec3 spectrum(float h) { return .5 + .5 * cos(TAU * (h + vec3(0.0, .33, .67))); }
`;
const OUTPUT = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/**
 * Ring planes: `vPlane` is the position in the ring plane, in world radii. `uLift` lets a belt
 * undulate out of its plane, so it keeps a visible body when the camera sees it nearly edge-on.
 */
export const ringVertex = `
  varying vec2 vPlane;
  uniform float uTime;
  uniform float uLift;
  void main() {
    vPlane = position.xy;
    vec3 p = position;
    float angle = atan(p.y, p.x);
    p.z += (sin(angle * 3.0 - uTime * .6) * .7 + sin(angle * 7.0 + length(p.xy) * 5.0 + uTime * .9) * .3) * uLift;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

/** GLSL for the belt's own 0–1 coordinate, from the same span as its annulus. */
const across = (span: readonly [number, number]) => `((r - ${span[0].toFixed(3)}) / ${(span[1] - span[0]).toFixed(3)})`;

/** Real ring anatomy from a 1D profile, Keplerian shear, B-ring spokes and ice glints. */
export const saturnFragment = `
  uniform float uTime;
  uniform sampler2D uProfile;
  varying vec2 vPlane;
  ${NOISE}
  void main() {
    float r = length(vPlane);
    float t = ${across(RING_SPANS.saturn)};
    if (t < 0.0 || t > 1.0) discard;
    vec4 profile = texture2D(uProfile, vec2(t, .5));
    float orbit = uTime * .05 / pow(r / ${RING_SPANS.saturn[0].toFixed(3)}, 1.5);
    vec2 moving = spin(vPlane, -orbit);
    float angle = atan(moving.y, moving.x);
    // Soft ringlets and wakes: a gentle grain, never the grooves of a record.
    float ringlets = .92 + .08 * noise21(vec2(t * 180.0, .5));
    float wakes = noise21(moving * 26.0 + t * 13.0);
    float density = profile.a * ringlets * (.94 + .12 * wakes);
    float spokes = smoothstep(.6, .92, noise21(normalize(moving) * 3.2 + 5.0)) * smoothstep(.3, .36, t) * (1.0 - smoothstep(.56, .64, t));
    vec3 colour = pow(profile.rgb, vec3(2.2)) * 1.3 * (1.0 - spokes * .3);
    colour *= .7 + .3 * (.5 + .5 * cos(atan(vPlane.y, vPlane.x) - 2.3));
    vec2 cell = floor(vec2(angle * 160.0, t * 90.0));
    float glint = step(.994, hash21(cell)) * smoothstep(.26, .3, t) * pow(.5 + .5 * sin(uTime * 2.2 + hash21(cell + 7.0) * 60.0), 16.0);
    colour += vec3(1.3, 1.25, 1.15) * glint;
    float alpha = clamp(density * .95 + glint * .4, 0.0, 1.0);
    if (alpha < .01) discard;
    gl_FragColor = vec4(colour, alpha);
    ${OUTPUT}
  }
`;

/** A rainbow diamond-dust belt under the crystal shards. */
export const prismDustFragment = `
  uniform float uTime;
  uniform float uVeil;
  varying vec2 vPlane;
  ${NOISE}
  void main() {
    float r = length(vPlane);
    float t = ${across(RING_SPANS.prism)};
    // Two halos under the two crystal lanes, joined by a faint veil.
    float lanes = exp(-pow((t - .3) * 7.0, 2.0)) + .7 * exp(-pow((t - .78) * 9.0, 2.0));
    float body = smoothstep(0.0, .12, t) * (1.0 - smoothstep(.86, 1.0, t)) * (.25 + lanes);
    vec2 moving = spin(vPlane, -uTime * .04);
    float swirl = fbm(moving * 3.2);
    float angle = atan(vPlane.y, vPlane.x);
    float grooves = pow(.5 + .5 * sin(r * 140.0), 18.0);
    vec3 colour = mix(vec3(.72, .9, 1.15), spectrum(t * 1.3 + angle * .16 + uTime * .025) * 1.25, .65);
    vec2 cell = floor(vec2(atan(moving.y, moving.x) * 170.0, t * 70.0));
    float glitter = step(.982, hash21(cell)) * pow(.5 + .5 * sin(uTime * 3.4 + hash21(cell + 3.0) * 50.0), 10.0);
    float alpha = (body * (.08 + .26 * smoothstep(.35, .8, swirl) + grooves * .18) + glitter * body * 1.2) * (1.0 - uVeil * .55);
    if (alpha < .005) discard;
    gl_FragColor = vec4(colour + glitter * .8, alpha);
    ${OUTPUT}
  }
`;

/** Plasma streams: dark crimson depths, bright ridged filaments and a white-hot inner rim. */
export const infernoFragment = `
  uniform float uTime;
  varying vec2 vPlane;
  ${NOISE}
  float ridge(vec2 p) { return pow(1.0 - abs(2.0 * noise21(p) - 1.0), 3.0); }
  void main() {
    float r = length(vPlane);
    float t = ${across(RING_SPANS.inferno)};
    float body = smoothstep(0.0, .1, t) * (1.0 - smoothstep(.55, 1.0, t));
    vec2 moving = spin(vPlane, -uTime * .2 / pow(r, 1.5));
    vec2 q = moving * 2.3;
    float warp = fbm(q + uTime * .08);
    float gas = fbm(q * 1.5 + warp * 1.8 - uTime * .15);
    float filaments = ridge(q * 2.6 + warp * 2.4 - uTime * .3) * .7 + ridge(q * 5.3 - warp * 1.5 + uTime * .2) * .35;
    float heat = body * (gas * .65 + filaments * .75) - .22;
    float rim = exp(-pow((t - .07) * 34.0, 2.0)) * (.55 + .45 * gas);
    vec3 colour = mix(vec3(.3, .015, .0), vec3(.95, .1, .01), smoothstep(.0, .3, heat));
    colour = mix(colour, vec3(1.5, .5, .06), smoothstep(.3, .6, heat));
    colour = mix(colour, vec3(1.75, 1.4, .8), smoothstep(.62, .9, heat));
    colour += vec3(1.6, 1.25, .8) * rim;
    float alpha = smoothstep(-.05, .32, heat) * .92 + rim * .8;
    if (alpha < .01) discard;
    gl_FragColor = vec4(colour, min(alpha, 1.0));
    ${OUTPUT}
  }
`;

/** A miniature spiral galaxy: two winding arms with thin dust lanes, pink star-forming knots, a warm core. */
export const nebulaFragment = `
  uniform float uTime;
  uniform float uVeil;
  varying vec2 vPlane;
  ${NOISE}
  void main() {
    float r = length(vPlane);
    float t = ${across(RING_SPANS.nebula)};
    float body = smoothstep(0.0, .14, t) * (1.0 - smoothstep(.42, 1.0, t));
    float angle = atan(vPlane.y, vPlane.x);
    float phase = 2.0 * (angle + log(r) * 2.8 - uTime * .04 + uVeil * 1.3);
    float arms = pow(.5 + .5 * cos(phase), 3.0);
    float lanes = pow(.5 + .5 * cos(phase - .75), 26.0);
    vec2 moving = spin(vPlane, -uTime * .03);
    float gas = fbm(moving * 2.2 + arms * .6);
    // Round star-forming knots strung along the arms (one candidate per cell, most cells empty).
    vec2 knotAt = moving * 13.0, knotCell = floor(knotAt);
    vec2 knotCentre = vec2(hash21(knotCell), hash21(knotCell + 5.0)) * .6 + .2;
    float knotDistance = length(fract(knotAt) - knotCentre);
    float knots = step(.74, hash21(knotCell + 9.0)) * smoothstep(.24, .0, knotDistance) * arms;
    float knotCore = knots * smoothstep(.08, .0, knotDistance);
    float core = exp(-t * 7.0) * body;
    float density = body * (gas * .45 + arms * .8) * (1.0 - lanes * .6);
    vec3 colour = mix(vec3(.42, .2, 1.1), vec3(1.3, .32, .95), smoothstep(.2, .8, arms + gas * .3));
    colour = mix(colour, vec3(.3, .9, 1.05), smoothstep(.5, 1.0, t) * .45);
    colour += vec3(1.45, .42, 1.0) * knots + vec3(1.2) * knotCore + vec3(1.3, .95, .75) * core;
    vec2 cell = floor(moving * 52.0);
    float star = step(.992, hash21(cell)) * (.4 + .6 * hash21(cell + 2.0)) * (.65 + .35 * sin(uTime * 2.0 + hash21(cell + 1.0) * 30.0));
    float alpha = (clamp(density * .82 + knots * .45 * body + core * .5, 0.0, .95) + star * body * 1.1) * (1.0 - uVeil * .5);
    if (alpha < .006) discard;
    gl_FragColor = vec4(colour + star * 1.2, alpha);
    ${OUTPUT}
  }
`;

/** Crystal shards: icy facets with thin-film iridescence on the grazing edges. */
export const shardVertex = `
  attribute float aHue;
  varying float vHue;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vHue = aHue;
    vec4 placed = instanceMatrix * vec4(position, 1.0);
    vec4 view = modelViewMatrix * placed;
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vView = normalize(-view.xyz);
    gl_Position = projectionMatrix * view;
  }
`;
export const shardFragment = `
  uniform float uTime;
  varying float vHue;
  varying vec3 vNormal;
  varying vec3 vView;
  ${NOISE}
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float edge = pow(1.0 - facing, 1.3);
    vec3 film = spectrum(edge * 1.6 + vHue + uTime * .05);
    float flash = pow(max(0.0, sin(uTime * 1.3 + vHue * 47.0)), 30.0);
    // Dark glass bodies, so the thin-film colour on their edges is what the eye catches.
    vec3 colour = vec3(.06, .14, .26) * (.5 + .5 * facing) + film * (.12 + edge * 1.9) + vec3(.5, .7, 1.0) * pow(facing, 24.0) * .9 + vec3(1.4) * flash;
    gl_FragColor = vec4(colour, 1.0);
    ${OUTPUT}
  }
`;

/** Solar prominences: half-torus arcs that rise and fall over the inferno belt. */
export const prominenceVertex = `
  attribute float aPhase;
  varying float vPhase;
  varying float vFacing;
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vPhase = aPhase;
    vec3 p = position;
    p.y *= .55 + .45 * sin(uTime * .55 + aPhase * 6.0);
    vec4 view = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vFacing = abs(dot(normalize(normalMatrix * mat3(instanceMatrix) * normal), normalize(-view.xyz)));
    gl_Position = projectionMatrix * view;
  }
`;
export const prominenceFragment = `
  uniform float uTime;
  varying float vPhase;
  varying float vFacing;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float feet = smoothstep(0.0, .1, vUv.x) * (1.0 - smoothstep(.9, 1.0, vUv.x));
    float flow = noise21(vec2(vUv.x * 9.0 - uTime * 1.4, vUv.y * 3.0 + vPhase * 10.0));
    float core = pow(vFacing, 1.6);
    float heat = feet * core * (.5 + .7 * flow) * (.75 + .25 * sin(uTime * .55 + vPhase * 6.0));
    vec3 colour = mix(vec3(1.1, .16, .02), vec3(1.6, .62, .08), smoothstep(.2, .55, heat));
    colour = mix(colour, vec3(1.75, 1.35, .75), smoothstep(.6, .95, heat));
    float alpha = smoothstep(.05, .5, heat) * .85;
    if (alpha < .01) discard;
    gl_FragColor = vec4(colour, alpha);
    ${OUTPUT}
  }
`;

/** Shared by the new drives: the plume tube from `cosmeticPlume.ts`, instanced per formation. */
export const plumeVertex = `
  attribute float aEnvelope;
  varying float vEnvelope;
  varying vec2 vUv;
  varying vec4 vBolts;
  varying vec4 vForks;
  uniform float uTime;
  uniform float uStyle;
  ${NOISE}
  void main() {
    vUv = uv;
    vEnvelope = aEnvelope;
    vec3 p = position;
    float travel = uv.y;
    p.xy *= 1.0 + sin(travel * 20.0 - uTime * 7.0 + uv.x * TAU) * .05 * sin(travel * PI);
    vBolts = vec4(0.0);
    vForks = vec4(0.0);
    if (uStyle > 39.5) {
      // Tempest: the envelope crackles and four bolts (plus forks) re-seed a dozen times a second.
      // Each bolt's angle is evaluated once per ring of the tube, so it renders as a jagged
      // polyline between rings: the look of lightning, at vertex rather than pixel cost.
      float tick = floor(uTime * 12.0);
      p.xy *= 1.0 + (hash21(vec2(floor(travel * 10.0), tick)) - .5) * .32 * travel;
      for (int k = 0; k < 4; k++) {
        float seed = tick + float(k) * 17.0;
        float base = float(k) * TAU / 4.0;
        vBolts[k] = base + (noise21(vec2(travel * 6.0, seed)) - .5) * 2.4 + (hash21(vec2(travel * 31.0, seed)) - .5) * .5;
        vForks[k] = base + .5 + (noise21(vec2(travel * 6.0, seed + 31.0)) - .5) * 2.4;
      }
    }
    vec4 transformed = vec4(p, 1.0);
    #ifdef USE_INSTANCING
      transformed = instanceMatrix * transformed;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * transformed;
  }
`;

/** Forked lightning that crawls over a deep-blue plasma sheath around a thin cyan-white core. */
export const tempestFragment = `
  varying float vEnvelope;
  varying vec2 vUv;
  varying vec4 vBolts;
  varying vec4 vForks;
  uniform float uTime;
  ${NOISE}
  float arc(float around, float path, float width) {
    float d = abs(mod(around - path + PI, TAU) - PI);
    return smoothstep(width, 0.0, d) + .45 * exp(-d * 5.0);
  }
  void main() {
    float along = vUv.y;
    float tick = floor(uTime * 12.0);
    vec3 colour;
    float alpha;
    if (vUv.x > 1.5) {
      float flicker = .8 + .2 * hash21(vec2(tick, 3.0));
      colour = mix(vec3(.55, .9, 1.8), vec3(1.6, 1.7, 1.8), exp(-along * 9.0));
      alpha = vEnvelope * flicker * exp(-along * 3.5);
    } else {
      float around = vUv.x * TAU;
      float width = .09 * (1.0 - along * .5);
      float forkSpan = smoothstep(.15, .3, along) * (1.0 - smoothstep(.35, .6, along));
      float bolts = 0.0;
      for (int k = 0; k < 4; k++) {
        float alive = step(.25, hash21(vec2(tick + float(k) * 17.0, 9.0)));
        bolts += alive * (arc(around, vBolts[k], width) + arc(around, vForks[k], width * .6) * forkSpan * .8);
      }
      bolts *= 1.0 - smoothstep(.5, .95, along);
      float sheath = .06 + .08 * noise21(vec2(around * 1.2, along * 5.0 - uTime * 4.0));
      colour = mix(vec3(.1, .22, 1.05), vec3(.75, .95, 1.8), clamp(bolts, 0.0, 1.0));
      colour = mix(colour, vec3(1.4, 1.6, 1.8), exp(-along * 9.0) * .5);
      alpha = (sheath + bolts * 1.25) * vEnvelope;
    }
    if (alpha < .005) discard;
    gl_FragColor = vec4(colour, min(alpha, 1.0));
    ${OUTPUT}
  }
`;

/** White light that splits into travelling spectral bands, warp rings and glitter. */
export const prismPlumeFragment = `
  varying float vEnvelope;
  varying vec2 vUv;
  uniform float uTime;
  ${NOISE}
  void main() {
    float along = vUv.y;
    vec3 colour;
    float alpha;
    if (vUv.x > 1.5) {
      colour = vec3(1.65, 1.6, 1.55);
      alpha = vEnvelope * exp(-along * 5.0);
    } else {
      float around = vUv.x * TAU;
      float disperse = smoothstep(.04, .5, along);
      vec3 bands = spectrum(along * 1.7 - uTime * .8) * 1.4;
      float rings = pow(.5 + .5 * sin(along * 32.0 - uTime * 10.0), 12.0) * smoothstep(.04, .22, along);
      float silk = .5 + .5 * sin(around * 4.0 + along * 10.0 - uTime * 2.2);
      vec2 cell = floor(vec2(vUv.x * 40.0, along * 46.0 - uTime * 8.0));
      float glitter = step(.97, hash21(cell)) * smoothstep(.1, .3, along);
      colour = mix(vec3(1.45, 1.42, 1.5), bands, disperse) + vec3(1.3) * rings * .5 + vec3(1.2) * glitter;
      alpha = ((.14 + .3 * silk * disperse + rings * .55) * vEnvelope + glitter * .6) * (1.0 - smoothstep(.55, .95, along));
    }
    if (alpha < .005) discard;
    gl_FragColor = vec4(colour, min(alpha, 1.0));
    ${OUTPUT}
  }
`;

/**
 * Standards whose cloth outline is authored in the artwork (transparent outside it).
 * Paid standards add a gilded sheen: light sweeping across bright metal thread and the
 * crests of the folds. Included standards keep plain cloth.
 */
export const bannerVertex = `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 p = position;
    float freeEdge = pow(uv.x, 1.2);
    p.z += (sin(uv.x * 9.0 - uTime * 2.4 + uv.y * 2.0) * .10
      + sin(uv.x * 17.0 - uTime * 3.1 + uv.y * 4.0) * .035) * freeEdge;
    p.y += sin(uv.x * 6.0 - uTime * 1.4) * .035 * freeEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
export const bannerFragment = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSheen;
  uniform sampler2D uBanner;
  void main() {
    vec4 art = texture2D(uBanner, vUv);
    if (art.a < .5) discard;
    vec3 ink = pow(art.rgb, vec3(2.2));
    float wave = sin(vUv.x * 9.0 - uTime * 2.4 + vUv.y * 2.0);
    vec3 colour = ink * (.78 + .22 * wave);
    if (uSheen > .5) {
      float thread = smoothstep(.5, .88, dot(art.rgb, vec3(.299, .587, .114)));
      float sweep = fract(uTime * .11 + .241) * 2.6 - .8;
      float across = vUv.x * .85 + (1.0 - vUv.y) * .45;
      float glint = exp(-pow((across - sweep) * 8.0, 2.0));
      float crest = pow(.5 + .5 * wave, 6.0);
      colour += ink * thread * (glint * 1.5 + crest * .22);
    }
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
