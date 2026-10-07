import type * as THREE from 'three';

/**
 * THE BLOOM'S ONE DOOR, GUARDED. Owner report, 2026-10-06: black squares and rectangles
 * appearing over parts of the galaxy, "as if the screen had cracked and that region died".
 *
 * The scene renders into a half-float target and Bloom's mipmap blur downsamples it six
 * times. A single pixel that is not finite — `pow` of a negative, `sqrt` of a rounding error
 * under zero, `atan(0, 0)`, a sum past half-float's 65,504 — is averaged into every texel of
 * every level above it, and the composite adds the blur back: a black block the size of a mip
 * tile, wherever the bad pixel happens to be this frame. `meteor.ts` met it first.
 *
 * Fixing each shader is necessary and never sufficient: the next one written will not know.
 * So the luminance pass — the only thing the blur reads (`BloomEffect.update`) — lets a pixel
 * through only while every channel is finite and in range, and sends anything else in as
 * nothing. One bad pixel stays one bad pixel; it can no longer become a block.
 *
 * NaN and Inf both FAIL a bounded comparison, which is why the test is `abs(c) < 6e4` rather
 * than `isnan` — it needs no GLSL 3 builtin and no driver that honours one.
 */

/** The sample the shipped `LuminanceMaterial` takes (postprocessing 6.x, minified). */
export const LUMINANCE_SAMPLE = 'vec4 texel=texture2D(inputBuffer,vUv);';
/** The same sample, through the guard. */
export const FINITE_SAMPLE = 'vec4 texel=asteraFinite(texture2D(inputBuffer,vUv));';

const FINITE_FUNCTION = 'vec4 asteraFinite(in vec4 c){return all(lessThan(abs(c),vec4(6.0e4)))?c:vec4(0.0);}\n';
const MAIN = 'void main(';

/**
 * Guards a Bloom effect's luminance pass, once. Returns whether its input is guarded: false
 * only for a shader this does not recognise, which is left exactly as it was — a library
 * upgrade must not break the picture, and `bloom-finite-guard.test.ts` fails first.
 */
export function guardBloomInput(effect: { readonly luminanceMaterial: THREE.ShaderMaterial }): boolean {
  const material = effect.luminanceMaterial;
  const shader = material.fragmentShader;
  if (shader.includes(FINITE_SAMPLE)) return true;
  const main = shader.indexOf(MAIN);
  if (!shader.includes(LUMINANCE_SAMPLE) || main < 0) return false;
  material.fragmentShader = shader.slice(0, main) + FINITE_FUNCTION
    + shader.slice(main).replace(LUMINANCE_SAMPLE, FINITE_SAMPLE);
  material.needsUpdate = true;
  return true;
}

/** A callback ref for `<Bloom>`: guards the effect the moment it mounts. */
export const guardBloomRef = (effect: { readonly luminanceMaterial: THREE.ShaderMaterial } | null): void => {
  if (effect) guardBloomInput(effect);
};
