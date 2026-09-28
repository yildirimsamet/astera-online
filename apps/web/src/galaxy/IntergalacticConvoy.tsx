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
import { HitboxMaterial } from './hitboxDebug.jsx';

export const CONVOY_BASE_HULL_SCALE = 0.14 * CRAFT_SCALE;
export const CONVOY_HULL_SCALE_MULT = 2;
export const CONVOY_HULL_SCALE = CONVOY_BASE_HULL_SCALE * CONVOY_HULL_SCALE_MULT;
export const CONVOY_DRIFT_AMPLITUDE =
  (Math.min(...INTERGALACTIC_CONVOY.formation.rankGaps) / SCALE) * 0.12;
/** Speed lines streaming past the convoy (owner, 2026-09-24: the silk veil was ugly). */
export const CONVOY_WIND_STREAKS = 12;
export const CONVOY_WIND_OPACITY = 0.32;

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

/** Local +Z is the train's heading, so this thin box turns with the convoy. */
export function convoyPickBox(slots: readonly VisualSlot[]): {
  centre: Vec3Tuple;
  size: Vec3Tuple;
} {
  if (slots.length === 0) return { centre: [0, 0, 0], size: [0, 0, 0] };
  const low: Vec3Tuple = [Infinity, Infinity, Infinity];
  const high: Vec3Tuple = [-Infinity, -Infinity, -Infinity];
  for (const slot of slots) {
    const halfHull = CONVOY_HULL_SCALE * FLEET_V2_ASSET_MANIFEST[slot.hull].scale * 0.7;
    for (const axis of [0, 1, 2] as const) {
      const drift = axis === 2 ? CONVOY_DRIFT_AMPLITUDE : 0;
      low[axis] = Math.min(low[axis], slot.position[axis] - halfHull - drift);
      high[axis] = Math.max(high[axis], slot.position[axis] + halfHull + drift);
    }
  }
  return {
    centre: [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2],
    size: [high[0] - low[0], high[1] - low[1], high[2] - low[2]],
  };
}

/** How fast the air streams past, in convoy spans per second. */
const WIND_SPEED = 0.55;

/** One speed line: across the lanes (in half-widths), its height, its beat, and its length (in spans). */
export interface ConvoyStreak { lateral: number; lift: number; phase: number; length: number }

/**
 * WHERE THE LINES RUN, the same every time: spread across and a little outside the two
 * lanes with a small jitter so they never read as a grid, each on its own beat (golden-ratio
 * phases) and its own length, so the stream never pulses in step.
 */
export function convoyStreaks(count: number): ConvoyStreak[] {
  return Array.from({ length: count }, (_, index) => {
    const across = count === 1 ? 0.5 : index / (count - 1);
    const jitter = (((index * 0.754_877_666) % 1) - 0.5) * 0.12;
    return {
      lateral: -1.2 + across * 2.4 + jitter,
      lift: ((index % 3) - 1) * 0.02,
      phase: (index * 0.618_033_988_75) % 1,
      length: 0.18 + ((index * 0.381_966_011) % 1) * 0.22,
    };
  });
}

const WIND_VERTEX_SHADER = `
  attribute vec4 aStreak;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uFront;
  uniform float uBack;
  uniform float uHalfWidth;
  uniform float uWidth;
  varying float vAlong;
  varying float vAcross;
  varying float vLife;

  void main() {
    float span = uFront - uBack;
    float reach = aStreak.w * span;
    float progress = fract(aStreak.z + uTime * uSpeed);
    // The air streams from the nose (+Z) to the tail (-Z): the head leads, the line trails it.
    float head = mix(uFront, uBack - reach, progress);
    vAlong = position.z;
    vAcross = position.x;
    vLife = sin(3.14159265 * progress);
    vec3 line = vec3(aStreak.x * uHalfWidth + position.x * uWidth, aStreak.y, head + position.z * reach);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(line, 1.0);
  }
`;

const WIND_FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying float vAlong;
  varying float vAcross;
  varying float vLife;

  void main() {
    // A sharp head, a long fading tail, soft sides: a streak, not a bar.
    float taper = smoothstep(0.0, 0.12, vAlong) * (1.0 - smoothstep(0.3, 1.0, vAlong));
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vAcross));
    float alpha = uOpacity * vLife * taper * edge;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vec3(0.74, 0.85, 0.95), alpha);
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

/** Place the slipstream behind the nose and close to the two hull lanes. */
export function convoyWindBounds(slots: readonly VisualSlot[]): {
  front: number;
  back: number;
  halfWidth: number;
} {
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
  const originalFront = front + largestHull * 0.3;
  const rear = back - largestHull * 0.9;
  return {
    front: originalFront - (originalFront - rear) * 0.05,
    back: rear,
    halfWidth: halfWidth * 0.98,
  };
}

/**
 * THE AIR THE CONVOY CUTS THROUGH. Owner, 2026-09-24: the domain-warped silk veil that stood
 * here was ugly — "sanki hızla giden bir araç rüzgarı deliyormuş gibi bir effect olsa
 * yeterli". So: a dozen thin straight speed lines streaming from the nose past the tail,
 * beside and between the lanes, each fading in and out on its own beat.
 *
 * One quad per line, all of them one instanced draw; per frame only `uTime` and the focus
 * opacity change. No texture, no noise, no per-line component.
 */
function ConvoyWind({ slots, focused }: {
  slots: readonly VisualSlot[];
  focused: boolean;
}) {
  const bounds = useMemo(() => convoyWindBounds(slots), [slots]);
  const geometry = useMemo(() => {
    const buffer = new THREE.InstancedBufferGeometry();
    buffer.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1));
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1, 0, 0, 1, 0, 0, -1, 0, 1, 1, 0, 1,
    ]), 3));
    const streaks = new Float32Array(CONVOY_WIND_STREAKS * 4);
    convoyStreaks(CONVOY_WIND_STREAKS).forEach((streak, index) => {
      streaks.set([streak.lateral, streak.lift, streak.phase, streak.length], index * 4);
    });
    buffer.setAttribute('aStreak', new THREE.InstancedBufferAttribute(streaks, 4));
    buffer.instanceCount = CONVOY_WIND_STREAKS;
    return buffer;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: WIND_SPEED },
      uFront: { value: bounds.front },
      uBack: { value: bounds.back },
      uHalfWidth: { value: bounds.halfWidth },
      // A couple of pixels at focus range, sub-pixel from across the disc.
      uWidth: { value: (bounds.front - bounds.back) * 0.004 },
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
    material.uniforms.uTime!.value = clock.elapsedTime;
    material.uniforms.uOpacity!.value = focused
      ? CONVOY_WIND_OPACITY * 1.2
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
  const hitBox = useMemo(() => convoyPickBox(visualSlots), [visualSlots]);
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
        <mesh name="intergalactic-convoy-hit" position={hitBox.centre} onPointerUp={pick} renderOrder={-1}>
          <boxGeometry args={hitBox.size} />
          <HitboxMaterial kind="convoy" />
        </mesh>
      ) : null}
    </group>
  );
}
