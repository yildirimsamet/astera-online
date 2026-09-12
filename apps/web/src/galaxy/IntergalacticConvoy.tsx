import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { INTERGALACTIC_CONVOY, convoyFormationSlots, type MobileHullId } from '@astera/rules';
import type { IntergalacticConvoyEvent } from '../lib/intergalacticConvoy.js';
import { FLEET_V2_ASSET_MANIFEST } from '../ui/fleet-v2-assets.js';
import { hullPoseLift } from '../ui/assets.js';
import { serverNow } from '../lib/clock.js';
import { FormationWakes, Hull } from './Fleets.jsx';
import {
  CRAFT_SCALE,
  SCALE,
  intergalacticConvoyWorldPosition,
  toWorld,
} from './scene.js';
import { markHit, wasTap } from './tap.js';

export const CONVOY_BASE_HULL_SCALE = 0.14 * CRAFT_SCALE;
export const CONVOY_HULL_SCALE_MULT = 2;
export const CONVOY_HULL_SCALE = CONVOY_BASE_HULL_SCALE * CONVOY_HULL_SCALE_MULT;
export const CONVOY_DRIFT_AMPLITUDE =
  (Math.min(...INTERGALACTIC_CONVOY.formation.rankGaps) / SCALE) * 0.12;
export const CONVOY_WIND_LAYER_COUNT = 4;
export const CONVOY_WIND_OPACITY = 0.105;

const FORMATION_VERSION = 1;
const FOCUS_FOV_RADIANS = Math.PI / 4;
// The expanded focus rail consumes the lower third of a 350px portrait view.
// 2.3 keeps the entire train above it while preserving the formation midpoint as
// the actual camera target, rather than cheating the target upward on screen.
const FOCUS_VERTICAL_PADDING = 2.3;

type Vec3Tuple = [number, number, number];

interface VisualSlot {
  readonly hull: MobileHullId;
  readonly position: Vec3Tuple;
}

/** Full nose-to-tail world-space extent after size-aware spacing and 2x hull scale. */
export const CONVOY_FORMATION_LENGTH = (() => {
  let front = -Infinity;
  let back = Infinity;
  for (const slot of convoyFormationSlots(FORMATION_VERSION)) {
    const halfHull = CONVOY_HULL_SCALE * FLEET_V2_ASSET_MANIFEST[slot.hull].scale / 2;
    const z = slot.localPosition.z / SCALE;
    front = Math.max(front, z + halfHull);
    back = Math.min(back, z - halfHull);
  }
  return front - back;
})();

/** Exact camera range that fits the final train in a 45-degree portrait view. */
export const CONVOY_FOCUS_DISTANCE =
  CONVOY_FORMATION_LENGTH / 2
  / Math.tan(FOCUS_FOV_RADIANS / 2)
  * FOCUS_VERTICAL_PADDING;

const HIT_RADIUS = CONVOY_FORMATION_LENGTH * 0.54;

// phase, speed, lateral offset and veil width; then bend, lift, energy and tone.
// Each instance covers the full convoy rather than travelling as a rigid object.
const WIND_LAYERS = [
  { flow: [0.03, 0.16, -0.08, 1.06], shape: [0.28, 0.030, 0.72, 0.10] },
  { flow: [0.29, 0.19, 0.07, 0.94], shape: [0.36, 0.052, 0.62, 0.45] },
  { flow: [0.57, 0.14, -0.02, 1.13], shape: [0.24, 0.074, 0.54, 0.72] },
  { flow: [0.81, 0.22, 0.03, 0.88], shape: [0.42, 0.096, 0.46, 1.00] },
] as const;

const WIND_FLOW_SEGMENTS = 48;

const WIND_VERTEX_SHADER = `
  attribute vec4 aFlow;
  attribute vec4 aShape;
  uniform float uTime;
  uniform float uFront;
  uniform float uBack;
  uniform float uHalfWidth;
  varying vec2 vUv;
  varying float vFlow;
  varying float vPhase;
  varying float vEnergy;
  varying float vTone;

  void main() {
    float along = uv.y;
    float phase = aFlow.x * 6.2831853;
    // Keeping the sheet anchored while this phase travels toward increasing UV
    // makes the wind itself flow to local -Z instead of sliding a frozen stroke.
    vFlow = uv.y * 2.8 - uTime * aFlow.y;
    float envelope = sin(3.14159265 * along);
    float primary = sin(vFlow * 3.1 + phase);
    float secondary = sin(vFlow * 7.3 - phase * 0.67);
    float bend = (primary * 0.7 + secondary * 0.3) * aShape.x * envelope;
    float edgeFlutter = sin(vFlow * 9.2 + uv.x * 4.7 + phase) * 0.025 * envelope;

    vec3 veilPosition = vec3(
      (position.x * aFlow.w + aFlow.z) * uHalfWidth + bend + edgeFlutter,
      aShape.y + secondary * 0.012 * envelope,
      mix(uFront, uBack, along)
    );

    vUv = uv;
    vPhase = phase;
    vEnergy = aShape.z;
    vTone = aShape.w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(veilPosition, 1.0);
  }
`;

const WIND_FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFlow;
  varying float vPhase;
  varying float vEnergy;
  varying float vTone;

  float flowHash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float flowNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 curve = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(flowHash(cell), flowHash(cell + vec2(1.0, 0.0)), curve.x),
      mix(flowHash(cell + vec2(0.0, 1.0)), flowHash(cell + vec2(1.0)), curve.x),
      curve.y
    );
  }

  float flowFbm(vec2 point) {
    float value = 0.0;
    float weight = 0.5;
    mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 4; octave += 1) {
      value += flowNoise(point) * weight;
      point = turn * point * 2.03 + vec2(3.1, 1.7);
      weight *= 0.5;
    }
    return value;
  }

  void main() {
    // Domain-warped fBm makes continuous smoky folds. Both noise coordinates
    // include vFlow, so the folds evolve and travel rearward instead of merely
    // being translated as an unchanged image.
    vec2 domain = vec2(vUv.x * 2.15 + vPhase, vFlow);
    float broadNoise = flowFbm(domain);
    float crossNoise = flowFbm(domain * 1.73 + vec2(5.2, -3.7));
    float warpedAcross = vUv.x + (broadNoise - 0.5) * 0.25
      + sin(vFlow * 2.2 + vPhase) * 0.035;

    float centreA = 0.27 + sin(vFlow * 1.55 + vPhase) * 0.12;
    float centreB = 0.71 + sin(vFlow * 1.28 - vPhase * 0.7) * 0.14;
    float distanceA = abs(warpedAcross - centreA);
    float distanceB = abs(warpedAcross - centreB);
    float strandA = 1.0 - smoothstep(0.012, 0.072, distanceA);
    float strandB = 1.0 - smoothstep(0.015, 0.082, distanceB);
    float threadA = 1.0 - smoothstep(0.004, 0.014, abs(distanceA - 0.043));
    float threadB = 1.0 - smoothstep(0.004, 0.016, abs(distanceB - 0.050));
    float filaments = max(strandA, strandB) * (0.52 + crossNoise * 0.34)
      + max(threadA, threadB) * 0.38;

    float softBody = 1.0 - smoothstep(0.08, 0.52, abs(warpedAcross - 0.5));
    softBody *= smoothstep(0.42, 0.82, broadNoise) * 0.08;
    float sideFade = smoothstep(0.0, 0.11, vUv.x)
      * (1.0 - smoothstep(0.89, 1.0, vUv.x));
    float noseFade = smoothstep(0.0, 0.07, vUv.y);
    float tailFade = 1.0 - smoothstep(0.78, 1.0, vUv.y);
    float alpha = (filaments + softBody) * sideFade * noseFade * tailFade
      * vEnergy * uOpacity;
    if (alpha < 0.002) discard;

    vec3 edgeColour = mix(vec3(0.08, 0.26, 0.34), vec3(0.11, 0.34, 0.43), vTone);
    vec3 coreColour = mix(vec3(0.50, 0.72, 0.78), vec3(0.64, 0.82, 0.87), vTone);
    vec3 colour = mix(edgeColour, coreColour, 0.26 + min(1.0, filaments) * 0.58);
    gl_FragColor = vec4(colour, alpha);
  }
`;

/**
 * A small deterministic throttle disagreement for one ship.
 *
 * Two incommensurate waves keep the formation from marching as a rigid grid.
 * Their weights sum to one, so the exported amplitude is a hard bound rather
 * than a visual guess; even two ships at opposite extremes cannot consume a
 * quarter of the gap between consecutive ranks.
 */
export function convoyLongitudinalOffset(slotIndex: number, elapsedSeconds: number): number {
  const phase = slotIndex * 2.399_963_229_728_653;
  const pace = 0.72 + (slotIndex % 5) * 0.055;
  return CONVOY_DRIFT_AMPLITUDE * (
    Math.sin(elapsedSeconds * pace + phase) * 0.72
    + Math.sin(elapsedSeconds * pace * 1.93 + phase * 0.43) * 0.28
  );
}

/**
 * A soft slipstream field passing from the convoy's nose toward its rear.
 *
 * The CPU uploads four static veil variants once. Their subdivided sheets stay
 * anchored over the complete train while the vertex shader sends bends through
 * them and the fragment shader domain-warps flowing noise into silk-like folds.
 * Per frame only `uTime` and focus opacity change. The whole field is one draw
 * call with no texture, per-filament component or dynamic vertex-buffer upload.
 */
function ConvoyWind({ slots, focused }: {
  slots: readonly VisualSlot[];
  focused: boolean;
}) {
  const bounds = useMemo(() => {
    let front = -Infinity;
    let back = Infinity;
    let halfWidth = 0;
    let largestHull = 0;
    for (const slot of slots) {
      const hullScale = CONVOY_HULL_SCALE * FLEET_V2_ASSET_MANIFEST[slot.hull].scale;
      front = Math.max(front, slot.position[2] + hullScale * 0.55);
      back = Math.min(back, slot.position[2] - hullScale * 0.9);
      halfWidth = Math.max(halfWidth, Math.abs(slot.position[0]) + hullScale * 0.38);
      largestHull = Math.max(largestHull, hullScale);
    }
    return {
      front: front + largestHull * 0.3,
      back: back - largestHull * 0.9,
      halfWidth: halfWidth * 1.12,
    };
  }, [slots]);
  const geometry = useMemo(() => {
    const buffer = new THREE.InstancedBufferGeometry();
    const vertexCount = (WIND_FLOW_SEGMENTS + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint16Array(WIND_FLOW_SEGMENTS * 6);
    for (let segment = 0; segment <= WIND_FLOW_SEGMENTS; segment += 1) {
      const along = segment / WIND_FLOW_SEGMENTS;
      const vertex = segment * 2;
      positions.set([-1, 0, along, 1, 0, along], vertex * 3);
      uvs.set([0, along, 1, along], vertex * 2);
      if (segment === WIND_FLOW_SEGMENTS) continue;
      const index = segment * 6;
      indices.set([
        vertex, vertex + 1, vertex + 2,
        vertex + 1, vertex + 3, vertex + 2,
      ], index);
    }

    const flows = new Float32Array(CONVOY_WIND_LAYER_COUNT * 4);
    const shapes = new Float32Array(CONVOY_WIND_LAYER_COUNT * 4);
    WIND_LAYERS.forEach((layer, index) => {
      flows.set(layer.flow, index * 4);
      shapes.set(layer.shape, index * 4);
    });

    buffer.setIndex(new THREE.BufferAttribute(indices, 1));
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    buffer.setAttribute('aFlow', new THREE.InstancedBufferAttribute(flows, 4));
    buffer.setAttribute('aShape', new THREE.InstancedBufferAttribute(shapes, 4));
    buffer.instanceCount = CONVOY_WIND_LAYER_COUNT;
    return buffer;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFront: { value: bounds.front },
      uBack: { value: bounds.back },
      uHalfWidth: { value: bounds.halfWidth },
      uOpacity: { value: CONVOY_WIND_OPACITY },
    },
    vertexShader: WIND_VERTEX_SHADER,
    fragmentShader: WIND_FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [bounds]);

  useFrame(({ clock }) => {
    // Positive progress maps from `uFront` (+Z) to `uBack` (-Z) in the shader.
    material.uniforms.uTime!.value = clock.elapsedTime;
    material.uniforms.uOpacity!.value = focused
      ? CONVOY_WIND_OPACITY * 1.12
      : CONVOY_WIND_OPACITY;
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh
      name="intergalactic-convoy-wind"
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={() => null}
      renderOrder={995}
    />
  );
}

function ConvoyDriveLights({ slots, focused }: {
  slots: readonly VisualSlot[];
  focused: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    slots.forEach((slot, index) => {
      // Instance colours preserve each hull's authored drive identity while the
      // whole bank remains one draw call.
      node.setColorAt(
        index,
        tint.set(FLEET_V2_ASSET_MANIFEST[slot.hull].light.color).multiplyScalar(1.6),
      );
    });
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
  }, [slots, tint]);

  useFrame(({ clock }) => {
    const node = mesh.current;
    if (!node) return;
    slots.forEach((slot, index) => {
      const drawnScale = CONVOY_HULL_SCALE * FLEET_V2_ASSET_MANIFEST[slot.hull].scale;
      const beat = 1 + Math.sin(clock.elapsedTime * 5.2 + index * 1.73) * 0.16;
      transform.position.set(
        slot.position[0],
        slot.position[1] + hullPoseLift(slot.hull) * drawnScale,
        slot.position[2]
          + convoyLongitudinalOffset(index, clock.elapsedTime)
          - drawnScale * 0.47,
      );
      transform.scale.setScalar(drawnScale * 0.13 * beat);
      transform.updateMatrix();
      node.setMatrixAt(index, transform.matrix);
    });
    node.instanceMatrix.needsUpdate = true;
    if (material.current) {
      material.current.opacity = (focused ? 0.94 : 0.7)
        + Math.sin(clock.elapsedTime * 3.4) * 0.06;
    }
  });

  return (
    <instancedMesh
      ref={mesh}
      name="intergalactic-convoy-drives"
      args={[undefined, undefined, slots.length]}
      frustumCulled={false}
      raycast={() => null}
      renderOrder={997}
    >
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial
        ref={material}
        transparent
        opacity={focused ? 0.94 : 0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/** Every mobile hull moving as one public, focusable scene object. */
export function IntergalacticConvoy({
  event,
  seasonStart,
  focused = false,
  onSelect,
}: {
  event: IntergalacticConvoyEvent | null;
  seasonStart: Date | undefined;
  focused?: boolean;
  onSelect?: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const shipNodes = useRef<(THREE.Group | null)[]>([]);
  const wakeAimDistance = useRef(1_000);
  const slots = useMemo(() => convoyFormationSlots(FORMATION_VERSION), []);
  const visualSlots = useMemo<readonly VisualSlot[]>(() => slots.map((slot) => ({
    hull: slot.hull,
    position: [
      slot.localPosition.x / SCALE,
      slot.localPosition.y / SCALE,
      slot.localPosition.z / SCALE,
    ],
  })), [slots]);
  const markers = useMemo(() => visualSlots.map((slot, ordinal) => ({
    hull: slot.hull,
    filled: 1,
    ordinal,
  })), [visualSlots]);
  const wakeSlots = useMemo(() => visualSlots.map(({ position }) => position), [visualSlots]);
  /**
   * THE FORMATION'S ORIENTATION, SOLVED ONCE AND NEVER BY `lookAt`. D201.
   *
   * A route direction is isotropic, so it may be parallel to world up — and
   * `Object3D.lookAt` answers that by nudging its own basis and inventing a roll,
   * which turns the whole train on its side for no reason a player can read. It is
   * also degenerate at the far end: at the final instant the group's position IS
   * `route.to`, three.js substitutes world +Z, and twenty hulls snap to a compass
   * bearing on the last frames of the crossing.
   *
   * So the rotation is a quaternion from local +Z to the route's own unit
   * direction, computed once per occurrence from a direction that never changes.
   * `setFromUnitVectors` is exact for the antiparallel case too, and the fallback
   * axis below is what stops it choosing an arbitrary one.
   */
  const heading = useMemo(() => {
    const quaternion = new THREE.Quaternion();
    if (!event) return quaternion;
    const from = toWorld(event.route.from);
    const to = toWorld(event.route.to);
    const direction = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    if (direction.lengthSq() === 0) return quaternion;
    direction.normalize();
    const forward = new THREE.Vector3(0, 0, 1);
    const dot = forward.dot(direction);
    // Exactly antiparallel: every perpendicular axis is a valid half turn, so pick
    // a stable one rather than letting the solver's own epsilon decide.
    if (dot < -1 + 1e-9) return quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    return quaternion.setFromUnitVectors(forward, direction);
  }, [event]);

  useFrame(({ clock }) => {
    const node = group.current;
    if (!node || !event || !seasonStart) return;
    const at = intergalacticConvoyWorldPosition(event, seasonStart, serverNow());
    node.position.set(...at);
    node.quaternion.copy(heading);
    visualSlots.forEach((slot, index) => {
      shipNodes.current[index]?.position.set(
        slot.position[0],
        slot.position[1],
        slot.position[2] + convoyLongitudinalOffset(index, clock.elapsedTime),
      );
    });
  });

  if (!event || !seasonStart) return null;

  const pick = (pointer: ThreeEvent<PointerEvent>): void => {
    if (!onSelect || !wasTap()) return;
    markHit();
    pointer.stopPropagation();
    onSelect(event.id);
  };

  return (
    <group ref={group} name="intergalactic-convoy">
      <ConvoyWind slots={visualSlots} focused={focused} />
      <FormationWakes
        name="intergalactic-convoy-wakes"
        markers={markers}
        slots={wakeSlots}
        scale={CONVOY_HULL_SCALE}
        aimDistance={wakeAimDistance}
        longitudinalOffset={convoyLongitudinalOffset}
      />
      <ConvoyDriveLights slots={visualSlots} focused={focused} />
      {slots.map((slot, index) => {
        const asset = FLEET_V2_ASSET_MANIFEST[slot.hull];
        return (
          <group
            ref={(node) => { shipNodes.current[index] = node; }}
            key={`${String(slot.rank)}:${String(slot.column)}`}
            position={[
              slot.localPosition.x / SCALE,
              slot.localPosition.y / SCALE,
              slot.localPosition.z / SCALE,
            ]}
          >
            <Hull
              url={asset.model}
              scale={CONVOY_HULL_SCALE * asset.scale}
              glow={asset.light.color}
              focused={focused}
            />
          </group>
        );
      })}
      {onSelect ? (
        <mesh name="intergalactic-convoy-hit" onPointerUp={pick} renderOrder={-1}>
          <sphereGeometry args={[HIT_RADIUS, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
