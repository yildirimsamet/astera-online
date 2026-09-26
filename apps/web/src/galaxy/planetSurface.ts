import * as THREE from 'three';

/**
 * HOW MUCH OF ITS OWN COLOUR A WORLD KEEPS ON ITS NIGHT SIDE. Owner, 2026-09-25:
 * "gezegenimin bile dibinden bakıyom ama yarısı zifiri karanlık". The scene's ambient
 * light reaches a physically lit surface at a tenth of its albedo, so half of every world
 * read as a hole. Keep enough of its colour on the night side for the solid sphere
 * to remain visible; the terminator and lit side still read separately.
 */
export const NIGHT_FLOOR = 0.3;

/**
 * THE DISC'S LIGHT, and the card render's (`tools/planet-cards.mjs` renders under the
 * same numbers, so a world's card is lit as the disc lights it). Raised with the 3D
 * worlds (owner: "ışığı biraz arttır"): an ambient of 0.35 left the unlit side black.
 */
export const SCENE_LIGHT = { ambient: 0.6, key: 2.6 } as const;

/** Applied only to owned material clones; props such as rings keep their authored alpha. */
export function solidPlanetMaterial<T extends THREE.Material>(material: T): T {
  material.transparent = false;
  material.opacity = 1;
  material.alphaTest = 0;
  material.alphaHash = false;
  material.alphaToCoverage = false;
  material.depthTest = true;
  material.depthWrite = true;
  if (material instanceof THREE.MeshPhysicalMaterial) material.transmission = 0;
  return material;
}

/**
 * A DEFAULT WORLD'S SURFACE, ON THE DISC AND ON ITS CARD (F9 · K7). One function so the
 * card rendered from the model and the model on the disc are the same world.
 *
 *   · MATTE: the models export metallic, which read as polished balls; a planet is rock
 *     and cloud.
 *   · A NIGHT FLOOR of its own colour (`NIGHT_FLOOR`), dimmed by the world's tint like
 *     the lit side — an unread world stays dark on both halves.
 *   · `detail` false (a world seen small): the tiled normal and roughness maps are
 *     sub-pixel, so they are never bound — and a texture no material binds is never
 *     uploaded.
 *
 * Works on a clone: the model's own material is the cache's, shared by every user.
 */
export function planetSurface(source: THREE.Material, detail: boolean): THREE.Material {
  const material = solidPlanetMaterial(source.clone());
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  material.metalness = 0;
  material.metalnessMap = null;
  if (!detail) {
    material.normalMap = null;
    material.roughnessMap = null;
    material.roughness = 1;
  }
  if (material.map) {
    material.emissiveMap = material.map;
    material.emissive.setScalar(NIGHT_FLOOR);
  }
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
  // The patch above is the same for every world; one compiled program serves them all.
  material.customProgramCacheKey = () => 'planet-surface';
  return material;
}
