import * as THREE from 'three';
import { mulberry32 } from '@astera/rules';
import type { PreparedModel } from '../assets/load.js';

/**
 * Stand-ins drawn when no local reference pack exists (production and CI). They keep
 * every gameplay shape readable; the real art comes from the owned asset set later.
 */
export function proceduralRock(seed: number, crystal = false): PreparedModel {
  const random = mulberry32(911 + seed);
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const position = geometry.getAttribute('position');
  const bumps = Array.from({ length: 7 }, () => new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize());
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    let r = 0.86;
    for (const bump of bumps) r += Math.max(0, v.dot(bump) - 0.55) * 0.35 * (random() * 0.4 + 0.8);
    v.multiplyScalar(r * (0.95 + random() * 0.06));
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: crystal ? '#3b4a55' : '#4a4d52', roughness: 0.92, metalness: 0.05, flatShading: true });
  const parts = [{ geometry, material, glow: false }];
  if (crystal) {
    const shard = new THREE.OctahedronGeometry(0.42, 0).scale(0.5, 1.6, 0.5).translate(0, 0.9, 0);
    parts.push({ geometry: shard, material: new THREE.MeshStandardMaterial({ color: '#9ff6ff', emissive: '#36e6ff', emissiveIntensity: 1.6 }), glow: true });
  }
  geometry.computeBoundingSphere();
  return { parts, radius: 1, mean: 0.95, size: new THREE.Vector3(2, 2, 2), engines: [] };
}

export function proceduralShip(tint = '#9fb0c2'): PreparedModel {
  const hull = new THREE.MeshStandardMaterial({ color: tint, metalness: 0.7, roughness: 0.35 });
  const body = new THREE.ConeGeometry(0.16, 1, 6).rotateX(Math.PI / 2);
  const wing = new THREE.BoxGeometry(0.9, 0.04, 0.3).translate(0, -0.03, -0.18);
  const pods = [-0.3, 0.3].map(x => new THREE.CylinderGeometry(0.07, 0.08, 0.5, 10).rotateX(Math.PI / 2).translate(x, 0, -0.2));
  const parts = [body, wing, ...pods].map(geometry => ({ geometry, material: hull, glow: false }));
  return { parts, radius: 0.55, mean: 0.4, size: new THREE.Vector3(0.9, 0.3, 1), engines: [[-0.3, 0, -0.45], [0.3, 0, -0.45]] };
}
