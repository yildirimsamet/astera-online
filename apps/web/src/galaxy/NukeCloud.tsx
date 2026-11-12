import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/*
  The mushroom cloud of a Death Star strike as particles: a rolling vortex ring for the cap, a column
  flowing up into it and a base surge that follows the world's curve. Every particle is placed on the
  GPU from its seed and a handful of uniforms, so the CPU writes six numbers a frame however many
  there are. One draw. Owner, 2026-11-12: a rare strike may spend particles.

  Drawn in the strike's own space (the world's centre at the origin), so the model matrix carries
  the world's place in the galaxy and the far-zoom floor scale; view-space sizes take that scale too.
*/

const CAP = 420;
const STEM = 220;
const BASE = 180;
export const NUKE_CLOUD_PARTICLES = CAP + STEM + BASE;

const VERT = /* glsl */`
  attribute vec4 aSeed; attribute float aKind;
  uniform float uT; uniform vec3 uAxis; uniform vec3 uU; uniform vec3 uV; uniform float uR;
  uniform float uCapP; uniform float uColH; uniform float uHeat; uniform float uCap; uniform float uCol; uniform vec3 uSun;
  varying vec2 vUv; varying float vFrame; varying float vTemp; varying float vAlpha; varying float vShade;
  const float TAU = 6.28318530718;
  void main() {
    vec3 ground = uAxis * uR;
    float top = uR * (0.08 + 1.15 * uColH);
    vec3 pos; float size; float temp; float alpha; float shade = 0.85;
    if (aKind < 0.5) {
      // The cap: a torus that widens and rolls — outside up, inside down — as it climbs.
      float phi = aSeed.x * TAU + uT * 0.05;
      float major = uR * (0.1 + 0.55 * uCapP);
      float tube = uR * (0.08 + 0.4 * uCapP) * sqrt(aSeed.z);
      float psi = aSeed.y * TAU + uT * (1.1 - 0.6 * uCapP);
      vec3 radial = cos(phi) * uU + sin(phi) * uV;
      pos = ground + uAxis * (top + tube * sin(psi)) + radial * (major + tube * cos(psi));
      vec3 normal = normalize(radial * cos(psi) + uAxis * sin(psi));
      shade = 0.5 + 0.5 * max(0.0, dot(normal, uSun));
      temp = clamp(0.8 - 0.75 * sin(psi) - 0.2 * cos(psi) - 0.4 * aSeed.z, 0.0, 1.0) * uHeat;
      size = uR * (0.17 + 0.13 * aSeed.w) * (0.55 + 0.85 * uCapP);
      alpha = uCap;
    } else if (aKind < 1.5) {
      // The column: smoke flowing up from the ground into the cap, hottest at its foot.
      float h = fract(aSeed.x + uT * 0.14);
      float a = aSeed.z * TAU + uT * 0.7;
      float w = uR * (0.07 + 0.12 * aSeed.y) * (0.7 + 0.6 * uCapP) * (1.0 - 0.35 * h);
      pos = ground + uAxis * (top * h) + (cos(a) * uU + sin(a) * uV) * w;
      temp = (1.0 - h) * uHeat;
      size = uR * (0.15 + 0.09 * aSeed.w) * (0.8 + 0.5 * uCapP);
      alpha = uCol * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.86, 1.0, h));
    } else {
      // The base surge: dust thrown out over the ground, bent to the world's curve.
      float a = aSeed.x * TAU;
      float reach = uR * (0.06 + 0.95 * sqrt(uCapP)) * (0.72 + 0.28 * aSeed.y);
      vec3 level = ground + (cos(a) * uU + sin(a) * uV) * reach;
      pos = normalize(level) * uR * (1.015 + 0.04 * aSeed.z);
      temp = 0.7 * uHeat * (1.0 - uCapP);
      size = uR * (0.1 + 0.08 * aSeed.w) * (0.7 + 1.0 * uCapP);
      alpha = uCol * 0.75;
    }
    float zoom = length(modelMatrix[0].xyz);
    vec4 view = modelViewMatrix * vec4(pos, 1.0);
    view.z += uR * 0.12 * zoom;
    float spin = aSeed.w * TAU + uT * (aSeed.z - 0.5) * 0.4;
    vec2 corner = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * position.xy;
    view.xy += corner * size * zoom;
    gl_Position = projectionMatrix * view;
    vUv = uv; vTemp = temp; vAlpha = alpha; vShade = shade;
    vFrame = 18.0 + floor(aSeed.y * 26.0);
  }`;

const FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying vec2 vUv; varying float vFrame; varying float vTemp; varying float vAlpha; varying float vShade;
  void main() {
    vec2 cell = vec2(mod(vFrame, 8.0), 7.0 - floor(vFrame / 8.0));
    vec4 t = texture2D(uMap, (cell + clamp(vUv, vec2(0.01), vec2(0.99))) / 8.0);
    vec3 smoke = vec3(1.25, 1.18, 1.1) * vShade;
    vec3 hot = vec3(2.4, 1.05, 0.38);
    vec3 colour = mix(smoke, hot, vTemp) * t.rgb * 1.6;
    gl_FragColor = vec4(colour, t.a * vAlpha * 0.45);
    #include <colorspace_fragment>
  }`;

export interface NukeCloudLayer { capProgress: number; columnHeight: number; heat: number; cap: number; column: number }

export function NukeCloud({ map, radius, axis, across, sun, layer, seconds }: {
  map: THREE.Texture; radius: number; axis: THREE.Vector3; across: readonly [THREE.Vector3, THREE.Vector3];
  sun: THREE.Vector3; layer: React.RefObject<NukeCloudLayer>; seconds: React.RefObject<number>;
}) {
  const geometry = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    let seed = 1234567;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const seeds = new Float32Array(NUKE_CLOUD_PARTICLES * 4).map(() => random());
    const kinds = new Float32Array(NUKE_CLOUD_PARTICLES).map((_, i) => (i < CAP ? 0 : i < CAP + STEM ? 1 : 2));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    g.instanceCount = NUKE_CLOUD_PARTICLES;
    return g;
  }, []);
  const material = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    return new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true,
      uniforms: {
        uMap: { value: map }, uT: { value: 0 }, uAxis: { value: axis }, uU: { value: across[0] }, uV: { value: across[1] },
        uR: { value: radius }, uSun: { value: sun },
        uCapP: { value: 0 }, uColH: { value: 0 }, uHeat: { value: 1 }, uCap: { value: 0 }, uCol: { value: 0 },
      },
    });
  }, [map, axis, across, radius, sun]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(() => {
    const now = layer.current;
    const u = material.uniforms;
    u.uT!.value = seconds.current;
    u.uCapP!.value = now.capProgress;
    u.uColH!.value = now.columnHeight;
    u.uHeat!.value = now.heat;
    u.uCap!.value = now.cap;
    u.uCol!.value = now.column;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1315} name="nuke-cloud" raycast={() => null} />;
}
