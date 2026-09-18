import * as THREE from 'three';
import type { PlanetSkinVisual } from '../ui/planetSkins.js';

type PaletteFinish = Extract<PlanetSkinVisual['finish'], { kind: 'PALETTE' }>;

const RAMP = /* glsl */ `
uniform vec3 uRamp0;
uniform vec3 uRamp1;
uniform vec3 uRamp2;
vec3 skinRamp(float t) {
  return mix(mix(uRamp0, uRamp1, smoothstep(0.0, 0.55, t)),
    uRamp2, smoothstep(0.6, 1.0, t));
}
`;

const PARS = /* glsl */ `
uniform float uSkinTime;
uniform float uSkinHeat;
uniform float uSkinEdge;
uniform float uSkinSpread;
uniform float uSkinRim;
uniform vec3 uCrustDark;
uniform vec3 uCrustLight;
uniform float uRecolor;
uniform float uCrackShade;
uniform vec3 uRimColor;
${RAMP}
`;

const CRUST = /* glsl */ `
float skinCrack = 0.0;
float skinGrain = 0.0;
vec2 skinUv = vec2(0.0);
#ifdef USE_MAP
  skinUv = vMapUv;
  float sharp = smoothstep(uSkinEdge - 0.14, uSkinEdge + 0.14,
    sampledDiffuseColor.r - sampledDiffuseColor.g);
  vec4 soft = texture2D(map, vMapUv, uSkinSpread);
  float wide = smoothstep(uSkinEdge - 0.18, uSkinEdge + 0.06, soft.r - soft.g);
  skinCrack = clamp(max(sharp * 0.8, wide), 0.0, 1.0);
  skinGrain = soft.r;
#endif
float crustLight = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3 ownCrust = mix(vec3(crustLight), diffuseColor.rgb, 0.6) * 0.75;
vec3 paintedCrust = mix(uCrustDark, uCrustLight, smoothstep(0.0, 0.1, crustLight));
vec3 crust = mix(ownCrust, paintedCrust, uRecolor);
diffuseColor.rgb = mix(crust, crust * uCrackShade, skinCrack);
`;

const GLOW = /* glsl */ `
float flow = 0.82 + 0.18 * sin(uSkinTime * 1.7 + skinGrain * 30.0
  + (skinUv.x - skinUv.y) * 55.0);
vec3 glow = skinRamp(skinCrack) * skinCrack * uSkinHeat * flow;
float facing = clamp(dot(nonPerturbedNormal, normalize(vViewPosition)), 0.0, 1.0);
glow += uRimColor * pow(1.0 - facing, 3.0) * uSkinRim;
#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
  glow *= vColor.rgb;
#endif
totalEmissiveRadiance += glow;
`;

/** A material and uniform set per look prevents one planet recolouring its neighbour. */
export function createPlanetSkinMaterial(source: THREE.Material, finish: PaletteFinish) {
  const material = source instanceof THREE.MeshStandardMaterial
    ? source.clone()
    : new THREE.MeshStandardMaterial({ color: '#302e30' });
  material.metalness = 0;
  material.roughness = finish.palette.roughness;
  material.normalScale.multiplyScalar(1.8);
  const color = (rgb: readonly [number, number, number]) => new THREE.Color().setRGB(...rgb);
  const uniforms = {
    time: { value: 0 },
    heat: { value: finish.tuning.heat },
    edge: { value: finish.tuning.threshold },
    spread: { value: finish.tuning.spread },
    rim: { value: finish.tuning.rimStrength },
    ramp0: { value: color(finish.palette.ramp[0]) },
    ramp1: { value: color(finish.palette.ramp[1]) },
    ramp2: { value: color(finish.palette.ramp[2]) },
    crustDark: { value: color(finish.palette.crustDark) },
    crustLight: { value: color(finish.palette.crustLight) },
    recolor: { value: finish.palette.recolor },
    crackShade: { value: finish.palette.crackShade },
    rimColor: { value: color(finish.palette.rimColor) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uSkinTime: uniforms.time,
      uSkinHeat: uniforms.heat,
      uSkinEdge: uniforms.edge,
      uSkinSpread: uniforms.spread,
      uSkinRim: uniforms.rim,
      uRamp0: uniforms.ramp0,
      uRamp1: uniforms.ramp1,
      uRamp2: uniforms.ramp2,
      uCrustDark: uniforms.crustDark,
      uCrustLight: uniforms.crustLight,
      uRecolor: uniforms.recolor,
      uCrackShade: uniforms.crackShade,
      uRimColor: uniforms.rimColor,
    });
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${CRUST}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLOW}`);
  };
  material.customProgramCacheKey = () => 'planet-skin-palette-v1';
  return { material, uniforms };
}
