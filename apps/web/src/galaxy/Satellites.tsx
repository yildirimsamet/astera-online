import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SATELLITE_IDS, type SatelliteId } from '@blindspace/rules';
import { SATELLITE_MODEL, SATELLITE_NEON } from '../ui/assets.js';
import { softGlow } from './Environment.jsx';
import { unitModel } from './model.js';
import type { PlanetNode } from './scene.js';

/**
 * EVERY INSTRUMENT ANYONE HAS BUILT, IN ORBIT, VISIBLE TO EVERYONE.
 *
 * D15: hardware is public, readings are not. A satellite is a physical object —
 * you can see one from a distance the same way you can see that a planet is large
 * — so it is drawn for every world in the galaxy, not only your own. What is never
 * published is the LEVEL: an Aegis is visible, its shield strength is not, and
 * shield strength is what actually decides a raid.
 *
 * These are real geometry now rather than billboards. A billboard was right while
 * they were 2D renders seen at one angle; the models are ~1,200 triangles after
 * the pipeline and the camera orbits freely, which is exactly the case where a
 * flat card gives itself away.
 *
 * DRAWN AS: one instanced mesh per instrument type, so the whole galaxy's hardware
 * is five draw calls however many planets carry it.
 */

/** Bodies are drawn only this close. Past it they are noise around a dot. */
const VISIBLE_WITHIN = 34;

/**
 * A MARKER LIGHT PER SATELLITE, AND A DIFFERENT COLOUR FOR EACH. Owner decision.
 *
 * Same reasoning as the neon on a craft: a satellite is a few hundred triangles at
 * a few dozen pixels, unlit on its far side, against a nebula that is itself
 * bright — so at any real distance it is a dark speck you find by watching it move.
 * The rim is what makes it an object, and a distinct hue is what makes it a KIND of
 * object without a label.
 *
 * DELIBERATELY HALF THE DIAMETER OF A CRAFT'S. The owner's figure. A satellite is a
 * small body holding station beside a world that is hundreds of pixels across; at a
 * ship's neon size the light swamps the planet it belongs to.
 *
 * THE HUES LIVE IN `ui/assets.ts`, beside the model each one belongs to, because
 * each is the colour that body already glows in its own render. They name a piece
 * of hardware, which is public under D15 — they must never be read as a state, so
 * none of them is the alloy, crystal, threat or opportunity colour that means
 * something elsewhere in the game.
 */
const NEON = SATELLITE_NEON;

/** How big a satellite is drawn, as a share of the planet it orbits. */
export const BODY_SCALE = 0.3;

/**
 * THE MARKER LIGHT'S DIAMETER, AS A MULTIPLE OF THE SATELLITE'S OWN. Owner's figure.
 *
 * TWO, and it has to be a ratio to the BODY rather than a length, because the body
 * is itself sized off the planet — three planet sizes exist, so a fixed length is
 * right for one of them and wrong for the other two. That is exactly what went
 * wrong: the light was one size for the whole galaxy, taken from the largest world
 * carrying that satellite, so on a big planet it disappeared INSIDE the body and on
 * a small one it swamped it.
 *
 * There was a second, quieter fault stacked on it. `pointsMaterial.size` is a
 * DIAMETER in world units and `Object3D.scale` is applied to a unit-RADIUS
 * geometry, so the old figure was being compared against half of what it looked
 * like — which is why a light nominally larger than the body still vanished behind
 * it. Both sides of the ratio below are diameters.
 */
export const NEON_RATIO = 2;

/**
 * The marker light's diameter for a satellite orbiting a planet of this radius.
 *
 * Exported so the rule can be asserted rather than re-derived: the light is a
 * fixed multiple of the BODY, and the body is a fixed share of the PLANET, so a
 * single figure shared across the galaxy is wrong for every world but one.
 */
export const neonSizeFor = (planetRadius: number): number =>
  planetRadius * BODY_SCALE * 2 * NEON_RATIO;

/** The satellite's own drawn diameter, for the same reason. */
export const bodySizeFor = (planetRadius: number): number => planetRadius * BODY_SCALE * 2;

/** Seconds for a full circuit. Slow enough to read as an orbit, not a fan. */
const PERIOD = 46;

/**
 * ALL FOUR OF THEM ORBIT, AND THAT IS NOW TRUE BY CONSTRUCTION. D25.
 *
 * This used to filter a five-entry list because a Drill was on it, and a drill is a
 * craft you send to a rock and get back rather than a body holding station beside a
 * world. `SATELLITE_IDS` means only satellites now, so there is nothing to filter.
 */
const IN_ORBIT = SATELLITE_IDS;

for (const id of IN_ORBIT) useGLTF.preload(SATELLITE_MODEL[id], false);

interface Body {
  planet: PlanetNode;
  /** Where this one sits in its planet's ring, so they never overlap. */
  index: number;
  of: number;
}

export function Satellites({ nodes }: { nodes: readonly PlanetNode[] }) {
  const byType = useMemo(() => {
    const map = new Map<SatelliteId, Body[]>();
    for (const planet of nodes) {
      planet.satellites.forEach((type, index) => {
        const list = map.get(type) ?? [];
        list.push({ planet, index, of: planet.satellites.length });
        map.set(type, list);
      });
    }
    return map;
  }, [nodes]);

  return (
    <>
      {IN_ORBIT.map((type) => {
        const bodies = byType.get(type);
        if (!bodies || bodies.length === 0) return null;
        return <Ring key={type} type={type} bodies={bodies} />;
      })}
    </>
  );
}

const dummy = new THREE.Object3D();

/** Stable hash from a planet id, so a world keeps its arrangement between sessions. */
function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function Ring({ type, bodies }: { type: SatelliteId; bodies: Body[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((state) => state.camera);
  const { scene } = useGLTF(SATELLITE_MODEL[type], false);
  const glow = useMemo(() => softGlow(), []);

  /**
   * The marker lights, as one `Points` rather than a sprite each.
   *
   * A point is camera-facing for free and the whole ring is one draw call, which
   * matters: this is drawn for every world in the galaxy, not only your own, and a
   * sprite per instrument would put a few hundred objects in the scene graph to
   * say something a few hundred pixels could.
   */
  /**
   * ONE CLOUD PER PLANET SIZE, because a `Points` has one size for all its points.
   *
   * A per-vertex size needs a custom shader; the galaxy has exactly three planet
   * radii, so grouping by radius gets the same result with none of the machinery.
   * Each group is still one draw call, and there are at most three of them per
   * satellite type however many worlds carry one.
   */
  const groups = useMemo(() => {
    const byRadius = new Map<number, number[]>();
    bodies.forEach((body, i) => {
      const list = byRadius.get(body.planet.radius) ?? [];
      list.push(i);
      byRadius.set(body.planet.radius, list);
    });
    return [...byRadius.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([radius, indices]) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(Math.max(1, indices.length) * 3), 3),
        );
        return {
          radius,
          indices,
          geometry: g,
          // Both sides are diameters: the body is drawn at `BODY_SCALE` of the
          // planet's RADIUS, so its diameter is twice that.
          size: neonSizeFor(radius),
        };
      });
  }, [bodies]);

  // Normalised to unit radius. These models are quantised like the asteroids, so
  // instancing the raw geometry would size them by an arbitrary integer range
  // rather than by the number below. See `model.ts`.
  const source = useMemo(() => unitModel(scene), [scene]);

  /**
   * A fixed orbit per body: phase, radius and tilt.
   *
   * Spread by index so a planet's instruments never stack, and hashed from the
   * planet id so two worlds are never in step — a galaxy where every satellite
   * shares a phase reads as one rotating object rather than as many.
   */
  const orbits = useMemo(
    () =>
      bodies.map((body) => {
        const h = hash(body.planet.id);
        return {
          phase: (body.index / Math.max(1, body.of)) * Math.PI * 2 + ((h % 360) / 360) * Math.PI * 2,
          // Each instrument on its own shell, so they cannot intersect.
          radius: 1.5 + body.index * 0.34,
          tilt: 0.25 + ((h >> 3) % 40) / 100 + body.index * 0.12,
        };
      }),
    [bodies],
  );

  useFrame(({ clock }) => {
    const node = mesh.current;
    if (!node) return;
    const t = (clock.elapsedTime / PERIOD) * Math.PI * 2;
    let drawn = 0;

    // Which group each body's light belongs to, and how many of that group have
    // been written this frame. A body that is culled writes nothing, so the two
    // cursors advance independently.
    const written = new Map<number, number>();

    bodies.forEach((body, i) => {
      const [px, py, pz] = body.planet.position;
      // Cheap distance gate: a satellite twenty planet-widths away is a flickering
      // pixel, and fifty planets' worth of them is a haze over the whole disc.
      const far =
        (camera.position.x - px) ** 2 +
          (camera.position.y - py) ** 2 +
          (camera.position.z - pz) ** 2 >
        VISIBLE_WITHIN ** 2;
      if (far) return;

      const orbit = orbits[i]!;
      const angle = t + orbit.phase;
      const r = body.planet.radius * orbit.radius;

      dummy.position.set(
        px + Math.cos(angle) * r,
        py + Math.sin(angle) * r * orbit.tilt,
        pz + Math.sin(angle) * r,
      );
      // Facing along its own travel, so it reads as flying rather than drifting.
      dummy.rotation.set(0, -angle, orbit.tilt * 0.5);
      dummy.scale.setScalar(body.planet.radius * BODY_SCALE);
      dummy.updateMatrix();
      node.setMatrixAt(drawn, dummy.matrix);
      drawn += 1;

      // The light rides with the body it belongs to, in the cloud sized for that
      // planet's radius.
      const group = groups.find((g) => g.radius === body.planet.radius);
      if (group) {
        const at = written.get(group.radius) ?? 0;
        const attr = group.geometry.getAttribute('position') as THREE.BufferAttribute;
        attr.setXYZ(at, dummy.position.x, dummy.position.y, dummy.position.z);
        written.set(group.radius, at + 1);
      }
    });

    node.count = drawn;
    node.instanceMatrix.needsUpdate = true;

    for (const group of groups) {
      const shown = written.get(group.radius) ?? 0;
      const attr = group.geometry.getAttribute('position') as THREE.BufferAttribute;
      // Anything past the drawn bodies is parked at the origin rather than left
      // holding last frame's coordinates — the same rule the asteroid tails use.
      for (let v = shown; v < attr.count; v += 1) attr.setXYZ(v, 0, 0, 0);
      attr.needsUpdate = true;
      group.geometry.setDrawRange(0, shown);
    }
  });

  if (!source) return null;

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[source.geometry, source.material, bodies.length]}
        frustumCulled={false}
        renderOrder={2}
      />
      {groups.map((group) => (
        <points
          key={group.radius}
          geometry={group.geometry}
          frustumCulled={false}
          renderOrder={1}
        >
          <pointsMaterial
            map={glow}
            color={NEON[type]}
            size={group.size}
            sizeAttenuation
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </>
  );
}

/* ── shields ─────────────────────────────────────────────────── */

/**
 * THE AEGIS, MADE VISIBLE — and the one place D15 needs care.
 *
 * The owner asked for a shield whose look scales with its level. Levels are never
 * public (D15): an Aegis is visible, its strength is not, and strength is exactly
 * what decides whether a raid pays. Publishing it in the art would hand away for
 * free the thing a probe is sold for.
 *
 * So it splits by whose planet it is. On YOUR world the shell is graded — you know
 * your own Aegis, and watching it thicken as you raise it is the feedback the
 * ownership pillar is short of. On everyone else's it is a single uniform shell
 * that says only "this world is shielded", which is deterrence and is meant to be
 * legible.
 *
 * DELIBERATELY VERY FAINT. A shield that hides the planet inside it defeats both
 * jobs at once: you can no longer recognise the world, and a bright bubble reads
 * as a selection state rather than as armour. Two thin additive shells give a
 * limb-brightened bubble that is obvious in silhouette and nearly invisible across
 * the planet's face.
 */
/**
 * THE SHELL, AS PANELS RATHER THAN AS A BUBBLE. Owner decision.
 *
 * A plain translucent sphere read as a soap bubble — and the old palette ran from
 * cyan through teal to mint, so a well-defended world wore a green haze that
 * belonged to no other part of the game. Both are replaced:
 *
 *   · A HEXAGONAL PANEL GRID, drawn in a shader rather than in geometry. Real hex
 *     panels would be a Goldberg polyhedron — twelve pentagons and a lot of vertex
 *     bookkeeping per world — where this is one sphere and a fragment function, at
 *     any radius, for every shielded planet in the galaxy.
 *   · A COLD BLUE FAMILY that gets whiter with level, so a shield reads as energy
 *     rather than as tinted glass, and never as the amber or green that mean
 *     resources and safety elsewhere.
 *   · SMALLER AND FAINTER, both at owner request. The dome has to say "this world
 *     is armoured" from across the disc while leaving the world itself readable —
 *     it is a marker, not a wrapper.
 *
 * D15 STILL DECIDES WHAT IT SHOWS. Levels are never public: the grade is applied
 * only to your own world, and everyone else's is one uniform shell that says
 * `shielded` and nothing more. A graded dome on a stranger's planet would hand
 * over the number a probe is sold for.
 */
export const SHIELD_TIER = [
  { colour: '#3f7fd8', opacity: 0.2, scale: 1.18 },
  { colour: '#5b8fff', opacity: 0.25, scale: 1.24 },
  { colour: '#8fb4ff', opacity: 0.32, scale: 1.3 },
] as const;

export const shieldTierOf = (level: number): 0 | 1 | 2 => (level >= 5 ? 2 : level >= 3 ? 1 : 0);

/**
 * How many panels run around the equator.
 *
 * The pattern is laid out in spherical coordinates, so this also fixes the seam:
 * longitude wraps at ±pi and the grid only meets itself cleanly if a whole number
 * of cells fits the circumference. Panels crowd towards the poles, which is what
 * spherical mapping does and is invisible at this opacity on a shell that is
 * brightest at its limb.
 *
 * TEN, NOT TWENTY. A planet is fifty pixels across at the zoom the disc is usually
 * read at, so twenty panels around the equator resolved to about two pixels each
 * and blurred into a solid band — the pattern was there and unreadable, which is
 * the worst of both. Ten reads as panelling at the size it is actually seen.
 */
const PANELS_AROUND = 12;

const SHIELD_VERT = `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Panel edges, lit at the limb.
 *
 * Two things carry the read. FRESNEL puts nearly all the brightness where the
 * shell is edge-on, which is what makes a dome obvious in silhouette and almost
 * absent across the planet's face — the property the old version got from stacking
 * two spheres, done properly and in one pass. And the GRID is drawn as edges with
 * a trace of fill, so it reads as panelling rather than as a honeycomb texture.
 */
const SHIELD_FRAG = `
  precision mediump float;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uDensity;

  const vec2 S = vec2(1.0, 1.7320508);

  /** Distance from a point to the edge of its hex cell: 0 at the centre, 0.5 at the edge. */
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, S * 0.5), p.x);
  }

  /** Nearest hex centre, of the two interleaved lattices. */
  vec2 hexLocal(vec2 uv) {
    vec4 centres = floor(vec4(uv, uv - vec2(0.5, 1.0)) / S.xyxy) + 0.5;
    vec4 offs = vec4(uv - centres.xy * S, uv - (centres.zw + 0.5) * S);
    return dot(offs.xy, offs.xy) < dot(offs.zw, offs.zw) ? offs.xy : offs.zw;
  }

  void main() {
    vec3 n = normalize(vNormalW);
    float lon = atan(n.z, n.x);
    float lat = asin(clamp(n.y, -1.0, 1.0));
    vec2 uv = vec2(lon, lat) * uDensity;

    float d = hexDist(hexLocal(uv));

    // A FIXED LINE WIDTH, with fwidth used ONLY to soften it.
    //
    // The first version wrote smoothstep(0.5 - w - k, 0.5 - w, d) with w taken from
    // fwidth, which does not thin the line -- it MOVES it inward, so the lit band
    // ran from 0.5 - w - k all the way to the cell boundary. A planet is a few
    // dozen pixels on the disc and fwidth is correspondingly large there, so the
    // panels came out as opaque struts across the world's face. The whole point of
    // this shield is that a player can still read their own planet through it.
    //
    // lineHalf is in cell units, so a line is the same thickness at every zoom; the
    // max only widens it once a cell has shrunk below a pixel, which is what stops
    // the grid shimmering as the camera pulls out. It is NOT called half, which
    // is a reserved word in GLSL ES.
    float aa = fwidth(d);
    float lineHalf = max(0.018, aa * 0.8);
    float edge = smoothstep(0.5 - lineHalf - aa, 0.5 - lineHalf, d);

    float fresnel = pow(1.0 - abs(dot(n, normalize(vViewW))), 3.0);

    /**
     * EDGES EVERYWHERE, BRIGHT AT THE LIMB — and this split is the whole trick.
     *
     * A purely fresnel-weighted shell shows only a thin annulus, and a 2D pattern
     * cannot be read inside a band a few pixels tall: the hexagons were being drawn
     * and were invisible. Giving the edges a small constant term puts the panel
     * mesh across the whole dome, where it is legible, while the fresnel term keeps
     * the silhouette the bright part.
     *
     * There is NO fill term. Cell interiors are perfectly clear, which is what lets
     * the player read their own world through the shield — the thing the owner
     * asked for and the thing a tinted sphere cannot do at any opacity.
     */
    float alpha = edge * (0.13 + fresnel * 0.6) * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

export function Shields({
  nodes,
  ownLevel,
  ownId,
}: {
  nodes: readonly PlanetNode[];
  /** Your own Aegis level. Never known for anyone else. */
  ownLevel: number;
  ownId: string | undefined;
}) {
  // D25: the Aegis is on the ground, so it is no longer in the orbit list. The dome
  // is still public — `shielded` is the boolean the server publishes for it.
  const shielded = useMemo(() => nodes.filter((n) => n.shielded), [nodes]);

  return (
    <>
      {shielded.map((node) => (
        <Shell
          key={node.id}
          node={node}
          // Graded only where the level is legitimately known.
          tier={node.id === ownId ? shieldTierOf(ownLevel) : 0}
          own={node.id === ownId}
        />
      ))}
    </>
  );
}

function Shell({ node, tier, own }: { node: PlanetNode; tier: 0 | 1 | 2; own: boolean }) {
  const group = useRef<THREE.Group>(null);
  const style = SHIELD_TIER[tier];
  const radius = node.radius * style.scale;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHIELD_VERT,
        fragmentShader: SHIELD_FRAG,
        uniforms: {
          uColour: { value: new THREE.Color(style.colour) },
          uOpacity: { value: style.opacity * (own ? 1 : 0.7) },
          // Whole cells around the equator, so the longitude seam closes.
          uDensity: { value: PANELS_AROUND / (2 * Math.PI) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        // Both faces: the far wall is what gives the limb its brightness.
        side: THREE.DoubleSide,
      }),
    [style.colour, style.opacity, own],
  );

  useFrame(({ clock }) => {
    // A slow breath. Armour that is perfectly still reads as a modelling artefact.
    const s = 1 + Math.sin(clock.elapsedTime * 0.7 + node.position[0]) * 0.012;
    group.current?.scale.setScalar(s);
  });

  return (
    <group ref={group} position={node.position}>
      <mesh renderOrder={3} material={material}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
    </group>
  );
}
