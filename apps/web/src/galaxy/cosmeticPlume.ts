import type { CosmeticStyle } from '@astera/rules';
import { BufferGeometry, Float32BufferAttribute } from 'three';

/** A narrow ignition throat, expanding plasma envelope, then a closed soft tip. */
export function plumeRadius(t: number, style: CosmeticStyle = 'aurora'): number {
  if (style === 'titan') return (.04 + .14 * Math.sin(Math.PI * Math.pow(t, .74))) * Math.pow(1 - t, .65);
  const base = (.055 + .24 * Math.sin(Math.PI * Math.pow(t, .65))) * Math.pow(1 - t, .55);
  if (style === 'singularity') return base * .5;
  if (style === 'helios') return base * (.35 + .65 * Math.pow(.5 + .5 * Math.cos(t * Math.PI * 12), 2));
  return base;
}
export function plumeOpacity(t: number): number {
  const smooth = (x: number) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
  return smooth(t / .07) * (1 - smooth((t - .65) / .35));
}
/** UV.x wraps the nozzle; UV.y runs from nozzle to tail. No exposed card edges. */
export function createPlumeGeometry(style: CosmeticStyle = 'aurora'): BufferGeometry {
  const positions: number[] = [], uv: number[] = [], opacity: number[] = [], indices: number[] = [];
  const rings = style === 'titan' ? 20 : 32, sides = style === 'titan' ? 10 : 12;
  for (const shell of [0, 1]) {
    const offset = positions.length / 3;
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings, radius = plumeRadius(t, style) * (shell === 0 ? 1 : .22);
      for (let side = 0; side <= sides; side++) {
        const angle = side / sides * Math.PI * 2;
        positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, -.48 - t * (style === 'titan' ? 1.85 : style === 'singularity' ? 2.65 : style === 'helios' ? 2.2 : 2.35));
        uv.push(side / sides + shell * 2, t);
        opacity.push(plumeOpacity(t));
        if (ring < rings && side < sides) {
          const a = offset + ring * (sides + 1) + side, b = a + sides + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('aEnvelope', new Float32BufferAttribute(opacity, 1));
  geometry.setIndex(indices);
  return geometry;
}
