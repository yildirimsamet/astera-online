import * as THREE from 'three';
import { fbm } from './nebula.js';

/**
 * Shared smoke density, baked once with the galactic dust's warped noise and
 * subtractive lanes. A 48³ R8 volume is 108 KiB; sampling it keeps noise generation
 * out of the five clouds' fragment shaders. The spherical falloff lives in the
 * shader, so this field can rotate without changing the physical boundary.
 */
export function paintRadiationVolume(): THREE.Data3DTexture {
  const size = 48;
  const data = new Uint8Array(size ** 3);
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x / (size - 1) - 0.5) * 7;
        const ny = (y / (size - 1) - 0.5) * 7;
        const nz = (z / (size - 1) - 0.5) * 7;
        const warp = fbm(nx + 12.3, ny - 4.1, nz + 0.7, 3) * 2.1;
        const filaments = fbm(nx + warp, ny - warp * 0.7, nz + warp * 0.5, 4);
        const dust = fbm(nx * 1.8 - 5.5, ny * 1.8 + 7.7, nz * 1.8 + 3.9, 2);
        const smoke = Math.min(1, Math.max(0, (filaments - 0.28) / 0.48)) ** 1.7;
        const absorption = 1 - Math.min(0.85, Math.max(0, dust - 0.35) * 1.8);
        data[x + size * (y + size * z)] = Math.round(smoke * absorption * 255);
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
