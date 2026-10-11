import * as THREE from 'three';

/** Shared pixels, owned UV state: simultaneous effects must never advance each other. */
export function ownedAtlas(source: THREE.Texture, grid: number): THREE.Texture {
  const texture = source.clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.repeat.set(1 / grid, 1 / grid);
  atlasFrame(texture, 0, grid);
  return texture;
}

/** Row-major source sheets begin at the top left. Exact end remains on the last frame. */
export function atlasFrame(texture: THREE.Texture, progress: number, grid: number): void {
  const safe = Number.isFinite(progress) ? progress : 0;
  const frame = Math.min(grid * grid - 1, Math.max(0, Math.floor(safe * grid * grid)));
  texture.offset.set((frame % grid) / grid, 1 - (Math.floor(frame / grid) + 1) / grid);
}
