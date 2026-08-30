import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW, toWorld, type SensorSphere } from '@astera/rules';

/**
 * THE CIRCLES A COMMANDER OWNS, DRAWN WHERE THE GALAXY ACTUALLY IS. D126.
 *
 * D124 recorded the principle — a rule the player cannot see is not a rule — and
 * then a run of rejected attempts at satisfying it. This file is what survived,
 * and the reasoning behind the shape matters more than the shape:
 *
 *   1. FOG over everything out of reach. Correct, and it turned the galaxy grey.
 *      Rejected: "kimse oynamaz bunu ya." Beautiful is a requirement.
 *   2. A WIREFRAME SPHERE. Read as a 3D modelling tool — hard blue lines crossing
 *      the sky, pulling the eye onto geometry instead of onto worlds.
 *   3. A GLASS SHELL. The best looking of the three from outside, and it fails
 *      where it matters most: THE CAMERA IS ALMOST ALWAYS INSIDE IT. Play happens
 *      orbiting your own world, and from inside a shell every surface faces you
 *      squarely — fresnel goes to nothing, a constant floor becomes a wash over
 *      the whole lens, and the boundary is exactly as invisible as it was before.
 *
 * THE SURFACE MUST FOLLOW THE SERVER'S GEOMETRY. Game space currently has equal
 * scale on all three axes, so a server sphere is a rendered sphere too. The scale
 * still uses the shared transform: if presentation ever changes, this boundary
 * must remain the exact image of the server rule rather than a visual guess.
 *
 * THE TELESCOPE GETS A GLASS SHELL.
 *
 * The shell was tried alone first and failed for one reason: the camera is almost
 * always INSIDE it, and from inside every surface faces you squarely, so the
 * boundary vanished exactly when it was needed. It is back because it no longer
 * has to carry that job. `SensorFocus` states the boundary in a way that works
 * from anywhere — sharp and coloured inside, soft and drained outside — and the
 * shell is free to do the thing it was always good at, which is being a beautiful
 * silhouette from outside.
 *
 * MEANING AND IDENTITY, SPLIT. One says where the limit is; the other says what
 * kind of thing the limit is. Neither could do both.
 *
 * A FLAT CIRCLE ON THE PLANE WAS TRIED IN BETWEEN AND DROPPED. It was honest and
 * cheap, and with the focus pass beside it the ring won the frame: a bright
 * ellipse pulling the eye off the worlds it was describing. Two statements of one
 * fact, and the louder one was the less useful.
 *
 * THE RADAR IS ONE SPHERE AND ONE DISC, AND IT USED TO BE TWO SPHERES. Owner
 * instruction: *"biri gezegen'e yakın biri uzak — yakın olanı sil, dış küre
 * kalsın"*. Two concentric translucent shells around one world read as a single
 * smudged object rather than as two facts, and the inner one was the smaller and
 * therefore the denser of the two.
 *
 *   · RADAR DETECTION / WARNING — provisionally one merged reach. The remaining
 *     shell and the sweep end at the same boundary; splitting D126's clockless and
 *     timed ladders later is a rules-table change, not a second visual opinion.
 *   · RADAR BROADCAST — three wavefronts leave the active world every 12.5 seconds
 *     and dissolve at the wide sense edge. It visualises the instrument's reach,
 *     never an arrival clock.
 *
 * Every green alpha in the file is scaled by `RADAR_VISIBILITY`. Only the active
 * world's Radar is drawn, keeping the effect bounded instead of multiplying
 * transparent full-screen passes across every controlled world.
 */

/**
 * ONE WORLD'S TWO CIRCLES, AS THE DISC DRAWS THEM.
 *
 * It IS a `SensorSphere` — the same shape the server filters with and the crossing
 * solver reads — plus the one presentational fact the model has no opinion about:
 * whether the inner circle is a bought instrument or the free naked eye, which
 * decides its colour and nothing else.
 */
export interface ReachRing extends SensorSphere {
  /** Which of the caller's own worlds these eyes are. Absent on an older server. */
  planetId?: string;
  /** True for a working Telescope; false is the free naked-eye neighbourhood. */
  telescope: boolean;
}

/** Cold instrument white. Never the Aegis blue, never the orange of flight intent. */
const TELESCOPE_COLOUR = '#8fd0ff';
/** Neutral light for the unaided neighbourhood; it must not impersonate hardware. */
export const NAKED_EYE_COLOUR = '#c8ced3';
export const sensorShellColour = (telescope: boolean): string =>
  telescope ? TELESCOPE_COLOUR : NAKED_EYE_COLOUR;
/** Military sensor green: distinct from flight intent, Telescope blue and threat red. */
export const RADAR_COLOUR = '#69e59a';

/**
 * WHERE THE SHADER CLOCK TURNS OVER.
 *
 * Large enough that nothing periodic in it is visibly repeating, small enough that
 * `sin()` keeps its precision for ever. An unwrapped clock is a slow-motion fuse:
 * it works perfectly for the length of any test and fails after a long session.
 */
const CLOCK_WRAP = 1000;

/** Owner-tuned visibility: less glass, and substantially quieter construction lines. */
export const TELESCOPE_GLASS_OPACITY = 0.375;
export const TELESCOPE_GRID_OPACITY = 0.15;

/**
 * EVERY GREEN THING THE RADAR DRAWS, AT THE SAME FRACTION. Owner instruction:
 * *"tarama çemberindeki ve küredeki görselin hepsini oranlı bir şekilde → %70 daha
 * saydam yap"*.
 *
 * ONE CONSTANT RATHER THAN EIGHT EDITED NUMBERS, and that is the point of it. The
 * shell rim, its graticule, the broadcast wavefronts and the sweep disc are four
 * effects with eight tuned alphas between them, and the relationships BETWEEN
 * those alphas are what makes the instrument read as one object: the wide volume
 * is deliberately fainter than the tight one, the beam is deliberately brighter
 * than its trail. Scaling every one of them by the same fraction keeps all of
 * that intact, which "0.7 more transparent" asks for and eight hand-edited values
 * would quietly destroy.
 */
export const RADAR_VISIBILITY = 0.3;

/** One three-wave broadcast every 12.5 seconds: inside the requested 10–15 second rhythm. */
export const RADAR_BURST_INTERVAL_SECONDS = 12.5;
export const RADAR_BURST_WAVE_SECONDS = 3.2;
export const RADAR_BURST_STAGGER_SECONDS = 0.55;
export const RADAR_BURST_WAVES = 3;
/** One deliberate sweep: fast enough to feel live, slow enough to read its reach. */
export const RADAR_SWEEP_SECONDS = 7.5;
/**
 * THE SWEPT AREA AND ITS LEADING EDGE ARE PRICED SEPARATELY, and they have to be.
 *
 * These were one budget, and one budget is what produced the owner's next report:
 * *"yeşil tarama alanı çok parlak, bu alanın da saydamlığı yarı yarıya düşmeli"*.
 * Raising the moving part enough for it to read as a real radar also inflated the
 * WEDGE behind the head, and the wedge is most of a quadrant — so the fix for an
 * invisible beam turned into a solid green triangle laid over a quarter of the
 * galaxy.
 *
 * They are different objects doing different jobs. The HEAD is a thin bar and says
 * where the beam is right now; the AREA is the decaying trail behind it, and its
 * job is only to say which way the head is going.
 *
 * BOTH FIGURES ARE THE OWNER'S, SET AT THE SCREEN. They were split apart, the
 * trail was halved, and then the pair was taken down together by about an order of
 * magnitude — each step from a report with the disc in front of them, the last one
 * with a screenshot in which the wedge was the brightest thing drawn. Nothing here
 * derives them, and nothing should: they are a judgement about how loud an
 * instrument may be over the worlds it is laid across, and that judgement is made
 * by looking, not by arithmetic.
 *
 * WHAT THEY TRADE, STATED RATHER THAN DISCOVERED LATER. The head is now dimmer
 * than the static graphics budget (`RADAR_VISIBILITY`), which reverses the split
 * these two constants were introduced to make: the point of pricing them apart was
 * that the moving part keeps its weight while the rings and crosshair recede,
 * because dimming them together is what produced the earlier report that the sweep
 * *"hâlâ gerçek bir radar gibi dönmüyor"*. The ratio between head and trail is
 * intact at about five to one, so the beam still reads as a beam against its own
 * trail — it is the whole instrument that is quieter, not the balance inside it.
 *
 * If the sweep stops reading as something that turns, this is the pair to raise,
 * and the head is the half to raise first. `test/sensor-rings.test.ts` holds the
 * shape rather than the figures for exactly that reason — raising the head is a
 * move the tests are built to allow.
 */
export const RADAR_SWEEP_AREA_ALPHA = 0.012;
export const RADAR_SWEEP_HEAD_ALPHA = 0.06;
export function radarSweepAngle(elapsedSeconds: number): number {
  const phase = ((elapsedSeconds % RADAR_SWEEP_SECONDS) + RADAR_SWEEP_SECONDS)
    % RADAR_SWEEP_SECONDS;
  return (phase / RADAR_SWEEP_SECONDS) * Math.PI * 2;
}

/**
 * EVERY WORLD THAT HAS A RADAR, AND IT USED TO BE THE ACTIVE ONE ALONE.
 *
 * The old rule — "three circles per world across four worlds is a diagram, not a
 * galaxy" — was answering a question nobody asked once the switch became global:
 * a player who presses the radar off means off, and one who presses it on wants to
 * see what their radar covers. Which is all of it.
 *
 * A WORLD WITH NO RADAR CONTRIBUTES NOTHING rather than a zero-radius mesh, so the
 * cost is paid only by commanders who bought the instrument — and a naked-eye
 * world never draws a green circle it does not own.
 *
 * Pure, and exported for that reason: this is the whole of "which worlds draw a
 * radar", and a renderer is the wrong place to have to prove it.
 */
export function radarPosts(
  posts: readonly ReachRing[],
): { key: string; centre: THREE.Vector3; radius: number }[] {
  return posts
    .filter((post) => post.detect > 0)
    .map((post) => {
      const world = toWorld(post.at);
      return {
        key: post.planetId ?? `radar:${String(world[0])}:${String(world[2])}`,
        centre: new THREE.Vector3(world[0], world[1], world[2]),
        /*
          THE DISC REACHES THE SHELL. Owner report: *"dış küre kocaman ama
          içerideki yatay tarama çemberi küçücük — çember dış küreye kadar
          ulaşmalı"*. The sweep and the shell are one instrument stating one reach,
          so they share a radius.
        */
        radius: post.detect / VIEW.scale,
      };
    });
}

export interface RadarWaveState {
  scale: number;
  opacity: number;
}

/** Pure timing projection shared by the animation and its boundary tests. */
export function radarWaveState(
  phaseSeconds: number,
  wave: number,
  radius: number,
): RadarWaveState {
  const local = phaseSeconds - wave * RADAR_BURST_STAGGER_SECONDS;
  if (local < 0 || local >= RADAR_BURST_WAVE_SECONDS) {
    return { scale: 0.001, opacity: 0 };
  }
  const progress = local / RADAR_BURST_WAVE_SECONDS;
  // Ease the wave out from behind the planet, then let it dissolve at the edge.
  const fadeIn = Math.min(1, progress * 10);
  return {
    scale: Math.max(0.001, radius * progress),
    opacity: fadeIn * Math.pow(1 - progress, 1.35),
  };
}

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  /** The surface point in the sphere's OWN space, so the shimmer turns with it. */
  varying vec3 vLocal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vLocal = position;
    gl_Position = projectionMatrix * mv;
  }
`;

/** A cheap static shell for the active world's current Radar volume. */
export const RADAR_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  uniform vec3 uColour;
  uniform float uRim;
  uniform float uGrid;
  uniform float uAlpha;

  void main() {
    vec3 p = normalize(vLocal);
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 3.0) * uRim;

    // Sparse navigation arcs give an inside camera parallax without turning the
    // volume into the hard modelling-tool wireframe rejected in D124.
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    float latPhase = lat / 0.7853981634;
    float lonPhase = lon / 0.7853981634;
    float latEdge = abs(fract(latPhase + 0.5) - 0.5) / max(fwidth(latPhase), 1e-5);
    float lonEdge = abs(fract(lonPhase + 0.5) - 0.5) / max(fwidth(lonPhase), 1e-5);
    float polar = smoothstep(0.995, 0.9, abs(p.y));
    float grid = max(
      1.0 - smoothstep(0.0, 1.15, latEdge),
      (1.0 - smoothstep(0.0, 1.15, lonEdge)) * polar
    ) * uGrid;

    float alpha = (rim + grid) * uAlpha;
    // Negated, so a NaN is discarded rather than written: every comparison
    // against NaN is false, so the plain form waves through the one value it
    // exists to catch. See RADAR_SWEEP_FRAGMENT for the failure it produced.
    if (!(alpha > 0.001)) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

/** Exact rendered image of a radius measured in authoritative game space. */
export const sensorVolumeScale = (radius: number): [number, number, number] => [
  radius,
  radius * VIEW.verticalExaggeration,
  radius,
];

export const SHELL_FRAGMENT = /* glsl */ `
  /**
   * HIGHP, AND IT IS NOT A PREFERENCE. D126.
   *
   * These shaders feed a clock into sin(). At mediump — roughly ten bits of
   * mantissa — a clock that has been running for a few thousand seconds loses all
   * fractional precision, sin() of it can overflow to infinity, and fract(inf)
   * is NaN. NaN through additive blending on a half-float target renders as SOLID
   * BLACK TILES, which is exactly what appeared: black rectangles that showed up
   * only when the spheres were on screen, because that is the only time this code
   * runs. The clock is also wrapped below, so both halves of the failure are shut.
   */
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  uniform vec3 uColour;
  uniform float uTime;
  uniform float uFalloff;
  uniform float uStrength;
  uniform float uBody;
  uniform float uGrid;

  /** Three parallels and four meridians. Sparse enough to read as navigation. */
  const float LAT_STEP = 0.7853981634;
  const float LON_STEP = 0.7853981634;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), u.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }

  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, uFalloff);

    // A small floor so the far wall stays faintly lit from inside; the rim is what
    // gives the bubble its edge from outside.
    float glass = uBody + rim * uStrength;

    /**
     * The energy, which is what stops it reading as frosted plastic. Two slow noise
     * fields crossing on the sphere's own surface, plus soft latitude bands — not
     * lines, a sine has no edge, but enough regularity that the surface reads as
     * ENGINEERED rather than as weather.
     */
    vec3 p = normalize(vLocal);
    float cells =
      noise(p * 3.1 + vec3(uTime * 0.30, uTime * -0.19, uTime * 0.16)) * 0.62 +
      noise(p * 7.4 + vec3(uTime * -0.22, uTime * 0.27, uTime * -0.13)) * 0.38;
    float shimmer = 0.42 + 1.05 * smoothstep(0.46, 0.78, cells);

    /**
     * A SPARSE GRATICULE, AND IT IS WHAT MAKES THE SHELL READABLE FROM INSIDE.
     *
     * A smooth shell has no features, so from inside there is nothing for the eye
     * to fix on and the boundary reads as a tint over the lens rather than as a
     * surface at a distance. Lines fix that with parallax: they slide as the camera
     * moves, and sliding is how you perceive that something is out there and how
     * far.
     *
     * SPARSE AND SOFT, WHICH IS THE WHOLE DIFFERENCE FROM THE WIREFRAME THAT WAS
     * REJECTED. That one was eighteen by nine segments of hard bright line and
     * read as a 3D modelling tool. Four meridians and three parallels read as a
     * navigational grid, which is what a sensor boundary actually is.
     *
     * Widths come from fwidth(), so a line is the same thickness on screen wherever
     * it is on the sphere and however close the camera gets — the alternative is a
     * constant world width that aliases into a shimmering mess at distance.
     */
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    float latPhase = lat / LAT_STEP;
    float lonPhase = lon / LON_STEP;
    float latEdge = abs(fract(latPhase + 0.5) - 0.5) / max(fwidth(latPhase), 1e-5);
    float lonEdge = abs(fract(lonPhase + 0.5) - 0.5) / max(fwidth(lonPhase), 1e-5);
    // The poles are where every meridian converges; fade them out or the top of
    // the sphere becomes a bright knot.
    float polar = smoothstep(0.995, 0.9, abs(p.y));
    float grid = max(
      1.0 - smoothstep(0.0, 1.4, latEdge),
      (1.0 - smoothstep(0.0, 1.4, lonEdge)) * polar
    );

    float breath = 0.9 + 0.1 * sin(uTime * 0.7);
    // The grid rides on the same glass, so it fades with the shell rather than
    // floating in front of it as a separate object.
    float alpha = (glass * shimmer + grid * uGrid) * breath;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

/** The glass bubble at a world's telescope reach. Identity, not information. */
function ReachShell({
  centre,
  radius,
  telescope,
}: {
  centre: THREE.Vector3;
  radius: number;
  telescope: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColour: { value: new THREE.Color(sensorShellColour(telescope)) },
      uTime: { value: Math.random() * CLOCK_WRAP },
      /**
       * BARELY VISIBLE, ON THE OWNER'S INSTRUCTION, AND IT IS THE RIGHT CALL.
       *
       * The shell no longer carries any information — `resolved` does that, on the
       * worlds themselves. What is left for it to do is say what KIND of thing the
       * boundary is, and a suggestion does that as well as a statement while
       * leaving the galaxy to be the subject. Every value here is roughly a third
       * of what it was when the shell was still trying to be the whole answer.
       */
      uFalloff: { value: 3.4 },
      uStrength: { value: 0.042 * TELESCOPE_GLASS_OPACITY },
      /** The head-on floor. Near zero: the interior must read as untouched. */
      uBody: { value: 0.002 * TELESCOPE_GLASS_OPACITY },
      /**
       * The graticule, at a whisper. It only has to give the eye something to fix
       * on as the camera moves — parallax is what makes the shell read as a
       * surface at a distance, and parallax works at any brightness.
       */
      uGrid: { value: 0.045 * TELESCOPE_GRID_OPACITY },
    }),
    [telescope],
  );

  useFrame((_, delta) => {
    const clock = material.current?.uniforms.uTime;
    if (!clock) return;
    const value = clock.value as number;
    // WRAPPED, so the clock never grows large enough to cost `sin()` its precision.
    // The noise fields are periodic in it, so the wrap is invisible.
    clock.value = (value + delta * 0.25) % CLOCK_WRAP;
  });

  return (
    <group position={centre}>
      {/*
        ONE SIDE ONLY, AND THE SECOND ONE WAS THE BUG.
        A FrontSide pass sits BETWEEN the camera and everything inside the bubble,
        so its glass tint and shimmer wash over the player's own worlds — the exact
        complaint that ended the shell's first life: "kürenin içi net değil ki."
        The far wall alone is how a transparent bubble is drawn anyway: you look
        through empty space at the inside of the shell behind it.
      */}
      <mesh renderOrder={-40} scale={sensorVolumeScale(radius)}>
        <sphereGeometry args={[1, 48, 28]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          vertexShader={SHELL_VERTEX}
          fragmentShader={SHELL_FRAGMENT}
        />
      </mesh>
    </group>
  );
}

/** A server-accurate Radar boundary, with no per-frame work of its own. */
function RadarVolume({
  centre,
  radius,
  strength,
  grid,
  order,
}: {
  centre: THREE.Vector3;
  radius: number;
  strength: number;
  grid: number;
  order: number;
}) {
  const uniforms = useMemo(
    () => ({
      uColour: { value: new THREE.Color(RADAR_COLOUR) },
      uRim: { value: strength },
      uGrid: { value: grid },
      uAlpha: { value: 1 },
    }),
    [grid, strength],
  );

  return (
    <mesh position={centre} scale={sensorVolumeScale(radius)} renderOrder={order}>
      <sphereGeometry args={[1, 40, 24]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={SHELL_VERTEX}
        fragmentShader={RADAR_FRAGMENT}
      />
    </mesh>
  );
}

/** Three radio wavefronts broadcast from the active world to its wide Radar edge. */
function RadarBurst({ centre, radius }: { centre: THREE.Vector3; radius: number }) {
  const waves = useRef<(THREE.Mesh | null)[]>([]);
  const materials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const phase = useRef(Math.random() * RADAR_BURST_INTERVAL_SECONDS);
  // All three wavefronts share one topology. They are three draw calls, but only
  // one GPU geometry allocation — the active scene stays below its memory cap.
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 28, 16), []);
  const uniforms = useMemo(() => Array.from({ length: RADAR_BURST_WAVES }, () => ({
    uColour: { value: new THREE.Color(RADAR_COLOUR) },
    uRim: { value: 0.15 },
    uGrid: { value: 0.025 },
    // Driven per frame; `RADAR_VISIBILITY` is applied to the value written there.
    uAlpha: { value: 0 },
  })), []);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  useFrame((_, delta) => {
    phase.current = (phase.current + delta) % RADAR_BURST_INTERVAL_SECONDS;
    for (let index = 0; index < RADAR_BURST_WAVES; index += 1) {
      const mesh = waves.current[index];
      const opacity = materials.current[index]?.uniforms.uAlpha;
      if (!mesh || !opacity) continue;
      const state = radarWaveState(phase.current, index, radius);
      mesh.scale.set(
        state.scale,
        state.scale * VIEW.verticalExaggeration,
        state.scale,
      );
      opacity.value = state.opacity * RADAR_VISIBILITY;
    }
  });

  return (
    <group position={centre}>
      {uniforms.map((waveUniforms, index) => (
        <mesh
          key={index}
          ref={(node) => { waves.current[index] = node; }}
          renderOrder={-36 + index}
          geometry={geometry}
        >
          <shaderMaterial
            ref={(node) => { materials.current[index] = node; }}
            uniforms={waveUniforms}
            transparent
            side={THREE.BackSide}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            vertexShader={SHELL_VERTEX}
            fragmentShader={RADAR_FRAGMENT}
          />
        </mesh>
      ))}
    </group>
  );
}

const RADAR_SWEEP_VERTEX = /* glsl */ `
  varying vec2 vPoint;
  void main() {
    vPoint = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const RADAR_SWEEP_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vPoint;
  uniform vec3 uColour;
  uniform float uAngle;
  /** The STATIC graphics: range rings, crosshair, the ambient wash. */
  uniform float uAlpha;
  /** The thin leading bar: where the beam IS. */
  uniform float uHead;
  /** The decaying wedge behind it: which way the head is going, and no more. */
  uniform float uArea;
  const float TAU = 6.28318530718;

  void main() {
    float radius = length(vPoint);
    /*
      THE CENTRE IS CUT BEFORE ANY ANGLE IS TAKEN, and that ordering is the point.
      atan(0.0, 0.0) is undefined, and the hub of a PPI disc is exactly where
      both components reach zero — so the angle was being computed at the one
      point it cannot be, and the NaN then rode all the way to gl_FragColor.
      The hub was already being faded out further down; fading a NaN does nothing.
    */
    if (radius > 1.0 || radius < 0.03) discard;

    float angle = atan(vPoint.y, vPoint.x);
    float trail = mod(uAngle - angle + TAU, TAU);
    /*
      A REAL PPI DISPLAY IS A HARD LEADING EDGE WITH A LONG DECAY BEHIND IT, and
      that decay is what the eye reads as direction and speed. The trail was a
      linear ramp over 47° and the head a 2° line; against the range rings behind
      them neither one was a moving object, which is what "hâlâ gerçek bir radar
      gibi dönmüyor" is describing. The wedge is now most of a quadrant and falls
      off as a power curve — bright at the head, still visibly present a long way
      behind it — and the head itself is a wider, brighter bar.
    */
    float sweep = 1.0 - smoothstep(0.0, 1.55, trail);
    float sector = pow(sweep, 2.2);
    float beam = 1.0 - smoothstep(0.0, 0.09, trail);

    /*
      EVERY DERIVATIVE HAS A FLOOR, AND LEAVING IT OFF IS WHAT PUT BLACK TILES ON
      A REAL PHONE. Owner report: *"gerçek telefondan girdiğimde ekranda siyah
      siyah patlamalar oluyor, kare dikdörtgen alanlar gelip yok oluyor."*

      smoothstep(0.0, w, x) divides by (w - 0.0). When fwidth() returns zero —
      a quad whose derivative is flat, which happens constantly as this disc turns
      towards edge-on — that is a divide by zero, and the Inf/NaN it produces goes
      straight into the alpha. Additive blending then writes it, and a NaN written
      through a half-float target is the SOLID BLACK the owner is describing.
      Quad-shaped, because derivatives are computed per 2×2 fragment quad.

      This is the same failure D126 already recorded for the Telescope shell — and
      the fix is the same one the two shells above have carried since: a floor on
      the derivative. This shader was written after them and never got it.
    */
    float rings = 0.0;
    for (int index = 1; index <= 4; index++) {
      float ring = float(index) * 0.25;
      float width = max(fwidth(radius) * 1.5, 1e-5);
      rings = max(rings, 1.0 - smoothstep(0.0, width, abs(radius - ring)));
    }
    float crossX = 1.0 - smoothstep(0.0, max(fwidth(vPoint.x) * 1.2, 1e-5), abs(vPoint.x));
    float crossY = 1.0 - smoothstep(0.0, max(fwidth(vPoint.y) * 1.2, 1e-5), abs(vPoint.y));
    float crosshair = max(crossX, crossY) * 0.12;

    float centreCut = smoothstep(0.035, 0.085, radius);
    float edge = 1.0 - smoothstep(0.9, 1.0, radius);
    /*
      TWO BUDGETS, AND SPLITTING THEM IS THE POINT. The owner asked for the circle
      and the sphere to be 70% more transparent AND for the sweep to read as a real
      radar; one alpha could not do both, because dimming the graphics dimmed the
      beam with them until there was nothing left to notice. The static instrument
      recedes; the moving part keeps its own weight, which is what makes it the
      thing on screen that is alive.
    */
    float still = (0.012 + rings * 0.12 + crosshair) * uAlpha;
    float moving = sector * uArea + beam * uHead;
    float alpha = centreCut * edge * (still + moving);
    /*
      NEGATED, SO A NaN IS CAUGHT RATHER THAN WAVED THROUGH. Every comparison
      against NaN is false, so alpha <= 0.0005 DISCARDS NOTHING when alpha is
      NaN — the one case the test most needs to catch. !(alpha > 0.0005) is true
      for NaN and discards it. The floors above should mean no NaN ever reaches
      here; this is the backstop for the driver that disagrees.
    */
    if (!(alpha > 0.0005)) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

/**
 * A RADIUS-ACCURATE MILITARY SWEEP ON THE CURRENT MERGED CIRCLE. Owner report:
 * *"radarın tarama animasyonu çalışmıyor, o yeşil tarama çizgisi gezegen etrafında
 * dönmüyor"*.
 *
 * It was turning the whole time. It was drawn at the SENSE radius — nineteen
 * hundred game units, most of the disc — so the beam's angular travel near the
 * planet was a few pixels a second and the only part of it actually moving was
 * out at a rim mostly off screen. A sweep you cannot see turn is a still image.
 *
 * The current rules temporarily merge detection and warning reach, so the sweep
 * and shell intentionally share one radius. Keeping that radius in the payload
 * means the future D126 split can be restored without inventing geometry here.
 */
function RadarSweep({ centre, radius }: { centre: THREE.Vector3; radius: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const angle = useRef(Math.random() * Math.PI * 2);
  const uniforms = useMemo(() => ({
    uColour: { value: new THREE.Color(RADAR_COLOUR) },
    uAngle: { value: angle.current },
    uAlpha: { value: RADAR_VISIBILITY },
    /*
      The head keeps most of its weight while the graticule behind it drops to
      three tenths — dimming both together is what left nothing to notice. The
      trail is priced separately and at half, because raising the two as one is
      what turned the sweep into a solid wedge over a quarter of the galaxy.
    */
    uHead: { value: RADAR_SWEEP_HEAD_ALPHA },
    uArea: { value: RADAR_SWEEP_AREA_ALPHA },
  }), []);

  useFrame((_, delta) => {
    const value = material.current?.uniforms.uAngle;
    if (!value) return;
    angle.current = radarSweepAngle(
      (angle.current / (Math.PI * 2)) * RADAR_SWEEP_SECONDS
      + delta,
    );
    value.value = angle.current;
  });

  return (
    <mesh
      position={[centre.x, centre.y + 0.015, centre.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[radius, radius, 1]}
      renderOrder={-37}
      raycast={() => null}
    >
      <circleGeometry args={[1, 96]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={RADAR_SWEEP_VERTEX}
        fragmentShader={RADAR_SWEEP_FRAGMENT}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Every boundary the caller owns, drawn as the exact transformed server volume.
 *
 * Telescope reach is drawn for every controlled world, because movement anywhere
 * near any of them is legible. The radar volumes belong to ONE world at a time —
 * the active one, which is also the one the player is thinking about — because
 * three circles per world across four worlds is a diagram, not a galaxy.
 */
export function SensorRings({
  posts,
  showTelescope,
  showRadar,
}: {
  /** Every world the caller controls, with the two radii each of them answers for. */
  posts: readonly ReachRing[];
  /**
   * WHETHER EACH INSTRUMENT DRAWS AT ALL. Owner instruction, one flag each.
   *
   * They used to be a set of world ids and a boolean, which gave two adjacent
   * switches two different reaches — see `GalaxyView`. Both cover every controlled
   * world now, and both start off: hiding is an absence of DRAWING, never an
   * absence of rule. Nothing here touches what the server knows or what the fog
   * permits; an undrawn shell is the same sensor, unpainted.
   */
  showTelescope: boolean;
  showRadar: boolean;
}) {
  const shells = useMemo(
    () =>
      posts.map((post) => {
        const world = toWorld(post.at);
        return {
          key: post.planetId ?? `${String(world[0])}:${String(world[2])}`,
          centre: new THREE.Vector3(world[0], world[1], world[2]),
          radius: post.identify / VIEW.scale,
          telescope: post.telescope,
        };
      }),
    [posts],
  );

  const radars = useMemo(() => radarPosts(posts), [posts]);

  return (
    <>
      {showTelescope && shells.map((shell) => (
        <ReachShell
          key={shell.key}
          centre={shell.centre}
          radius={shell.radius}
          telescope={shell.telescope}
        />
      ))}
      {showRadar && radars.map((radar) => (
        <group key={radar.key}>
          {/* The widest and the quietest: it knows THAT, never WHEN. */}
          <RadarVolume
            centre={radar.centre}
            radius={radar.radius}
            strength={0.035 * RADAR_VISIBILITY}
            grid={0.018 * RADAR_VISIBILITY}
            order={-39}
          />
          <RadarBurst centre={radar.centre} radius={radar.radius} />
          <RadarSweep centre={radar.centre} radius={radar.radius} />
        </group>
      ))}
    </>
  );
}
