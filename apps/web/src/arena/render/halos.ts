import * as THREE from 'three';

interface Point { x: number; y: number; z: number }
export interface BillboardEntry { p: Point; color: THREE.ColorRepresentation; size: number; turn?: number }
export type HaloEntry = BillboardEntry;

/**
 * How a billboard meets the fog: `fade` (additive light fades to nothing; mixed towards the fog
 * colour it would light its whole square), `mix` (an ordinary blended cloud takes the fog
 * colour, as a Sprite does), `none` (drawn as it is).
 */
export type BillboardFog = 'fade' | 'mix' | 'none';

/**
 * Many Sprites of one texture as one instanced draw (perf study 2026-10-22: the farm glows,
 * belt nebulae and dust clouds were ~470 sprites, a material and a draw call each). Each one is
 * drawn as a Sprite would draw it: screen-aligned, `size` metres across, turned `turn` radians
 * about the view axis, texture × colour × strength. With a `centre` the mesh stands there and
 * the billboards around it, so it sorts against other glass by that point.
 */
export function createBillboards(map: THREE.Texture | null, entries: readonly BillboardEntry[],
  options: { blending: THREE.Blending; fog: BillboardFog; centre?: Point }) {
  const centre = options.centre ?? { x: 0, y: 0, z: 0 };
  const geometry = new THREE.PlaneGeometry(1, 1);
  const strength = new THREE.InstancedBufferAttribute(new Float32Array(entries.length), 1).setUsage(THREE.DynamicDrawUsage);
  const turn = new THREE.InstancedBufferAttribute(Float32Array.from(entries, e => e.turn ?? 0), 1);
  geometry.setAttribute('strength', strength);
  geometry.setAttribute('turn', turn);
  const fogDensity = { value: 0 }; const fogColor = { value: new THREE.Color() }; const spin = { value: 0 };
  const fogLine = options.fog === 'fade' ? 'rgb *= vFog;' : options.fog === 'mix' ? 'rgb = mix(fogColor, rgb, vFog);' : '';
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: options.blending, toneMapped: false,
    uniforms: { map: { value: map }, fogDensity, spin, ...(options.fog === 'mix' ? { fogColor } : {}) },
    vertexShader: `attribute float strength; attribute float turn; uniform float fogDensity; uniform float spin;
      varying vec2 vUv; varying vec3 vColor; varying float vStrength; varying float vFog;
      void main() {
        // Faded out: no triangle, so no fill (a cloud around the lens is a whole screen of it).
        if (strength < 0.004) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        vUv = uv; vStrength = strength;
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float a = turn + spin; float c = cos(a); float s = sin(a);
        mv.xy += mat2(c, s, -s, c) * position.xy * length(instanceMatrix[0].xyz);
        float fog = fogDensity * -mv.z;
        vFog = exp(-fog * fog);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D map; ${options.fog === 'mix' ? 'uniform vec3 fogColor;' : ''}
      varying vec2 vUv; varying vec3 vColor; varying float vStrength; varying float vFog;
      void main() {
        vec4 texel = texture2D(map, vUv);
        vec3 rgb = vColor * texel.rgb;
        ${fogLine}
        gl_FragColor = vec4(rgb, texel.a * vStrength);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  mesh.frustumCulled = false;
  mesh.position.set(centre.x, centre.y, centre.z);
  const matrix = new THREE.Matrix4(); const color = new THREE.Color();
  entries.forEach((e, i) => {
    mesh.setMatrixAt(i, matrix.makeScale(e.size, e.size, e.size).setPosition(e.p.x - centre.x, e.p.y - centre.y, e.p.z - centre.z));
    mesh.setColorAt(i, color.set(e.color));
  });
  return {
    mesh,
    /** One billboard's strength (the sprite's opacity) this frame. */
    setOpacity(i: number, value: number): void { strength.setX(i, value); strength.needsUpdate = true; },
    /** The scene's exponential fog. */
    setFog(density: number, colour?: THREE.Color): void { fogDensity.value = density; if (colour) fogColor.value.copy(colour); },
    /** Radians every billboard has turned since it was placed. */
    setSpin(radians: number): void { spin.value = radians; },
  };
}

/** The farm glows: one additive billboard on every ore deposit, fading to nothing in fog. */
export function createHalos(map: THREE.Texture | null, entries: readonly HaloEntry[]) {
  return createBillboards(map, entries, { blending: THREE.AdditiveBlending, fog: 'fade' });
}
