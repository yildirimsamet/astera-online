import { HULLS, type BattleRecording, type BattleShipSnapshot } from '@astera/rules';
import { HULL_VISUAL_SCALE } from '../galaxy/flightVisual.js';
import type { ReplayTimeline, RetreatEvent } from './timeline.js';

/** Models and their surface foundations share one recorded destruction transition. */
export function destructionScale(deathAt: number | undefined, time: number): number {
  return deathAt === undefined || time < deathAt ? 1 : Math.max(0, 1 - (time - deathAt) / .45);
}

export interface BattlePose { x: number; y: number; z: number; scale: number }
export interface BattleSphere { x: number; y: number; z: number; radius: number }

export function battlePlanet(ships: readonly BattleShipSnapshot[], poses: ReadonlyMap<string, BattlePose>): BattleSphere {
  const mobileDepth = Math.max(7, ...ships.filter(ship => ship.side === 'DEFENCE' && !(ship.ground ?? HULLS[ship.hull].ground)).map(ship => poses.get(ship.id)!.z));
  return { x: 0, y: -4.8, z: mobileDepth + 6, radius: 6 };
}

/** Keep a world-anchored name readable when its craft approaches the viewport edge. */
export function fitWorldLabel(anchorX: number, width: number, viewport: number): number {
  return Math.max(8, Math.min(viewport - width - 8, anchorX - width / 2)) - (anchorX - width / 2);
}

/** Parking slots are visual only. They never enter the combat roster or target pool. */
export function retreatDestinations(timeline: ReplayTimeline, poses: ReadonlyMap<string, BattlePose>) {
  const slots = new Map<string, BattlePose>();
  const right = Math.max(3, ...[...poses.values()].map(pose => pose.x + pose.scale));
  for (const side of ['ATTACK', 'DEFENCE'] as const) {
    const ships = timeline.recording.ships.filter(ship => ship.side === side);
    const ids = new Set(ships.map(ship => ship.id));
    const escaped = timeline.events.filter((event): event is RetreatEvent => event.kind === 'RETREAT' && ids.has(event.shipId));
    const columns = Math.max(1, Math.ceil(Math.sqrt(escaped.length)));
    const sign = side === 'ATTACK' ? -1 : 1;
    const back = Math.max(5, ...ships.map(ship => Math.abs(poses.get(ship.id)!.z)));
    escaped.forEach((event, index) => {
      const pose = poses.get(event.shipId)!;
      slots.set(event.shipId, { x: right + 3 + index % columns * 1.4, y: .2,
        z: sign * (back + Math.floor(index / columns) * 1.4), scale: pose.scale * .65 });
    });
  }
  return slots;
}

/** Turn first, then follow a smooth flight path and remain parked, alive. Rewinds are pure. */
export function sampleRetreatPose(origin: BattlePose, destination: BattlePose, side: 'ATTACK' | 'DEFENCE', age: number) {
  const yaw = side === 'ATTACK' ? 0 : Math.PI;
  if (age <= 0) return { ...origin, yaw };
  const progress = Math.max(0, Math.min(1, (age - .22) / 1.25));
  const ease = progress * progress * (3 - 2 * progress);
  const heading = Math.atan2(destination.x - origin.x, destination.z - origin.z);
  const turn = Math.min(1, age / .3);
  const delta = Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw));
  return { x: origin.x + (destination.x - origin.x) * ease,
    y: origin.y + (destination.y - origin.y) * ease + Math.sin(progress * Math.PI) * .7,
    z: origin.z + (destination.z - origin.z) * ease,
    scale: origin.scale + (destination.scale - origin.scale) * ease, yaw: yaw + delta * turn };
}

/** Fit the actual perspective projection, including the rear line in either view. */
export function fitBattleCamera(poses: ReadonlyMap<string, BattlePose>, viewer: 'ATTACK' | 'DEFENCE', aspect: number) {
  const sign = viewer === 'ATTACK' ? 1 : -1;
  const points = [...poses.values()].flatMap(pose => [-.5, .5].flatMap(x => [-.5, 1].flatMap(y => [-.5, .5].map(z =>
    ({ x: sign * (pose.x + x * pose.scale), y: pose.y + y * pose.scale, z: sign * (pose.z + z * pose.scale) })))));
  const center = points.length === 0 ? { x: 0, y: 0, z: 0 } : {
    x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
    y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2,
    z: (Math.min(...points.map(p => p.z)) + Math.max(...points.map(p => p.z))) / 2,
  };
  const length = Math.hypot(.82, .58), up = .82 / length, back = -.58 / length;
  const tangent = Math.tan(43 * Math.PI / 360);
  let distance = 25;
  for (const point of points) {
    const x = point.x - center.x, y = point.y - center.y, z = point.z - center.z;
    const depth = y * up + z * back;
    distance = Math.max(distance, depth + 1.18 * Math.abs(x) / (tangent * Math.max(.1, aspect)),
      depth + 1.18 * Math.abs(-y * back + z * up) / tangent);
  }
  return { center, position: { x: center.x, y: center.y + up * distance, z: center.z + back * distance } };
}

/** Real recordings can exceed the editor's fleet size; orbit and clipping follow the actual extent. */
export function battleCameraRange(poses: ReadonlyMap<string, BattlePose>, aspect: number) {
  const fit = fitBattleCamera(poses, 'ATTACK', aspect);
  const distance = Math.hypot(fit.position.x - fit.center.x, fit.position.y - fit.center.y, fit.position.z - fit.center.z);
  const radius = Math.max(1, ...[...poses.values()].map(pose => Math.hypot(pose.x - fit.center.x, pose.y - fit.center.y, pose.z - fit.center.z) + pose.scale));
  const maxDistance = Math.max(260, distance * 2.5);
  return { maxDistance, far: Math.max(600, maxDistance + radius + 50) };
}

export function focusBattleCamera(pose: BattlePose, viewer: 'ATTACK' | 'DEFENCE', aspect: number, surface?: BattleSphere) {
  const sign = viewer === 'ATTACK' ? 1 : -1;
  const distance = Math.max(5, pose.scale * 3.5 / Math.min(1, Math.max(.2, aspect)));
  // The phone inspector occupies the lower field; put the craft in the open upper area.
  const lift = aspect < 1 ? distance * Math.tan(43 * Math.PI / 360) * .56 : 0;
  if (surface) {
    const radius = Math.hypot(pose.x - surface.x, pose.y - surface.y, pose.z - surface.z);
    const nx = (pose.x - surface.x) * sign / radius, ny = (pose.y - surface.y) / radius, nz = (pose.z - surface.z) * sign / radius;
    const upLength = Math.hypot(-nx * ny, 1 - ny * ny, -nz * ny);
    const center = { x: pose.x * sign + nx * ny / upLength * lift,
      y: pose.y - (1 - ny * ny) / upLength * lift, z: pose.z * sign + nz * ny / upLength * lift };
    return { center, position: { x: center.x + nx * distance, y: center.y + ny * distance, z: center.z + nz * distance } };
  }
  const center = { x: pose.x * sign, y: pose.y - lift * .58, z: pose.z * sign - lift * .82 };
  return { center, position: { x: center.x, y: center.y + distance * .82, z: center.z - distance * .58 } };
}
const role = (ship: BattleShipSnapshot) => ship.hull === 'NULLIFIER' ? 0 : (ship.cls ?? HULLS[ship.hull].cls) === 'SUPPORT' ? 2 : 1;

/** Canonical slots are independent of firing order; specialised front and protected rear remain legible. */
export function layoutBattle(recording: BattleRecording): Map<string, BattlePose> {
  const poses = new Map<string, BattlePose>();
  for (const side of ['ATTACK', 'DEFENCE'] as const) {
    let depth = 4.5;
    for (const rank of [0, 1, 2]) {
      const ships = recording.ships.filter(ship => ship.side === side && !(ship.ground ?? HULLS[ship.hull].ground) && role(ship) === rank)
        .sort((a, b) => HULL_VISUAL_SCALE[b.hull] - HULL_VISUAL_SCALE[a.hull]);
      let row: { id: string; x: number; scale: number }[] = [], used = 0, height = 0;
      const flush = () => {
        for (const ship of row) poses.set(ship.id, { x: ship.x - (used - .65) / 2, y: .2,
          z: side === 'ATTACK' ? -depth : depth, scale: ship.scale });
        if (row.length > 0) depth += height + .9;
        row = []; used = 0; height = 0;
      };
      for (const ship of ships) {
        const scale = Math.max(1.15, HULL_VISUAL_SCALE[ship.hull] * 1.1);
        if (row.length >= 16) flush();
        row.push({ id: ship.id, x: used + scale / 2, scale });
        used += scale + .65; height = Math.max(height, scale);
      }
      flush();
      if (ships.length > 0) depth += .4;
    }
  }
  const ground = recording.ships.filter(ship => ship.ground ?? HULLS[ship.hull].ground);
  const planet = battlePlanet(recording.ships, poses);
  for (let i = 0; i < ground.length; i++) {
    const ship = ground[i]!;
    const radius = planet.radius * (.66 + .27 * Math.sqrt((i + .5) / ground.length));
    const angle = ((i * .618033988749895) % 1 - .5) * 2;
    const x = Math.sin(angle) * radius, z = planet.z - Math.cos(angle) * radius;
    const scale = Math.min(1, 7 / Math.sqrt(ground.length));
    const lift = scale * .55 + .08;
    const nx = x / planet.radius, ny = Math.sqrt(planet.radius ** 2 - radius ** 2) / planet.radius, nz = (z - planet.z) / planet.radius;
    poses.set(ship.id, { x: x + nx * lift, z: z + nz * lift,
      y: planet.y + ny * (planet.radius + lift), scale });
  }
  // A wider defence must not place the attacking front inside the shared shield.
  const { aegis } = battlefieldEnvironment(recording, poses);
  let retreat = 0;
  for (const ship of recording.ships.filter(ship => ship.side === 'ATTACK')) {
    const pose = poses.get(ship.id)!;
    const radius = aegis.radius + pose.scale + .6;
    const transverse = (pose.x - aegis.x) ** 2 + (pose.y - aegis.y) ** 2;
    const front = aegis.z - Math.sqrt(Math.max(0, radius ** 2 - transverse));
    retreat = Math.max(retreat, pose.z - front);
  }
  if (retreat > 0) for (const ship of recording.ships.filter(ship => ship.side === 'ATTACK')) poses.get(ship.id)!.z -= retreat;
  return poses;
}

/** One shared shape defines the protective field, ray interception and camera composition. */
export function battlefieldEnvironment(recording: BattleRecording, poses: ReadonlyMap<string, BattlePose>) {
  const planet = battlePlanet(recording.ships, poses);
  const radius = Math.max(planet.radius + 1, ...recording.ships.filter(ship => ship.side === 'DEFENCE').map(ship => {
    const pose = poses.get(ship.id)!;
    return Math.hypot(pose.x - planet.x, pose.y - planet.y, pose.z - planet.z) + pose.scale * .8 + .6;
  }));
  return { planet, aegis: { ...planet, radius } };
}

export function shieldIntercept(from: Pick<BattlePose, 'x' | 'y' | 'z'>, to: Pick<BattlePose, 'x' | 'y' | 'z'>, shield: BattleSphere) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const ox = from.x - shield.x, oy = from.y - shield.y, oz = from.z - shield.z;
  const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz);
  const c = ox * ox + oy * oy + oz * oz - shield.radius * shield.radius;
  const discriminant = Math.max(0, b * b - 4 * a * c);
  const t = a > 0 ? Math.max(0, Math.min(1, (-b - Math.sqrt(discriminant)) / (2 * a))) : 0;
  return { x: from.x + dx * t, y: from.y + dy * t, z: from.z + dz * t };
}
