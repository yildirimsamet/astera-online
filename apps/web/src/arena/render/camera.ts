import * as THREE from 'three';
import { closestSurface, queryObstacles, type ArenaLayout, type SurfacePoint } from '@astera/rules/arena';

/** The ship pose the camera follows this frame (already interpolated). */
export interface ChasePose {
  position: THREE.Vector3; quaternion: THREE.Quaternion; speed: number; speedMax: number;
  /** Forward acceleration this tick, m/s². */
  accel: number;
  turbo: boolean; landed: boolean; omegaYaw: number; omegaPitch: number;
}

/**
 * Chase camera with rotational lag and look-ahead (a "spring arm" with camera lag).
 *
 * The arm hangs behind the ship in a LAGGED copy of the ship's orientation, while the
 * camera aims at a point AHEAD of the ship along its TRUE heading. In a turn the ship
 * swings ahead of the arm, so it slides towards the outside of the screen and shows its
 * flank; pulling up drops the arm below and the camera tilts up after the nose. Flying
 * straight, both agree and the ship sits still at the bottom centre.
 *
 * The arm is also a spring along the flight line: acceleration throws the ship ahead of
 * the lens, and once the speed settles the camera reels it back in. That transient, not
 * a longer arm, is what reads as being shoved forward; braking does the reverse.
 */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly lagged = new THREE.Quaternion();
  private readonly arm = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private readonly nearby: number[] = [];
  private readonly surface: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
  private pull = 0;
  private surgeKick = 0;
  private accel = 0;
  private turbo = 0;
  private roll = 0;
  private trauma = 0;
  private time = 0;
  private fov = 70;
  private started = false;

  constructor(private readonly shipLength: number, private readonly layout: ArenaLayout | null) {
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.5, 30000);
  }

  /** Adds screen shake; it decays by itself. 1 is a heavy hit. */
  kick(amount: number): void { this.trauma = Math.min(1, this.trauma + amount); }


  snap(): void { this.started = false; }

  update(pose: ChasePose, dt: number, aspect: number): void {
    const step = Math.min(0.1, Math.max(0, dt));
    this.time += step;
    if (!this.started) { this.lagged.copy(pose.quaternion); this.pull = 0; this.started = true; }
    // Rotational lag: a tighter spring on the ground, where the ship only yaws in place.
    this.lagged.slerp(pose.quaternion, 1 - Math.exp(-step * (pose.landed ? 4 : 6.5)));
    const speed = Math.min(1.8, pose.speed / pose.speedMax);
    this.turbo += ((pose.turbo ? 1 : 0) - this.turbo) * (1 - Math.exp(-step * (pose.turbo ? 6 : 2)));
    const pullTarget = Math.min(1, speed) * 0.28 + Math.max(0, speed - 1) * 0.2 + this.turbo * 0.15;
    this.pull += (pullTarget - this.pull) * (1 - Math.exp(-step * 1.8));
    // 240 m/s² (a turbo kick) = 1; braking is gentler and only pulls the ship slightly in.
    const shove = Math.max(-0.4, Math.min(1, pose.accel / 240));
    this.accel += (shove - this.accel) * (1 - Math.exp(-step * 9));
    this.surgeKick += (this.accel * 0.75 - this.surgeKick) * (1 - Math.exp(-step * 4));
    const L = this.shipLength;
    this.arm.set(0, L * (pose.landed ? 0.7 : 0.48), -L * (2.05 + this.pull + this.surgeKick)).applyQuaternion(this.lagged).add(pose.position);
    this.look.set(0, L * 0.42, L * 3.2).applyQuaternion(pose.quaternion).add(pose.position);
    this.up.set(0, 1, 0).applyQuaternion(this.lagged);
    this.keepOutOfRock(pose.position);
    const cam = this.camera;
    cam.position.copy(this.arm);
    cam.up.copy(this.up);
    cam.lookAt(this.look);
    // A little roll into the turn, never the full bank of the hull.
    this.roll += (-pose.omegaYaw * 0.07 - this.roll) * (1 - Math.exp(-step * 5));
    cam.rotateZ(this.roll);
    // Trauma shake: squared falloff so small hits stay small. Turbo keeps a faint rumble.
    this.trauma = Math.max(Math.max(this.turbo * 0.15, this.accel * 0.55), this.trauma - step * 1.5);
    const shake = this.trauma * this.trauma;
    if (shake > 0) {
      const t = this.time;
      cam.rotateX(shake * 0.012 * (Math.sin(t * 47.3) + Math.sin(t * 29.1 + 1.7) * 0.6));
      cam.rotateY(shake * 0.012 * (Math.sin(t * 41.7 + 0.4) + Math.sin(t * 23.9 + 2.3) * 0.6));
      cam.rotateZ(shake * 0.018 * Math.sin(t * 37.1 + 0.9));
    }
    const base = aspect < 1 ? 72 : 56;
    const target = base + Math.min(1, speed) * 4 + this.turbo * 10 + Math.max(0, this.accel) * 9;
    this.fov += (target - this.fov) * (1 - Math.exp(-step * (target > this.fov ? 7 : 2.5)));
    if (Math.abs(cam.fov - this.fov) > 0.01 || Math.abs(cam.aspect - aspect) > 1e-4) {
      cam.fov = this.fov; cam.aspect = aspect; cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }

  /**
   * Pulls the arm in towards the ship rather than letting the lens sit inside rock or a
   * structure's wall, measured against the same surfaces the ships collide with.
   */
  private keepOutOfRock(ship: THREE.Vector3): void {
    if (!this.layout) return;
    const layout = this.layout;
    const margin = 2.5;
    const p = this.arm;
    const count = queryObstacles(layout, p.x - margin, p.y - margin, p.z - margin, p.x + margin, p.y + margin, p.z + margin, this.nearby);
    for (let k = 0; k < count; k++) {
      const o = layout.obstacles[this.nearby[k] ?? -1];
      if (!o) continue;
      const index = this.nearby[k] ?? -1;
      const inside = (point: THREE.Vector3): boolean =>
        closestSurface(layout, index, point, margin, this.surface) && (this.surface.inside === true || this.surface.d < margin);
      if (!inside(p)) continue;
      // Binary search along ship → arm for the last point outside.
      let lo = 0; let hi = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        this.probe.lerpVectors(ship, p, mid);
        if (inside(this.probe)) hi = mid; else lo = mid;
      }
      p.lerpVectors(ship, p, Math.max(0.25, lo));
    }
  }
}
