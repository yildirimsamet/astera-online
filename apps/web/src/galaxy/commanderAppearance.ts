import * as THREE from 'three';
import { createShipDriveGeometry } from './shipSkinDrive.js';

const isMaterial = (value: unknown): value is THREE.Material => value instanceof THREE.Material;

/** Galaxy-only copies: the hangar and Rift retain the loader's original materials. */
export function createCommanderHull(source: THREE.Object3D) {
  const scene = source.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  const polish = (original: THREE.Material): THREE.Material => {
    const cached = materials.get(original); if (cached) return cached;
    let material: THREE.Material;
    if (original instanceof THREE.MeshStandardMaterial) {
      const coat = new THREE.MeshPhysicalMaterial();
      // Copy every Standard map/property; Physical.copy expects an already Physical source.
      THREE.MeshStandardMaterial.prototype.copy.call(coat, original);
      coat.defines = { STANDARD: '', PHYSICAL: '' };
      coat.roughness = Math.max(0.24, Math.min(0.46, original.roughness * 0.65));
      coat.metalness = Math.min(0.7, original.metalness); coat.envMapIntensity = 1.15;
      coat.clearcoat = 0.65; coat.clearcoatRoughness = 0.16;
      coat.clearcoatNormalMap = original.normalMap;
      coat.clearcoatNormalScale.copy(original.normalScale).multiplyScalar(0.35);
      material = coat;
    } else material = original.clone();
    materials.set(original, material); return material;
  };
  let coarsest = -1;
  scene.traverse(node => { const lod = /^lod(\d)$/.exec(node.name); if (lod) coarsest = Math.max(coarsest, Number(lod[1])); });
  scene.traverse(node => {
    const lod = /^lod(\d)$/.exec(node.name); if (lod && coarsest >= 0) node.visible = Number(lod[1]) === coarsest;
    if (node instanceof THREE.Mesh) {
      const current: unknown = node.material;
      if (isMaterial(current)) node.material = polish(current);
      else if (Array.isArray(current)) node.material = current.filter(isMaterial).map(polish);
    }
  });
  return { scene, dispose: (): void => { for (const material of materials.values()) material.dispose(); } };
}

/** Existing closed plasma shells, nozzle at zero and tail one unit down local -Z. */
export function createCommanderExhaust(): THREE.BufferGeometry {
  const geometry = createShipDriveGeometry(); geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (bounds) geometry.scale(1, 1, 1 / (bounds.max.z - bounds.min.z));
  geometry.computeVertexNormals();
  // Collapsed tail vertices have no triangle area; give them a finite direction for the shader.
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) {
    if (normals.getX(i) === 0 && normals.getY(i) === 0 && normals.getZ(i) === 0) normals.setXYZ(i, 0, 0, -1);
  }
  return geometry;
}

/** Soft plasma below the bloom threshold, with a white core and a fading blue envelope. */
export function createCommanderExhaustMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide, toneMapped: false,
    vertexShader: `
      attribute float aEnvelope;
      varying vec2 vUv; varying float vEnvelope; varying float vFacing;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vUv = uv; vEnvelope = aEnvelope;
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-view.xyz)));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv; varying float vEnvelope; varying float vFacing;
      void main() {
        float core = step(1.5, vUv.x);
        float flow = .84 + .16 * sin(vUv.y * 28.0 - uTime * 8.0 + vUv.x * 6.283185);
        vec3 heat = mix(vec3(.62, .68, .72), vec3(.12, .32, .53), clamp(vUv.y * 1.6, 0.0, 1.0));
        heat *= mix(.7, 1.0, core);
        float alpha = vEnvelope * mix(.22, .48, core) * flow * (1.0 - vUv.y * .5);
        alpha *= smoothstep(0.0, .55, vFacing);
        gl_FragColor = vec4(heat, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Around a third to three fifths of a hull long; the smallest nozzle remains readable. */
export const commanderExhaustScale = (nozzle: number): [number, number, number] =>
  [nozzle / 0.055 * 0.75, nozzle / 0.055 * 0.75, Math.max(0.32, nozzle * 10)];
