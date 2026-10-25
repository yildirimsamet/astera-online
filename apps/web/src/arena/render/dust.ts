import * as THREE from 'three';

export interface DustOptions {
  count: number; size: number; width: number;
  /** Distance over which motes fade in, so none ever smears across the lens. */
  near: [number, number];
  /** A turbo-only layer: dark until the boost lights. */
  boostOnly: boolean;
  /** Streak length relative to the field layer (near motes need shorter ones). */
  stretch: number;
}

const FIELD: DustOptions = { count: 520, size: 190, width: 0.11, near: [6, 22], boostOnly: false, stretch: 1 };

/**
 * Motes wrapped in a box around the camera and stretched along the ship's motion.
 * Empty space has no reference points; these are what make speed, braking and turbo
 * readable at a glance (S47). Wrapping happens in the vertex shader: no CPU work.
 *
 * A streak is the distance the ship covers in a short "shutter", growing faster than
 * speed: dots when drifting, long lines in turbo. With no pilot flying (dead, extracted)
 * they fade out instead of hanging in the air.
 */
export function createDust(options: DustOptions = FIELD): { mesh: THREE.Mesh; update(eye: THREE.Vector3, velocity: THREE.Vector3, turbo: boolean, active: boolean, dt: number): void } {
  const COUNT = options.count; const SIZE = options.size;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  const base = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    base[i * 4] = Math.random() * SIZE; base[i * 4 + 1] = Math.random() * SIZE; base[i * 4 + 2] = Math.random() * SIZE;
    base[i * 4 + 3] = 0.4 + Math.random() * 0.6;
  }
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(base, 4));
  geometry.instanceCount = COUNT;
  const uniforms = {
    eye: { value: new THREE.Vector3() }, motion: { value: new THREE.Vector3(0, 0, 1) }, stretch: { value: 0 },
    size: { value: SIZE }, glow: { value: 0.5 },
  };
  const material = new THREE.ShaderMaterial({
    // Axial quads flip winding with the motion direction: draw both sides.
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms,
    vertexShader: `attribute vec4 seed; uniform vec3 eye; uniform vec3 motion; uniform float stretch; uniform float size;
      varying float vFade; varying vec2 vUv;
      void main(){ vec3 p = seed.xyz + floor((eye - seed.xyz) / size + 0.5) * size;
        float d = distance(p, eye); vFade = seed.w * smoothstep(${options.near[0].toFixed(1)}, ${options.near[1].toFixed(1)}, d) * (1.0 - smoothstep(size * 0.32, size * 0.5, d));
        vec4 a = modelViewMatrix * vec4(p, 1.0); vec4 b = modelViewMatrix * vec4(p - motion * (0.25 + stretch), 1.0);
        vec3 dir = b.xyz - a.xyz; vec3 cr = cross(dir, a.xyz); float cl = length(cr);
        vec3 side = (cl > 1e-6 ? cr / cl : vec3(1.0, 0.0, 0.0)) * ${options.width.toFixed(3)};
        vec3 q = mix(a.xyz, b.xyz, position.y + 0.5) + side * position.x * 2.0;
        vUv = position.xy + 0.5; gl_Position = projectionMatrix * vec4(q, 1.0); }`,
    fragmentShader: `uniform float glow; varying float vFade; varying vec2 vUv;
      void main(){ float core = 1.0 - abs(vUv.x - 0.5) * 2.0; float tail = 1.0 - vUv.y * 0.7;
        gl_FragColor = vec4(vec3(0.62, 0.8, 1.0) * core * tail * vFade * glow * 1.8, 1.0); }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  let stretch = 0; let glow = 0;
  return {
    mesh,
    update(eye, velocity, turbo, active, dt) {
      uniforms.eye.value.copy(eye);
      const speed = active ? velocity.length() : 0;
      if (speed > 0.01) uniforms.motion.value.copy(velocity).divideScalar(speed);
      const k = 1 - Math.exp(-dt * 7);
      stretch += ((speed * 0.045 + speed * speed * (turbo ? 0.0007 : 0.00045)) * options.stretch - stretch) * k;
      const target = !active ? 0 : options.boostOnly ? (turbo ? 0.9 : 0) : 0.18 + Math.min(1, speed / 120) * 0.82 + (turbo ? 0.2 : 0);
      glow += (target - glow) * (1 - Math.exp(-dt * (active && target > glow ? (options.boostOnly ? 9 : 4) : 6)));
      uniforms.stretch.value = stretch; uniforms.glow.value = glow;
      mesh.visible = glow > 0.005;
    },
  };
}
