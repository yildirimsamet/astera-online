import * as THREE from 'three';
import { ARENA_CATALOG, SHIP_CLASSES, classTuning, decodeEntry, hullCapsule, type ArenaLayout, type Capsule, type ShipClass } from '@astera/rules/arena';

interface Pose { position: THREE.Vector3; quaternion: THREE.Quaternion }
interface Hull { group: THREE.Group; ship: ShipClass; capsules: readonly { mesh: THREE.Mesh; half: number; radius: number }[] }

export interface ColliderView {
  visible: boolean;
  /** Rock wireframes, one instanced draw per catalog shape; `ids[i]` is instance i's obstacle. */
  readonly rocks: readonly { mesh: THREE.InstancedMesh; ids: readonly number[] }[];
  /** One hull per ship slot, its class's capsules in the simulation's order. */
  readonly hulls: readonly Hull[];
  /** Places one hull of the ship's class per pose (the drawn ship's position and unbanked turn); the rest hide. */
  ships(poses: readonly { pose: Pose; ship: ShipClass }[]): void;
  dispose(): void;
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const up = new THREE.Vector3(0, 1, 0);

/**
 * Developer view (plan §8.4): what the simulation hits, in wireframe over what is drawn —
 * every rock, box and ball collider, and each ship's hull capsules on its unbanked pose.
 * Off until switched on; ships are placed only while it is on.
 */
export function createColliderView(scene: THREE.Scene, layout: ArenaLayout): ColliderView {
  const root = new THREE.Group();
  root.name = 'colliders'; root.visible = false;
  scene.add(root);
  const wire = (color: string): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false, fog: false, toneMapped: false });
  const rockWire = wire('#ff4fd8'); const structureWire = wire('#ffd34f'); const hullWire = wire('#4fff9a');
  const geometries: THREE.BufferGeometry[] = [];

  const shapes = new Map<number, number[]>();
  for (const o of layout.obstacles) {
    if (o.shape !== 'mesh') continue;
    const ids = shapes.get(o.mesh) ?? [];
    ids.push(o.id); shapes.set(o.mesh, ids);
  }
  const position = new THREE.Vector3(); const turn = new THREE.Quaternion(); const scale = new THREE.Vector3(); const matrix = new THREE.Matrix4();
  const rocks = Array.from(shapes, ([shape, ids]) => {
    const geometry = new THREE.BufferGeometry();
    const entry = ARENA_CATALOG[shape];
    if (entry) {
      const { positions, indices } = decodeEntry(entry);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    geometries.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, rockWire, ids.length);
    mesh.name = 'collider-rock'; mesh.frustumCulled = false;
    ids.forEach((id, i) => {
      const o = layout.obstacles[id];
      if (o?.shape !== 'mesh') return;
      mesh.setMatrixAt(i, matrix.compose(position.set(o.p.x, o.p.y, o.p.z), turn.set(o.q.x, o.q.y, o.q.z, o.q.w), scale.setScalar(o.scale)));
    });
    root.add(mesh);
    return { mesh, ids };
  });
  for (const o of layout.obstacles) {
    if (o.shape === 'mesh') continue;
    const geometry = o.shape === 'box' ? new THREE.BoxGeometry(o.hx * 2, o.hy * 2, o.hz * 2) : new THREE.SphereGeometry(o.radius, 16, 10);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, structureWire);
    mesh.name = o.shape === 'box' ? 'collider-box' : 'collider-sphere';
    mesh.position.set(o.p.x, o.p.y, o.p.z);
    // Local +X is (ux, 0, uz): a turn of atan2(-uz, ux) about +Y.
    if (o.shape === 'box') mesh.rotation.y = Math.atan2(-o.uz, o.ux);
    root.add(mesh);
  }

  // Each class's capsules in the ship's own frame, from the same function the simulation uses.
  const capsule: Capsule = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0 };
  const shapesOf = (ship: ShipClass) => Array.from({ length: classTuning(ship).capsules.length }, (_, k) => {
    hullCapsule(IDENTITY, k, classTuning(ship), capsule);
    const a = new THREE.Vector3(capsule.ax, capsule.ay, capsule.az); const b = new THREE.Vector3(capsule.bx, capsule.by, capsule.bz);
    const half = a.distanceTo(b) / 2;
    const geometry = new THREE.CapsuleGeometry(capsule.r, half * 2, 4, 10);
    geometries.push(geometry);
    const axis = b.clone().sub(a);
    return { geometry, half, radius: capsule.r, centre: a.clone().add(b).multiplyScalar(0.5),
      turn: axis.lengthSq() > 0 ? new THREE.Quaternion().setFromUnitVectors(up, axis.normalize()) : new THREE.Quaternion() };
  });
  const hullShapes = new Map(SHIP_CLASSES.map(ship => [ship, shapesOf(ship)]));
  const hulls: Hull[] = [];
  const hull = (ship: ShipClass): Hull => {
    const group = new THREE.Group();
    const capsules = (hullShapes.get(ship) ?? []).map(({ geometry, half, radius, centre, turn: tilt }) => {
      const mesh = new THREE.Mesh(geometry, hullWire);
      mesh.name = 'collider-hull'; mesh.position.copy(centre); mesh.quaternion.copy(tilt);
      group.add(mesh);
      return { mesh, half, radius };
    });
    root.add(group);
    return { group, ship, capsules };
  };

  return {
    get visible(): boolean { return root.visible; },
    set visible(on: boolean) { root.visible = on; },
    rocks, hulls,
    ships(poses) {
      poses.forEach(({ ship }, i) => {
        const item = hulls[i];
        if (item?.ship === ship) return;
        if (item) root.remove(item.group);
        hulls[i] = hull(ship);
      });
      hulls.forEach((item, i) => {
        const pose = poses[i]?.pose;
        item.group.visible = pose !== undefined;
        if (pose) { item.group.position.copy(pose.position); item.group.quaternion.copy(pose.quaternion); }
      });
    },
    dispose() {
      scene.remove(root);
      for (const geometry of geometries) geometry.dispose();
      rockWire.dispose(); structureWire.dispose(); hullWire.dispose();
      for (const { mesh } of rocks) mesh.dispose();
    },
  };
}
