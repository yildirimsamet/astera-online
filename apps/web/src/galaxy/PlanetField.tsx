import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { planetArt } from '../ui/assets.js';
import { limbTexture, softGlow } from './Environment.jsx';
import { fireTexture, smokeTexture } from './vfx.js';
import { STANCE_LIGHT, isRivalNode, type PlanetNode } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { useReducedMotionPreference } from './motion.js';
import { serverNow } from '../lib/clock.js';

/**
 * Every world in the disc, in sixteen draw calls.
 *
 * WHY INSTANCED. The first version built four meshes per planet — a hit target, a
 * glow, the body, a ring. At the design's 200-player shard that is 800 meshes, and
 * the ceiling for a scene like this is "a few hundred, optimally less". Instancing
 * collapses it to one draw call per distinct texture, and there are exactly sixteen
 * planet renders, so the whole galaxy costs sixteen.
 *
 * WHY NOT ONE ATLAS. A packed atlas with per-instance UV offsets would make it a
 * single draw call. Sixteen is already far below anything that matters, and an
 * atlas would mean a custom shader and a build step to maintain — cost with no
 * measurable return.
 *
 * WHY BILLBOARDS. The sixteen planet assets are *renders*: lit, shaded, finished.
 * Wrapping one onto a sphere would fight its baked lighting. Facing them at the
 * camera keeps every bit of the quality they were drawn with for one quad each,
 * and sets the visual language for everything else that stands on a world.
 */

interface Group {
  texture: string;
  nodes: PlanetNode[];
}

export function PlanetField({
  nodes,
  selectedId,
  rivalPlanetId,
  rivalPlayerId,
  onSelect,
}: {
  nodes: readonly PlanetNode[];
  selectedId: string | null;
  rivalPlanetId: string | null;
  rivalPlayerId: string | null;
  onSelect: (id: string) => void;
}) {
  // One bucket per distinct render, so each bucket can be a single instanced draw.
  const groups = useMemo<Group[]>(() => {
    const byTexture = new Map<string, PlanetNode[]>();
    for (const node of nodes) {
      const texture = planetArt(node.id);
      const bucket = byTexture.get(texture);
      if (bucket) bucket.push(node);
      else byTexture.set(texture, [node]);
    }
    return [...byTexture].map(([texture, group]) => ({ texture, nodes: group }));
  }, [nodes]);

  return (
    <>
      {groups.map((group) => (
        <PlanetInstances key={group.texture} group={group} onSelect={onSelect} />
      ))}
      <Atmospheres nodes={nodes} />
      <RecoveryScars nodes={nodes} />
      <Highlights
        nodes={nodes}
        selectedId={selectedId}
        rivalPlanetId={rivalPlanetId}
        rivalPlayerId={rivalPlayerId}
      />
    </>
  );
}

/** Six hours of strategic damage must remain visible for the whole galaxy. */
function RecoveryScars({ nodes }: { nodes: readonly PlanetNode[] }) {
  const damaged = nodes.filter((node) => node.state?.kind === 'RECOVERY');
  return <>{damaged.map((node) => <RecoveryScar key={node.id} node={node} />)}</>;
}

function seededUnit(text: string, index: number): number {
  let value = 2166136261 ^ index;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  return ((value ^ (value >>> 13)) >>> 0) / 0x1_0000_0000;
}

function RecoveryScar({ node }: { node: PlanetNode }) {
  const root = useRef<THREE.Group>(null);
  const smokeSprites = useRef<(THREE.Sprite | null)[]>([]);
  const emberSprites = useRef<(THREE.Sprite | null)[]>([]);
  const camera = useThree((state) => state.camera);
  const smoke = useMemo(smokeTexture, []);
  const fire = useMemo(fireTexture, []);
  const cracks = useMemo(() => {
    const points: number[] = [];
    for (let ray = 0; ray < 7; ray++) {
      const angle = seededUnit(node.id, ray) * Math.PI * 2;
      let x = (seededUnit(node.id, ray + 20) - 0.5) * 0.12;
      let y = (seededUnit(node.id, ray + 40) - 0.5) * 0.12;
      for (let segment = 1; segment <= 3; segment++) {
        const distance = 0.2 + segment * (0.17 + seededUnit(node.id, ray * 7 + segment) * 0.05);
        const nx = Math.cos(angle + (seededUnit(node.id, ray * 11 + segment) - 0.5) * 0.32) * distance;
        const ny = Math.sin(angle + (seededUnit(node.id, ray * 13 + segment) - 0.5) * 0.32) * distance;
        points.push(x, y, 0, nx, ny, 0);
        x = nx;
        y = ny;
      }
    }
    return new Float32Array(points);
  }, [node.id]);

  useFrame(({ clock }) => {
    root.current?.quaternion.copy(camera.quaternion);
    const time = clock.elapsedTime;
    smokeSprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const phase = (seededUnit(node.id, i + 70) + time * (0.035 + i * 0.0015)) % 1;
      const side = (seededUnit(node.id, i + 90) - 0.5) * node.radius * 0.7;
      sprite.position.set(
        side + Math.sin(time * 0.7 + i) * node.radius * 0.06,
        node.radius * (0.15 + phase * 2.15),
        0.04,
      );
      const size = node.radius * (0.38 + phase * 0.95);
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(phase * Math.PI) * 0.3;
      sprite.material.rotation = time * (i % 2 === 0 ? 0.045 : -0.04) + i;
    });
    emberSprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const pulse = 0.5 + Math.sin(time * (3.4 + i * 0.37) + i * 1.9) * 0.5;
      sprite.material.opacity = 0.2 + pulse * 0.52;
      const size = node.radius * (0.13 + pulse * 0.08);
      sprite.scale.set(size, size, 1);
    });
  });

  return (
    <group ref={root} position={node.position} name={`recovery-scar-${node.id}`}>
      <mesh position={[0, 0, 0.025]} renderOrder={3}>
        <circleGeometry args={[node.radius * 0.93, 48]} />
        <meshBasicMaterial color="#140406" transparent opacity={0.27} depthWrite={false} />
      </mesh>
      <lineSegments position={[0, 0, 0.04]} scale={node.radius} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cracks, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ff6a32" transparent opacity={0.9} depthWrite={false} />
      </lineSegments>
      {[0, 1, 2, 3, 4].map((i) => (
        <sprite
          key={`ember-${String(i)}`}
          ref={(sprite) => { emberSprites.current[i] = sprite; }}
          position={[
            (seededUnit(node.id, i + 110) - 0.5) * node.radius * 1.15,
            (seededUnit(node.id, i + 130) - 0.5) * node.radius * 1.05,
            0.05,
          ]}
          renderOrder={6}
        >
          <spriteMaterial map={fire} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <sprite
          key={`smoke-${String(i)}`}
          ref={(sprite) => { smokeSprites.current[i] = sprite; }}
          renderOrder={4}
        >
          <spriteMaterial map={smoke} color="#5d3033" transparent depthWrite={false} />
        </sprite>
      ))}
      <pointLight color="#ff351f" intensity={1.6} distance={node.radius * 3.5} decay={2} />
    </group>
  );
}

/**
 * THE ONE THING IN THIS SCENE THAT WAS NOT ALIVE. D53a.
 *
 * A hull sheds a wake, a shield breathes, a rock tumbles, a beam pulses, a plume
 * flickers — and the worlds, which are what the game is about, were the only
 * objects in the sky with nothing happening at all. They also ended at a hard
 * alpha cut, so each one sat on black like a sticker rather than hanging in space.
 *
 * One extra quad per world fixes both: the light a planet scatters at its own
 * limb. See `limbTexture` for what the gradients are doing and why the peak
 * straddles the silhouette rather than sitting outside it.
 *
 * ONE DRAW CALL FOR THE WHOLE GALAXY. The bodies need one bucket per distinct
 * render because each is its own texture; the limb is the same texture on every
 * world, so all fifty are a single instanced mesh. That is the entire cost.
 *
 * NOT A MARKER. `Highlights` already draws a coloured halo, and it means "this one
 * is yours" or "this one is selected" — three or four worlds ever. If the limb read
 * as a halo it would drown that. It is warm, faint, tight to the silhouette, and it
 * never changes with focus.
 */
export const LIMB_SCALE = 1.1;

/**
 * A breath so slow it is under conscious notice, and the reason it exists at all
 * is the one written on `Shields`: something perfectly still reads as a modelling
 * artefact rather than as an object. Eighteen seconds and one and a half per cent,
 * phase-shifted per world so fifty of them never pulse in unison.
 */
const LIMB_BREATH_RATE = 0.35;
const LIMB_BREATH_DEPTH = 0.015;

/** Scattered light, not white: an atmosphere lit by a warm key reads warm. */
export const LIMB_TINT = { r: 1, g: 0.72, b: 0.42 };

function Atmospheres({ nodes }: { nodes: readonly PlanetNode[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((state) => state.camera);
  const texture = useMemo(() => limbTexture(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const count = nodes.length;
  const reducedMotion = useReducedMotionPreference();

  /**
   * IGNORANCE IS DARK HERE TOO.
   *
   * The bodies are dimmed per instance by `STANCE_LIGHT`, so a world the player
   * cannot see is literally darker. A limb at full brightness on an unwatched world
   * would light up the exact thing the fog is dimming — and would do it in the most
   * eye-catching way available, since it is the brightest pixel on the silhouette.
   */
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    nodes.forEach((node, i) => {
      const light = STANCE_LIGHT[node.stance];
      mesh.setColorAt(i, tint.setRGB(LIMB_TINT.r * light, LIMB_TINT.g * light, LIMB_TINT.b * light));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
  }, [nodes, tint]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    nodes.forEach((node, i) => {
      UP.position.set(node.position[0], node.position[1], node.position[2]);
      UP.quaternion.copy(camera.quaternion);
      // Phase off the world's own x so the field never settles into one rhythm.
      const breath = reducedMotion
        ? 1
        : 1 + Math.sin(t * LIMB_BREATH_RATE + node.position[0]) * LIMB_BREATH_DEPTH;
      UP.scale.setScalar(node.radius * 2 * LIMB_SCALE * breath);
      UP.updateMatrix();
      mesh.setMatrixAt(i, UP.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      name="planet-limbs"
      args={[undefined, undefined, count]}
      /**
       * Same reason the bodies are not culled: one instanced mesh spans the whole
       * disc, so it is either entirely on screen or entirely off it, and "entirely
       * off" was being decided by a bounding sphere a grazing frustum could miss.
       */
      frustumCulled={false}
      /** Behind everything that stands ON a world, and never a hit target. */
      renderOrder={-1}
      raycast={() => null}
    >
      <planeGeometry args={[1, 1]} />
      {/*
        DEPTH IS READ AND NEVER WRITTEN.
        
        Three's default depth function is LessEqual, and this quad is a billboard
        through the same centre as the body it belongs to — so across the overlap
        the two have equal depth and the limb passes, which is what puts the bright
        part of the band ON the planet's edge rather than only beside it. Anything
        genuinely nearer still occludes it, and writing depth would let a limb hide
        the craft standing off the world behind it.
      */}
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        opacity={0.4}
      />
    </instancedMesh>
  );
}

const UP = new THREE.Object3D();
/** The axis a cone is spun about to point it down at the world it names. */
const FORWARD = new THREE.Vector3(0, 0, 1);

function PlanetInstances({ group, onSelect }: { group: Group; onSelect: (id: string) => void }) {
  const texture = useLoader(THREE.TextureLoader, group.texture);
  const ref = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((state) => state.camera);
  const count = group.nodes.length;

  /**
   * Ignorance is literally dark: an unwatched world is dimmed per instance, so the
   * fog is a property of the render rather than something drawn over the top.
   *
   * Via `setColorAt`, not by assigning `instanceColor` directly. Three.js decides
   * whether to compile the instance-colour path when the material is built, so an
   * attribute attached afterwards is silently ignored — which is exactly what
   * happened: every planet in the galaxy rendered at full brightness and the fog
   * of war was invisible. `setColorAt` allocates the attribute and the material is
   * marked for recompilation here.
   */
  const tint = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    group.nodes.forEach((node, i) => {
      const light = STANCE_LIGHT[node.stance];
      mesh.setColorAt(i, tint.setRGB(light, light, light));

      // Place them here as well as in the frame loop, because the bounding sphere
      // below is computed from these matrices.
      UP.position.set(node.position[0], node.position[1], node.position[2]);
      UP.quaternion.identity();
      UP.scale.setScalar(node.radius * 2);
      UP.updateMatrix();
      mesh.setMatrixAt(i, UP.matrix);
    });

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    // `InstancedMesh.material` is typed as one material or an array; this mesh only
    // ever has one, and narrowing beats asserting.
    if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;

    /**
     * THE BUG THIS LINE EXISTS FOR.
     *
     * Three.js frustum-culls an InstancedMesh using the GEOMETRY's bounding
     * sphere — here a 1×1 plane at the origin — not the instances. The camera
     * looks at the player's own planet, which is nowhere near the origin, so the
     * entire galaxy was culled and every world vanished. Computing the sphere from
     * the instance matrices makes culling correct instead of switching it off.
     *
     * Planets never move, so this runs once per data change rather than per frame.
     */
    mesh.computeBoundingSphere();
  }, [group.nodes, tint]);

  /**
   * Billboarding, once per rendered frame.
   *
   * Every instance shares the camera's orientation, so this is a matrix compose per
   * planet — trivial work — and it runs only on frames that are actually drawn,
   * because the canvas renders on demand.
   */
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    group.nodes.forEach((node, i) => {
      UP.position.set(node.position[0], node.position[1], node.position[2]);
      UP.quaternion.copy(camera.quaternion);
      UP.scale.setScalar(node.radius * 2);
      UP.updateMatrix();
      mesh.setMatrixAt(i, UP.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Billboarding rotates each quad in place, so the sphere computed above stays
  // valid; only a change in positions would need it recomputed.

  const pick = (event: ThreeEvent<PointerEvent>): void => {
    // Panning across the disc must not open whatever was under the thumb when the
    // gesture started. Only a gesture that ends without travelling is a choice.
    if (!wasTap()) return;
    markHit();
    event.stopPropagation();
    const index = event.instanceId;
    if (index === undefined) return;
    const node = group.nodes[index];
    if (node) onSelect(node.id);
  };

  return (
    <instancedMesh
      ref={ref}
      name="planet-worlds"
      args={[undefined, undefined, count]}
      onPointerUp={pick}
      /**
       * #4 — worlds vanishing at certain angles.
       *
       * The bounding sphere computed above makes culling correct, but each texture
       * group spans the whole disc, so a group is either entirely on screen or
       * entirely off it — and "entirely off" was being decided by a sphere that a
       * grazing frustum could miss. Even at 351 worlds these remain sixteen
       * instanced draw groups; culling a whole scattered group wins almost
       * nothing and can hide selectable worlds.
       */
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      {/*
        #9 — a nearer world drawing behind a further one.
        
        `transparent` + `depthWrite: false` means nothing writes depth, so the draw
        ORDER decides what covers what — and the order is per instanced group, not
        per planet. The fix is to stop treating these as translucent: the art is
        opaque inside a hard alpha edge, so an alpha test cuts the disc out while
        still writing depth, and `alphaToCoverage` uses the MSAA samples to keep
        the rim smooth instead of jagged.
      */}
      <meshBasicMaterial
        map={texture}
        transparent={false}
        alphaTest={0.35}
        alphaToCoverage
        depthWrite
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/**
 * The few worlds that get more than a body.
 *
 * Rings and haloes are individual meshes on purpose: only your own planet, an open
 * window and the current selection ever wear one, so the count is three or four
 * rather than two hundred. Giving every planet a ring would put the mesh count
 * straight back where instancing just took it from.
 */
function Highlights({
  nodes,
  selectedId,
  rivalPlanetId,
  rivalPlayerId,
}: {
  nodes: readonly PlanetNode[];
  selectedId: string | null;
  rivalPlanetId: string | null;
  rivalPlayerId: string | null;
}) {
  const camera = useThree((state) => state.camera);
  const viewportHeight = useThree((state) => state.size.height);
  const marked = nodes.filter(
    (node) => node.id === selectedId
      || node.isOwned
      || node.stance === 'window'
      || isRivalNode(node, rivalPlanetId, rivalPlayerId)
      || node.state?.kind === 'RECOVERY'
      || Boolean(node.claimUntil && node.claimUntil.getTime() > serverNow()),
  );

  /**
   * Everything that is not yours carries a pin: grey for neutral, orange for
   * another commander. `Ring` still owns the worlds it already marked.
   */
  const pinned = useMemo(() => nodes.filter((node) => !node.isOwned), [nodes]);

  return (
    <>
      <Pins nodes={pinned} />
      {marked.map((node) => (
        <Ring
          key={node.id}
          node={node}
          camera={camera}
          viewportHeight={viewportHeight}
          selected={node.id === selectedId}
          rival={isRivalNode(node, rivalPlanetId, rivalPlayerId)}
          claim={Boolean(node.claimUntil && node.claimUntil.getTime() > serverNow())}
          recovering={node.state?.kind === 'RECOVERY'}
        />
      ))}
    </>
  );
}

const MARK_COLOUR = { self: '#8fd6ea', window: '#5ad39b', other: '#e8e3d6' } as const;

/**
 * Where the selection ring stands off, as a multiple of the world's radius.
 *
 * Named because something else now has to stay inside it. The atmosphere limb is
 * on every world in the galaxy; the selection ring is on ONE. If the limb ever
 * reached as far, the marker would be reading against a bright band rather than
 * against space, and the one control that answers "which of these did I tap"
 * would be the hardest thing on screen to find. Pinned in `planet-visuals.test`.
 */
export const SELECTION_RING = 1.34;
export const MIN_MARKER_PX = 18;

export function markerScale(
  distance: number,
  radius: number,
  viewportHeight: number,
  verticalFov: number,
): number {
  if (radius <= 0 || viewportHeight <= 0 || distance <= 0) return 1;
  const visibleHeight = 2 * distance * Math.tan((verticalFov * Math.PI) / 360);
  const wanted = (visibleHeight * MIN_MARKER_PX) / viewportHeight;
  return Math.min(4, Math.max(1, wanted / (radius * SELECTION_RING * 2)));
}

/** Grey for a world nobody holds, orange for a world somebody else does. */
export const PIN_COLOUR = { neutral: '#9aa6b2', rival: '#ff8a3d' } as const;

/**
 * Which pin a world wears. Public facts only: `kind` already decides the
 * silhouette the disc draws, so naming it in a colour leaks nothing.
 */
export const pinColour = (kind: PlanetNode['kind']): string =>
  kind === 'NEUTRAL' ? PIN_COLOUR.neutral : PIN_COLOUR.rival;

/**
 * A PIN ON EVERY WORLD THAT IS NOT YOURS.
 *
 * `Ring` marks a handful of worlds — the one you tapped, the ones you own, the ones
 * a telescope is holding open. Most of the disc carries nothing, which is correct
 * for a fog game but leaves a player unable to tell a neutral farm from a
 * commander's capital without tapping each one. These say which is which, publicly
 * and permanently: both facts are already on the map (`kind` decides the
 * silhouette) so nothing here leaks.
 *
 * INSTANCED, BECAUSE THERE ARE THREE HUNDRED OF THEM. The worlds themselves are one
 * `InstancedMesh` per texture group for exactly this reason; a per-planet mesh here
 * would quietly make the pins the largest source of draw calls in the scene.
 *
 * IT SCALES THE WAY `Ring`'s MARKER DOES, through the same `markerScale`: a pin
 * holds a floor of `MIN_MARKER_PX` on screen and is capped at 4x, so zooming out
 * shrinks the pins with the disc instead of filling the screen with them.
 */
function Pins({ nodes }: { nodes: readonly PlanetNode[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((state) => state.camera);
  const viewportHeight = useThree((state) => state.size.height);
  const tint = useMemo(() => new THREE.Color(), []);
  const spin = useMemo(() => new THREE.Quaternion().setFromAxisAngle(FORWARD, Math.PI), []);
  const facing = useMemo(() => new THREE.Quaternion(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const centre = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    nodes.forEach((node, i) => {
      mesh.setColorAt(i, tint.set(pinColour(node.kind)));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
  }, [nodes, tint]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || !(camera instanceof THREE.PerspectiveCamera)) return;
    facing.copy(camera.quaternion).multiply(spin);

    nodes.forEach((node, i) => {
      centre.set(node.position[0], node.position[1], node.position[2]);
      const scale = markerScale(camera.position.distanceTo(centre), node.radius, viewportHeight, camera.fov);
      // The pin stands off along the camera's own up axis, so it sits above the
      // world from wherever it is being looked at — the billboard `Ring` gets from
      // copying the camera quaternion onto a group.
      offset.set(0, node.radius * SELECTION_RING * scale, 0).applyQuaternion(camera.quaternion);
      UP.position.copy(centre).add(offset);
      UP.quaternion.copy(facing);
      UP.scale.setScalar(node.radius * scale);
      UP.updateMatrix();
      mesh.setMatrixAt(i, UP.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (nodes.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, nodes.length]}
      // The instances move with the camera every frame, so a bounding sphere
      // computed from them is stale the moment it is written. These are tiny and
      // there are a few hundred; drawing them all beats culling them wrongly.
      frustumCulled={false}
    >
      <coneGeometry args={[0.13, 0.2, 3]} />
      <meshBasicMaterial transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * "This one is mine."
 *
 * The first version was a hoop at 1.45× the planet's radius: a big empty circle
 * floating around a world, reading as a targeting reticle rather than as identity.
 *
 * This sits ON the silhouette instead. A hairline at the planet's own edge, a soft
 * halo bleeding out of it, and a small chevron above — the map-marker vocabulary,
 * which is instantly legible and does not fence the planet off from the scene it
 * lives in. Selection adds a second, wider ring so the two states never collapse
 * into one another.
 */
function Ring({
  node,
  camera,
  viewportHeight,
  selected,
  rival,
  claim,
  recovering,
}: {
  node: PlanetNode;
  camera: THREE.Camera;
  viewportHeight: number;
  selected: boolean;
  rival: boolean;
  claim: boolean;
  recovering: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const markerRef = useRef<THREE.Group>(null);
  const markerWorld = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    ref.current?.quaternion.copy(camera.quaternion);
    if (!markerRef.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const scale = markerScale(
      camera.position.distanceTo(markerRef.current.getWorldPosition(markerWorld)),
      node.radius,
      viewportHeight,
      camera.fov,
    );
    markerRef.current.scale.setScalar(scale);
  });

  const colour =
    rival
      ? '#ff6b43'
      : recovering
        ? '#ff405b'
        : claim
          ? '#5ad39b'
      : node.stance === 'self'
      ? MARK_COLOUR.self
      : node.stance === 'window'
        ? MARK_COLOUR.window
        : MARK_COLOUR.other;

  const edge = node.radius * 1.04;

  return (
    <group ref={ref} position={node.position}>
      {/* The halo. Behind the world, so it reads as light coming off the limb. */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[node.radius * 2.2, node.radius * 2.2]} />
        <meshBasicMaterial
          map={softGlow()}
          color={colour}
          transparent
          opacity={node.stance === 'window' ? 0.25 : 0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* A hairline on the silhouette itself. */}
      <mesh>
        <ringGeometry args={[edge, edge * 1.018, 64]} />
        <meshBasicMaterial color={colour} transparent opacity={0.9} depthWrite={false} />
      </mesh>

      <group ref={markerRef}>
      {/* The chevron: a map pin, pointing at the thing it names. */}
      {node.isOwned && (
        node.isCapital ? (
          <group position={[0, node.radius * SELECTION_RING, 0]}>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[node.radius * 0.22, node.radius * 0.22]} />
              <meshBasicMaterial color={colour} transparent opacity={0.98} depthWrite={false} />
            </mesh>
            <mesh position={[0, node.radius * 0.2, 0]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[node.radius * 0.1, node.radius * 0.1]} />
              <meshBasicMaterial color={colour} transparent opacity={0.65} depthWrite={false} />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, node.radius * SELECTION_RING, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[node.radius * 0.13, node.radius * 0.2, 3]} />
            <meshBasicMaterial color={colour} transparent opacity={0.95} depthWrite={false} />
          </mesh>
        )
      )}

      {rival && (
        <group>
          <mesh>
            <ringGeometry args={[node.radius * 1.48, node.radius * 1.53, 64]} />
            <meshBasicMaterial color={colour} transparent opacity={0.82} depthWrite={false} />
          </mesh>
          {[0, 1, 2, 3].map((quarter) => (
            <mesh
              key={quarter}
              rotation={[0, 0, quarter * Math.PI / 2]}
              position={[
                Math.sin(quarter * Math.PI / 2) * node.radius * 1.5,
                Math.cos(quarter * Math.PI / 2) * node.radius * 1.5,
                0.01,
              ]}
            >
              <planeGeometry args={[node.radius * 0.06, node.radius * 0.34]} />
              <meshBasicMaterial color={colour} transparent opacity={0.95} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {claim && (
        <group position={[0, node.radius * 1.58, 0]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <ringGeometry args={[node.radius * 0.13, node.radius * 0.2, 4]} />
            <meshBasicMaterial color="#5ad39b" transparent opacity={0.98} depthWrite={false} />
          </mesh>
          <pointLight color="#5ad39b" intensity={0.8} distance={node.radius * 3} decay={2} />
        </group>
      )}

      {selected && (
        <mesh>
          <ringGeometry args={[node.radius * SELECTION_RING, node.radius * (SELECTION_RING + 0.02), 64]} />
          <meshBasicMaterial color={colour} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
      </group>
    </group>
  );
}
