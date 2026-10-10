import { cosmeticById } from '@astera/rules';
import { CylinderGeometry } from 'three';

const UFO = cosmeticById('probe-ufo');

/** The effect belongs to this product's real and inspection models, never a filename prefix. */
export function hasProbeSkinBeam(url: string): boolean {
  return url === UFO?.model || url === UFO?.previewModel;
}

/** Relative to a one-unit-wide body; an open volume fades out instead of drawing a floor. */
export function createProbeBeamGeometry(): CylinderGeometry {
  const geometry = new CylinderGeometry(.1, .56, 1.2, 48, 8, true);
  geometry.translate(0, -.75, 0);
  return geometry;
}

export const probeBeamVertex = `
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  void main() {
    vUv = uv;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const probeBeamFragment = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  void main() {
    float down = 1.0 - vUv.y;
    float ends = smoothstep(0.0, 0.08, down) * (1.0 - smoothstep(0.16, 0.98, down));
    float facing = pow(abs(dot(normalize(vViewNormal), normalize(-vViewPosition))), 1.8);
    float pulse = 0.97 + 0.03 * sin(uTime * 0.55);
    float alpha = 0.085 * ends * facing * (1.0 - down * 0.3) * pulse;
    gl_FragColor = vec4(0.94, 0.975, 1.0, alpha);
  }
`;
