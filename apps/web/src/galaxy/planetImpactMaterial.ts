import * as THREE from 'three';
import type { PlanetNode } from './scene.js';

interface ImpactNode { state?: PlanetNode['state'] }

/** Bound the art work to five finishes while the authoritative counter keeps every hit. */
export function planetImpactLevel(node: ImpactNode): number {
  if (node.state?.kind === 'RECOVERY') return 1;
  if (node.state?.kind !== 'EMP') return 0;
  return Math.min(5, Math.max(1, node.state.hits ?? 1));
}

/**
 * THE WORLDS THAT CARRY A DEATH STAR'S EMBER, AND HOW HARD EACH BURNS. Owner, 2026-10-16: from
 * the whole disc a player should be able to tell a world took a strike. Only a live EMP carries
 * it — the legacy RECOVERY finish keeps its fissures but no ember.
 */
export function planetEmbers<T extends ImpactNode>(nodes: readonly T[]): { node: T; level: number }[] {
  return nodes.flatMap((node) => node.state?.kind === 'EMP' ? [{ node, level: planetImpactLevel(node) }] : []);
}

export function planetImpactGroups<T extends ImpactNode>(nodes: readonly T[]): { level: number; nodes: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const node of nodes) {
    const level = planetImpactLevel(node);
    const group = groups.get(level);
    if (group) group.push(node);
    else groups.set(level, [node]);
  }
  return [...groups].map(([level, members]) => ({ level, nodes: members }));
}

const masks = new Map<number, THREE.Texture>();
const grain = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 31.7) * 43758.5453;
  return value - Math.floor(value);
};

/** One shared spherical mask per finish; earlier fissures stay as the next hit adds more. */
function impactMask(level: number): THREE.Texture {
  const cached = masks.get(level);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Planet impact mask needs a 2D canvas');
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(2, 2);
  context.globalCompositeOperation = 'lighter';
  const centres = [[40, 112], [125, 146], [210, 102], [295, 141], [380, 108], [465, 148]] as const;
  centres.forEach(([x, y], centre) => {
    for (let ray = 0; ray < 3 + level * 2; ray++) {
      const seed = centre * 41 + ray * 71;
      const angle = Math.PI * 2 * (ray * 0.618034 + centre * 0.3);
      const path = new Path2D();
      path.moveTo(x + (grain(seed) - 0.5) * 12, y + (grain(seed + 1) - 0.5) * 12);
      for (let segment = 1; segment <= 4; segment++) {
        const reach = segment * (10 + grain(seed + 2) * 5);
        const bent = angle + (grain(seed + segment * 3) - 0.5) * 0.8;
        path.lineTo(x + Math.cos(bent) * reach, y + Math.sin(bent) * reach * 0.7);
      }
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = 'rgb(0, 55, 0)';
      context.lineWidth = 4 + level * 0.4;
      context.stroke(path);
      // A dim heat band under the core, so the fissures still read on a world a few dozen
      // pixels across (owner, 2026-10-16); the core stays a thin bright line up close.
      context.strokeStyle = 'rgb(150, 0, 0)';
      context.lineWidth = 6 + level * 0.5;
      context.stroke(path);
      context.strokeStyle = 'rgb(255, 0, 0)';
      context.lineWidth = 1.8 + level * 0.18;
      context.stroke(path);
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  masks.set(level, texture);
  return texture;
}

/** Object-space coordinates rotate with the body and work with every GLTF's UV packing. */
export function addPlanetImpact(material: THREE.Material, level: number, time: { value: number }): void {
  if (level <= 0 || !(material instanceof THREE.MeshStandardMaterial)) return;
  const mask = impactMask(level);
  const compile = material.onBeforeCompile.bind(material);
  const program = material.customProgramCacheKey();
  material.userData.planetImpactLevel = level;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.uniforms.uPlanetImpactMask = { value: mask };
    shader.uniforms.uPlanetImpactTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlanetImpactPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlanetImpactPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPlanetImpactPosition;
uniform sampler2D uPlanetImpactMask;
uniform float uPlanetImpactTime;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
vec3 impactDirection = vPlanetImpactPosition / max(length(vPlanetImpactPosition), 1e-6);
float impactLon = abs(impactDirection.x) + abs(impactDirection.z) < 1e-6 ? 0.0 : atan(impactDirection.z, impactDirection.x);
vec2 impactUv = vec2(impactLon / 6.28318530718 + 0.5,
  asin(clamp(impactDirection.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
vec2 impactScar = texture2D(uPlanetImpactMask, impactUv).rg;
diffuseColor.rgb *= 1.0 - impactScar.g * 0.65;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// Molten, not painted (owner, 2026-10-16: "daha belirgin daha parlak daha glowing"): the
// core runs hot enough to bloom and breathes visibly; the wide band around it stays a dim red.
float impactHeat = 0.78 + 0.22 * sin(uPlanetImpactTime * 1.6 + impactUv.x * 19.0);
float impactCore = smoothstep(0.62, 1.0, impactScar.r);
vec3 impactGlow = (vec3(2.6, 0.12, 0.02) * impactScar.r + vec3(1.6, 0.55, 0.08) * impactCore) * impactHeat;
#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
impactGlow *= vColor.rgb;
#endif
totalEmissiveRadiance += impactGlow;`);
  };
  material.customProgramCacheKey = () => `${program}|planet-impact-uv-v3`;
}
