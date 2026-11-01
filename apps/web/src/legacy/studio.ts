import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Neutral surround and retained softboxes: metal reflects both dark fields and bright edges. */
export function awardStudioRoom(): RoomEnvironment {
  const room = new RoomEnvironment();
  room.traverse(object => {
    if (object instanceof THREE.PointLight) object.intensity = 700;
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    if (object.material instanceof THREE.MeshStandardMaterial) object.material.color.set('#a0a6b0');
    else if (object.material instanceof THREE.MeshLambertMaterial) object.material.emissiveIntensity *= 0.7;
  });
  return room;
}
