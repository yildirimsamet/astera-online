import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { planetArt } from '../ui/assets.js';
import { softGlow } from './Environment.jsx';
import { STANCE_LIGHT, type PlanetNode } from './scene.js';
import { wasTap } from './tap.js';

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
  onSelect,
}: {
  nodes: readonly PlanetNode[];
  selectedId: string | null;
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
      <Highlights nodes={nodes} selectedId={selectedId} />
    </>
  );
}

const UP = new THREE.Object3D();

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
    event.stopPropagation();
    const index = event.instanceId;
    if (index === undefined) return;
    const node = group.nodes[index];
    if (node) onSelect(node.id);
  };

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      onPointerUp={pick}
      /**
       * #4 — worlds vanishing at certain angles.
       *
       * The bounding sphere computed above makes culling correct, but each texture
       * group spans the whole disc, so a group is either entirely on screen or
       * entirely off it — and "entirely off" was being decided by a sphere that a
       * grazing frustum could miss. With at most fifty planets in sixteen draw
       * calls there is nothing to win by culling them, and everything to lose.
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
}: {
  nodes: readonly PlanetNode[];
  selectedId: string | null;
}) {
  const camera = useThree((state) => state.camera);
  const marked = nodes.filter(
    (node) => node.id === selectedId || node.stance === 'self' || node.stance === 'window',
  );

  return (
    <>
      {marked.map((node) => (
        <Ring key={node.id} node={node} camera={camera} selected={node.id === selectedId} />
      ))}
    </>
  );
}

const MARK_COLOUR = { self: '#8fd6ea', window: '#5ad39b', other: '#e8e3d6' } as const;

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
  selected,
}: {
  node: PlanetNode;
  camera: THREE.Camera;
  selected: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current?.quaternion.copy(camera.quaternion);
  });

  const colour =
    node.stance === 'self'
      ? MARK_COLOUR.self
      : node.stance === 'window'
        ? MARK_COLOUR.window
        : MARK_COLOUR.other;

  const edge = node.radius * 1.04;

  return (
    <group ref={ref} position={node.position}>
      {/* The halo. Behind the world, so it reads as light coming off the limb. */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[node.radius * 4.4, node.radius * 4.4]} />
        <meshBasicMaterial
          map={softGlow()}
          color={colour}
          transparent
          opacity={node.stance === 'window' ? 0.5 : 0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* A hairline on the silhouette itself. */}
      <mesh>
        <ringGeometry args={[edge, edge * 1.018, 64]} />
        <meshBasicMaterial color={colour} transparent opacity={0.9} depthWrite={false} />
      </mesh>

      {/* The chevron: a map pin, pointing at the thing it names. */}
      <mesh position={[0, node.radius * 1.34, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[node.radius * 0.13, node.radius * 0.2, 3]} />
        <meshBasicMaterial color={colour} transparent opacity={0.95} depthWrite={false} />
      </mesh>

      {selected && (
        <mesh>
          <ringGeometry args={[node.radius * 1.34, node.radius * 1.36, 64]} />
          <meshBasicMaterial color={colour} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
