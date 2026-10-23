import * as THREE from 'three';

export interface HullOptions {
  detail?: THREE.Texture | null; detailNormal?: THREE.Texture | null;
  color?: string; strip?: string; stripEvery?: number; scale?: number; deck?: boolean;
}

/**
 * Hull plating for built structures. Their gameplay shape is a set of boxes, so the
 * boxes themselves are drawn — a landing deck is exactly where it looks. Texture comes
 * from world-space triplanar sampling of a station sheet, so any box size tiles without
 * stretching; seams and light strips are drawn in the shader on top of it.
 */
export function hullMaterial(options: HullOptions = {}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? '#5d6874'), metalness: 0.5, roughness: 0.58,
    emissive: new THREE.Color('#000000'),
  });
  const uniforms = {
    detailMap: { value: options.detail ?? null },
    detailScale: { value: 1 / (options.scale ?? 38) },
    stripColor: { value: new THREE.Color(options.strip ?? '#2ee6c8') },
    stripEvery: { value: options.stripEvery ?? 22 },
    deck: { value: options.deck ? 1 : 0 },
    hasDetail: { value: options.detail ? 1 : 0 },
    time: { value: 0 },
  };
  material.userData.hull = uniforms;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHullP;\nvarying vec3 vHullN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vHullP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vHullN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vHullP; varying vec3 vHullN;
        uniform sampler2D detailMap; uniform float detailScale; uniform vec3 stripColor; uniform float stripEvery;
        uniform float deck; uniform float hasDetail; uniform float time;
        float hullSeam(vec2 p, float size, float width) {
          vec2 g = abs(fract(p / size + 0.5) - 0.5) * size;
          return 1.0 - smoothstep(0.0, width, min(g.x, g.y));
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 w = pow(abs(normalize(vHullN)), vec3(4.0)); w /= max(1e-4, w.x + w.y + w.z);
        vec2 px = vHullP.zy; vec2 py = vHullP.xz; vec2 pz = vHullP.xy;
        if (hasDetail > 0.5) {
          vec3 d = texture2D(detailMap, px * detailScale).rgb * w.x + texture2D(detailMap, py * detailScale).rgb * w.y
            + texture2D(detailMap, pz * detailScale).rgb * w.z;
          diffuseColor.rgb *= mix(vec3(0.5), d * 1.9, 0.9);
        }
        float seam = hullSeam(px, 6.0, 0.08) * w.x + hullSeam(py, 6.0, 0.08) * w.y + hullSeam(pz, 6.0, 0.08) * w.z;
        float plate = hullSeam(px, 24.0, 0.25) * w.x + hullSeam(py, 24.0, 0.25) * w.y + hullSeam(pz, 24.0, 0.25) * w.z;
        diffuseColor.rgb *= 1.0 - seam * 0.35 - plate * 0.45;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float band = 1.0 - smoothstep(0.18, 0.55, abs(fract(vHullP.y / stripEvery + 0.5) - 0.5) * stripEvery);
        float side = 1.0 - w.y;
        float dash = step(0.35, fract((vHullP.x + vHullP.z) / 9.0));
        float strip = band * side * dash;
        // Deck tops carry a landing grid and a slow pulse, so a pilot can find the pad.
        float topFace = smoothstep(0.85, 0.98, normalize(vHullN).y) * deck;
        float grid = hullSeam(py, 12.0, 0.18) * topFace * 0.6;
        float pulse = 0.65 + 0.35 * sin(time * 2.2 + (vHullP.x + vHullP.z) * 0.02);
        totalEmissiveRadiance += stripColor * (strip * 1.4 + grid * 0.32 * pulse);`);
  };
  material.customProgramCacheKey = () => `hull:${options.detail ? 'd' : 'p'}:${options.deck ? 'deck' : 'wall'}`;
  return material;
}

export function tickHull(material: THREE.Material, time: number): void {
  const uniforms: unknown = material.userData.hull;
  if (typeof uniforms === 'object' && uniforms !== null && 'time' in uniforms) {
    const t = uniforms.time;
    if (typeof t === 'object' && t !== null && 'value' in t) t.value = time;
  }
}

const FOG_MIX = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
/**
 * The fog chunk with the glow fading to black instead of to the fog colour. Light added to the
 * frame (additive blending) fades to nothing in fog; mixed towards the fog colour it lights its
 * whole quad (owner 2026-10-22: farm glows seen through a dust cloud read as squares).
 */
export function fogToBlack(fragmentShader: string): string {
  if (!THREE.ShaderChunk.fog_fragment.includes(FOG_MIX)) throw new Error('three.js fog chunk changed: update fogToBlack');
  return fragmentShader.replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace(FOG_MIX, 'gl_FragColor.rgb *= 1.0 - fogFactor;'));
}

/** An additive material that fades into fog as light should: to nothing. */
export function additiveFog<M extends THREE.Material>(material: M): M {
  material.onBeforeCompile = shader => { shader.fragmentShader = fogToBlack(shader.fragmentShader); };
  material.customProgramCacheKey = () => 'fog-black';
  return material;
}

/** Soft additive sprite material shared by glows, flares and beams. */
export function glowMaterial(texture: THREE.Texture | undefined, color: string, opacity = 1): THREE.SpriteMaterial {
  return additiveFog(new THREE.SpriteMaterial({
    map: texture ?? null, color: new THREE.Color(color), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
}

/** Writes a shader uniform if the material declares it. */
export function setUniform(material: THREE.ShaderMaterial, name: string, value: unknown): void {
  const uniform = material.uniforms[name];
  if (uniform) uniform.value = value;
}
