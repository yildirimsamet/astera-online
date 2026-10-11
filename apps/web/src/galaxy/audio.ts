import * as THREE from 'three';
import { playSound, type SoundCue } from '../lib/sound.js';

const view = new THREE.Vector3();

/** Call only for a new visible event. Wide-map activity stays quiet; close subjects have presence. */
export function playSceneSound(cue: SoundCue, position: THREE.Vector3, camera: THREE.Camera, intensity: number, key: string): void {
  const distance = camera.position.distanceTo(position);
  if (distance >= 70 || intensity <= 0 || !Number.isFinite(distance)) return;
  view.copy(position).applyMatrix4(camera.matrixWorldInverse);
  // Events behind the viewer do not become an audible source of map information.
  if (view.z >= 0) return;
  const pan = view.x / Math.max(1, distance * 0.65);
  view.copy(position).project(camera);
  if (Math.abs(view.x) > 1.08 || Math.abs(view.y) > 1.08 || view.z < -1 || view.z > 1) return;
  playSound(cue, {
    gain: (1 - distance / 70) ** 1.3 * intensity,
    pan,
    key,
  });
}
