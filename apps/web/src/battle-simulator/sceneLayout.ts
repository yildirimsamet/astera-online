import { HULLS, type BattleRecording, type BattleShipSnapshot } from '@astera/rules';
import { HULL_VISUAL_SCALE } from '../galaxy/flightVisual.js';
import type { ReplayTimeline, RetreatEvent } from './timeline.js';

/** Models and their surface foundations share one recorded destruction transition. */
export function destructionScale(deathAt: number | undefined, time: number): number {
  return deathAt === undefined || time < deathAt ? 1 : Math.max(0, 1 - (time - deathAt) / .45);
}

export interface BattlePose { x: number; y: number; z: number; scale: number }
export interface BattleSphere { x: number; y: number; z: number; radius: number }

const isGround = (ship: BattleShipSnapshot) => ship.ground ?? HULLS[ship.hull].ground;
/** Guns keep full size up to 150; past that they shrink, never below 55%, so the planet stays in proportion. */
const gunScale = (count: number) => Math.max(.55, Math.min(1, Math.sqrt(150 / Math.max(1, count))));
const GUN_SPACING = 1.75, GUN_FIRST_ROW = 25 * Math.PI / 180, GUN_LAST_ROW = 80 * Math.PI / 180, GUN_HALF_ARC = 50 * Math.PI / 180;

/**
 * Gun batteries on the face the attacker sees: rows of latitude from the front edge up toward the
 * top, each row filled left to right in order, so a kind of gun reads as one belt. Null when R is too
 * small to hold them all.
 */
function gunRows(count: number, radius: number): { latitude: number; size: number }[] | null {
  const spacing = gunScale(count) * GUN_SPACING, rows: { latitude: number; size: number }[] = [];
  for (let latitude = GUN_FIRST_ROW, left = count; left > 0; latitude += spacing / radius) {
    if (latitude > GUN_LAST_ROW) return null;
    const size = Math.min(left, Math.floor(2 * GUN_HALF_ARC * radius * Math.cos(latitude) / spacing) + 1);
    rows.push({ latitude, size }); left -= size;
  }
  return rows;
}

/** The planet grows to carry its guns and to stand behind a wide defending fleet. */
export function battlePlanet(ships: readonly BattleShipSnapshot[], poses: ReadonlyMap<string, BattlePose>): BattleSphere {
  const mobile = ships.filter(ship => ship.side === 'DEFENCE' && !isGround(ship)).map(ship => poses.get(ship.id)!);
  const mobileDepth = Math.max(7, ...mobile.map(pose => pose.z));
  const width = mobile.length === 0 ? 0 : Math.max(...mobile.map(pose => pose.x)) - Math.min(...mobile.map(pose => pose.x));
  const guns = ships.filter(isGround).length;
  let radius = Math.max(6, width / 4);
  while (gunRows(guns, radius) === null) radius += .5;
  return { x: 0, y: .2 - radius * .83, z: mobileDepth + radius, radius };
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

export function focusBattleCamera(pose: BattlePose, viewer: 'ATTACK' | 'DEFENCE', aspect: number, surface?: BattleSphere, compact = false) {
  const sign = viewer === 'ATTACK' ? 1 : -1;
  const distance = Math.max(5, pose.scale * 3.5 / Math.min(1, Math.max(.2, aspect)));
  // The phone inspector occupies the lower field; put the craft in the open upper area. Under the
  // phone HUD the field can be wider than tall, so the phone is named, not guessed from the aspect.
  const lift = compact || aspect < 1 ? distance * Math.tan(43 * Math.PI / 360) * .56 : 0;
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
  const ground = recording.ships.filter(isGround).sort((a, b) => HULL_VISUAL_SCALE[b.hull] - HULL_VISUAL_SCALE[a.hull] || a.hull.localeCompare(b.hull));
  const planet = battlePlanet(recording.ships, poses);
  // A gun stands on its own plinth (`battleModelParts`): the pose is where it meets the ground.
  const scale = gunScale(ground.length), spacing = scale * GUN_SPACING, lift = .02;
  let next = 0;
  for (const row of gunRows(ground.length, planet.radius) ?? []) {
    const step = spacing / (planet.radius * Math.cos(row.latitude));
    for (let i = 0; i < row.size; i++) {
      const ship = ground[next++]!, azimuth = (i - (row.size - 1) / 2) * step;
      const nx = Math.cos(row.latitude) * Math.sin(azimuth), ny = Math.sin(row.latitude), nz = -Math.cos(row.latitude) * Math.cos(azimuth);
      const distance = planet.radius + lift;
      poses.set(ship.id, { x: planet.x + nx * distance, y: planet.y + ny * distance, z: planet.z + nz * distance, scale });
    }
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
