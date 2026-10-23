import * as THREE from 'three';
import { EngineFlameBatch, type EngineFlameOptions } from '../../vfx/engineFlames.js';

/** Full-lever reach in ship lengths: a cruise flame trails the hull, a turbo flame outruns it. */
export const CRUISE_REACH = 0.7;
export const TURBO_REACH = 1.4;
/** Below this mix the Solar flames are not drawn at all. */
export const LIT = 0.001;

/**
 * One ship's exhaust: the studio's volume flames (src/vfx/engineFlames.ts), one draw per ship.
 * Every nozzle carries a Cryo flame for cruise and a Solar one for turbo; the two cross-fade
 * as turbo lights and dies, so other pilots read a boost from its colour, as before.
 * The batch sits on the ship's tilt group: nozzle positions are in metres there.
 */
export class ShipFlames {
  private readonly batch: EngineFlameBatch;
  private readonly slots: EngineFlameOptions[];

  constructor(noise: THREE.Texture, nozzles: readonly THREE.Vector3[], nozzleRadius: number, shipLength: number,
    quality: 'mobile' | 'standard' | 'high', seed: number) {
    this.batch = new EngineFlameBatch(noise, { capacity: nozzles.length * 2, quality });
    this.slots = (['cryo', 'solar'] as const).flatMap((variant, k) => nozzles.map((nozzle, i) => ({
      variant, matrix: new THREE.Matrix4().makeTranslation(nozzle.x, nozzle.y, nozzle.z),
      length: shipLength * (variant === 'cryo' ? CRUISE_REACH : TURBO_REACH), nozzleRadius, throttle: 0, seed: seed + (k * nozzles.length + i) * 17,
    })));
  }

  get mesh(): EngineFlameBatch['mesh'] { return this.batch.mesh; }

  /** `lever` 0…1 is the cruise burn; `turbo` 0…1 hands it over to the Solar flames at full burn. */
  update(lever: number, turbo: number, time: number): void {
    const half = this.slots.length / 2;
    this.slots.forEach((slot, i) => {
      slot.throttle = i < half ? lever * (1 - turbo) : turbo;
      if (i < half || turbo > LIT) this.batch.set(i, slot);
    });
    this.batch.mesh.count = turbo > LIT ? this.slots.length : half;
    this.batch.update(time);
  }

  dispose(): void { this.batch.dispose(); }
}
