import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type {
  StrategicInterception,
  StrategicInterceptionImpact,
} from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { MODEL } from '../ui/assets.js';
import { FullRate } from './frames.jsx';
import { TimedImpact, type DeathStarImpactEvent } from './DeathStarImpact.jsx';
import { Hull } from './Fleets.jsx';
import { toWorld, type PlanetNode, type Vec3Tuple } from './scene.js';
import { publicEffectIntensity } from './vfx.js';

useGLTF.preload(MODEL.missile, false);
useGLTF.preload(MODEL.deathStar, false);

type ReadonlyVec3Tuple = readonly [number, number, number];

/** The same permanent silhouette language used by identified ordinary craft. */
export const STRATEGIC_INTERCEPTION_NEON = {
  deathStar: '#ff4d67',
  battery: '#3ff08a',
} as const;

const point = (from: ReadonlyVec3Tuple, to: ReadonlyVec3Tuple, t: number): Vec3Tuple => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
];

const quadratic = (
  from: ReadonlyVec3Tuple,
  control: ReadonlyVec3Tuple,
  to: ReadonlyVec3Tuple,
  t: number,
): Vec3Tuple => {
  const u = 1 - t;
  return [
    u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
    u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    u * u * from[2] + 2 * u * t * control[2] + t * t * to[2],
  ];
};

export function strategicInterceptionPose(
  launch: ReadonlyVec3Tuple,
  control: ReadonlyVec3Tuple,
  deathStarFrom: ReadonlyVec3Tuple,
  collision: ReadonlyVec3Tuple,
  progress: number,
): { missile: Vec3Tuple; deathStar: Vec3Tuple } {
  const t = Math.max(0, Math.min(1, progress));
  return {
    missile: quadratic(launch, control, collision, t),
    deathStar: point(deathStarFrom, collision, t),
  };
}

export interface StrategicInterceptionGeometry {
  launch: Vec3Tuple;
  control: Vec3Tuple;
  deathStarFrom: Vec3Tuple;
  collision: Vec3Tuple;
  radius: number;
}

/** One geometry source for both the renderer and the camera following its missile. */
export function strategicInterceptionGeometry(
  event: StrategicInterception,
  nodes: readonly PlanetNode[],
): StrategicInterceptionGeometry {
  const target = nodes.find((node) => node.id === event.targetPlanetId);
  const centre = toWorld(event.launch);
  const collision = toWorld(event.collision);
  const deathStarFrom = toWorld(event.deathStarFrom);
  const radius = target?.radius ?? 0.82;
  const direction = new THREE.Vector3(
    collision[0] - centre[0],
    collision[1] - centre[1],
    collision[2] - centre[2],
  ).normalize();
  const launch: Vec3Tuple = [
    centre[0] + direction.x * radius * 1.15,
    centre[1] + direction.y * radius * 1.15,
    centre[2] + direction.z * radius * 1.15,
  ];
  const control: Vec3Tuple = [
    (launch[0] + collision[0]) / 2,
    (launch[1] + collision[1]) / 2 + Math.max(0.45, radius * 0.9),
    (launch[2] + collision[2]) / 2,
  ];
  return { launch, control, deathStarFrom, collision, radius };
}

export function strategicInterceptionMissilePosition(
  event: StrategicInterception,
  nodes: readonly PlanetNode[],
  now: number,
): Vec3Tuple {
  const geometry = strategicInterceptionGeometry(event, nodes);
  const span = Math.max(1, event.impactAt.getTime() - event.launchAt.getTime());
  const progress = (now - event.launchAt.getTime()) / span;
  return strategicInterceptionPose(
    geometry.launch,
    geometry.control,
    geometry.deathStarFrom,
    geometry.collision,
    progress,
  ).missile;
}

/**
 * One impact list for two audiences: entitled viewers can schedule it from the
 * private eight-second scene, while everybody else receives only the public moment
 * once it occurs. Stable ids de-duplicate the two at the boundary.
 */
export function strategicInterceptionImpactEvents(
  impacts: readonly StrategicInterceptionImpact[],
  nodes: readonly PlanetNode[],
  interceptions: readonly StrategicInterception[] = [],
): DeathStarImpactEvent[] {
  const events = new Map<string, DeathStarImpactEvent>();
  for (const interception of interceptions) {
    const target = nodes.find((node) => node.id === interception.targetPlanetId);
    events.set(interception.id, {
      id: interception.id,
      at: interception.impactAt.getTime(),
      position: toWorld(interception.collision),
      radius: Math.max(0.32, (target?.radius ?? 0.82) * 0.48),
      intensity: 1,
    });
  }
  for (const impact of impacts) {
    if (events.has(impact.id)) continue;
    events.set(impact.id, {
      id: impact.id,
      at: impact.at.getTime(),
      position: toWorld(impact.collision),
      radius: 0.4,
      intensity: publicEffectIntensity(impact.effectOnly),
    });
  }
  return [...events.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function StrategicInterceptions({
  events,
  impacts = [],
  nodes,
}: {
  events: readonly StrategicInterception[];
  impacts?: readonly StrategicInterceptionImpact[];
  nodes: readonly PlanetNode[];
}) {
  const impactEvents = strategicInterceptionImpactEvents(impacts, nodes, events);
  return (
    <>
      {events.map((event) => (
        <StrategicInterceptionScene key={event.id} event={event} nodes={nodes} />
      ))}
      {impactEvents.map((event) => <TimedImpact key={event.id} event={event} />)}
    </>
  );
}

function StrategicInterceptionScene({
  event,
  nodes,
}: {
  event: StrategicInterception;
  nodes: readonly PlanetNode[];
}) {
  const { launch, control, deathStarFrom, collision, radius } =
    strategicInterceptionGeometry(event, nodes);

  return (
    <>
      <Suspense fallback={null}>
        <InterceptionFlight
          launch={launch}
          control={control}
          deathStarFrom={deathStarFrom}
          collision={collision}
          launchAt={event.launchAt.getTime()}
          impactAt={event.impactAt.getTime()}
          radius={radius}
        />
      </Suspense>
    </>
  );
}

function InterceptionFlight({
  launch,
  control,
  deathStarFrom,
  collision,
  launchAt,
  impactAt,
  radius,
}: {
  launch: Vec3Tuple;
  control: Vec3Tuple;
  deathStarFrom: Vec3Tuple;
  collision: Vec3Tuple;
  launchAt: number;
  impactAt: number;
  radius: number;
}) {
  const root = useRef<THREE.Group>(null);
  const missile = useRef<THREE.Group>(null);
  const deathStar = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const span = Math.max(1, impactAt - launchAt);
    const t = Math.max(0, Math.min(1, (serverNow() - launchAt) / span));
    const live = t < 1;
    if (root.current) root.current.visible = live;
    if (!live) return;

    const pose = strategicInterceptionPose(
      launch,
      control,
      deathStarFrom,
      collision,
      t,
    );
    const nextPose = strategicInterceptionPose(
      launch,
      control,
      deathStarFrom,
      collision,
      Math.min(1, t + 0.002),
    );
    const rocketAt = pose.missile;
    const rocketNext = nextPose.missile;
    if (missile.current) {
      missile.current.position.set(...rocketAt);
      missile.current.lookAt(...rocketNext);
    }
    const starAt = pose.deathStar;
    const starNext = nextPose.deathStar;
    if (deathStar.current) {
      deathStar.current.position.set(...starAt);
      deathStar.current.lookAt(...starNext);
      deathStar.current.rotation.z += 0.012;
    }
    if (glow.current) {
      glow.current.position.set(...rocketAt);
      glow.current.intensity = 5 + Math.sin(t * 80) * 1.5;
    }
  });

  return (
    <group ref={root} name="strategic-interception">
      <FullRate />
      <group ref={deathStar}>
        <Hull
          url={MODEL.deathStar}
          scale={Math.max(0.34, radius * 0.48)}
          glow={STRATEGIC_INTERCEPTION_NEON.deathStar}
          focused={false}
        />
      </group>
      <group ref={missile}>
        <Hull
          url={MODEL.missile}
          scale={Math.max(0.2, radius * 0.28)}
          glow={STRATEGIC_INTERCEPTION_NEON.battery}
          focused={false}
        />
      </group>
      <pointLight ref={glow} color="#ff9c48" distance={radius * 8} decay={2} />
    </group>
  );
}
