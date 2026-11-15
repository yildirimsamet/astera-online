import * as THREE from 'three';

export { NUKE_FLARE as LAB_FLARE, NUKE_SMOKE as LAB_SMOKE } from '../../galaxy/NukeBlast.js';

/** Camera-facing flipbook quads sharing one source and one draw, each with its own frame, alpha and tint. */
export function flipbookBatch(map: THREE.Texture, count: number, grid: [number, number], blending: THREE.Blending) {
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const frames = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
  geometry.setAttribute('aFrame', frames);
  geometry.setAttribute('aAlpha', alpha);
  geometry.setAttribute('aTint', tint);
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uGrid: { value: new THREE.Vector2(...grid) } },
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false, blending,
    vertexShader: /* glsl */`
      attribute float aFrame; attribute float aAlpha; attribute vec3 aTint;
      varying vec2 vUv; varying float vAlpha; varying float vFrame; varying vec3 vTint;
      void main() {
        vUv = uv; vFrame = aFrame; vAlpha = aAlpha; vTint = aTint;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec2 uGrid;
      varying vec2 vUv; varying float vAlpha; varying float vFrame; varying vec3 vTint;
      vec4 tile(float frame) {
        vec2 cell = vec2(mod(frame, uGrid.x), uGrid.y - 1.0 - floor(frame / uGrid.x));
        return texture2D(uMap, (cell + clamp(vUv, vec2(0.006), vec2(0.994))) / uGrid);
      }
      void main() {
        float last = uGrid.x * uGrid.y - 1.0;
        float frame = clamp(vFrame, 0.0, last);
        vec4 texel = mix(tile(floor(frame)), tile(min(floor(frame) + 1.0, last)), fract(frame));
        gl_FragColor = vec4(texel.rgb * vTint, texel.a * vAlpha);
        #include <colorspace_fragment>
      }`,
  });
  return { geometry, material, frames, alpha, tint };
}
