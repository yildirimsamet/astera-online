import * as THREE from 'three';

/**
 * OPTIK ÖRTÜ ON THE GALAXY (G17, owner 2026-11-25). A veiled leg reaches only its owner and the owner's clan,
 * and they see it cloaked, in the Yarık's invisibility language (`arena/render/ships.ts`, the cloak material):
 * no body, only the silhouette's edges bending light, rippling; no engine flame, no wake. The rim wears Optik
 * Örtü's own pearl (`--color-v2-capsule-veil`, owner 2026-11-25: capsules are not all purple), the Yarık cloak's
 * cyan family, paler so it never reads as Kristal.
 */
export const VEIL_TONE = '#bfe6f7';

export const veiledFlight = (flight: { veiled?: true }): boolean => flight.veiled === true;

/** One material for every veiled hull part: the batches share it, and `time` is advanced once a frame. */
export function veilMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, tone: { value: new THREE.Color(VEIL_TONE) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * local;
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float time; uniform vec3 tone; varying vec3 vN; varying vec3 vV;
      void main() {
        float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0);
        float wave = 0.6 + 0.4 * sin(time * 6.0 + gl_FragCoord.y * 0.05);
        gl_FragColor = vec4(tone * rim * wave * 0.9, 1.0);
      }`,
    toneMapped: false,
  });
}

/** Advances the shared veil's ripple; a batch's material is one or many, and only the veil has a `time`. */
export function setVeilTime(material: THREE.Material | THREE.Material[], seconds: number): void {
  for (const one of Array.isArray(material) ? material : [material]) {
    const time = one instanceof THREE.ShaderMaterial ? one.uniforms.time : undefined;
    if (time) time.value = seconds;
  }
}
