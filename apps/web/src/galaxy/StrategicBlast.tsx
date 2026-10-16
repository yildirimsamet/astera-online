import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { DeathStarImpactEvent } from './DeathStarImpact.jsx';
import { strategicEjecta, strategicLayers } from './strategicLayers.js';
import { EXPLOSION_ATLAS, SMOKE_ATLAS, fireTexture } from './vfx.js';
import { serverNow } from '../lib/clock.js';
import { FullRate } from './frames.jsx';
import { playSceneSound } from './audio.js';
import { screenFloorScale } from './publicMoments.js';

/** The smallest world radius, in screen pixels, a strike's fire is drawn around. */
const BLAST_MIN_PIXELS = 7;
import { unitModel } from './model.js';

const FRAGMENT = '/assets/models/debris/wreck-plate-gd-v3.glb';
const DUST = '/assets/vfx/premium-v2/dust.webp';
const BURST = '/assets/vfx/premium-v2/burst.webp';

/** A known future strike warms its sources without drawing an early effect. */
export function prewarmStrategicBlast(): void {
  useGLTF.preload(FRAGMENT, false);
  useTexture.preload([EXPLOSION_ATLAS, SMOKE_ATLAS, DUST, BURST]);
}

/** Every cloud has its own continuous frame while sharing one source and one draw. */
function atlasBatch(map: THREE.Texture, count: number, additive: boolean, columns = 8, rows = 8) {
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const frames = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const colours = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
  geometry.setAttribute('aFrame', frames);
  geometry.setAttribute('aAlpha', alpha);
  geometry.setAttribute('aTint', colours);
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uGrid: { value: new THREE.Vector2(columns, rows) } },
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      attribute float aFrame; attribute float aAlpha; attribute vec3 aTint;
      varying vec2 vUv; varying float vAlpha; varying float vFrame; varying vec3 vTint;
      void main() {
        vUv = uv; vFrame = aFrame; vAlpha = aAlpha; vTint = aTint;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec2 uGrid;
      varying vec2 vUv; varying float vAlpha; varying float vFrame; varying vec3 vTint;
      vec4 tile(float frame) {
        vec2 cell = vec2(mod(frame,uGrid.x),uGrid.y-1.0-floor(frame/uGrid.x));
        return texture2D(uMap,(cell+clamp(vUv,vec2(0.006),vec2(0.994)))/uGrid);
      }
      void main() {
        float frame = clamp(vFrame,0.0,uGrid.x*uGrid.y-1.0);
        vec4 texel = mix(tile(floor(frame)),tile(min(floor(frame)+1.0,uGrid.x*uGrid.y-1.0)),fract(frame));
        gl_FragColor = vec4(texel.rgb*vTint,texel.a*vAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
  return { geometry, material, frames, alpha, colours };
}

/** One short catastrophic event, entirely from its authoritative server timestamp. */
export function StrategicBlast({ event }: { event: DeathStarImpactEvent }) {
  const [fireMap, smokeMap, dustMap, burstMap] = useTexture([EXPLOSION_ATLAS, SMOKE_ATLAS, DUST, BURST]);
  const { scene } = useGLTF(FRAGMENT, false);
  const fragment = useMemo(() => unitModel(scene), [scene]);
  const root = useRef<THREE.Group>(null);
  const fire = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const burst = useRef<THREE.InstancedMesh>(null);
  const debris = useRef<THREE.InstancedMesh>(null);
  const flash = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);
  const airborne = event.kind === 'interception';
  const fireCount = airborne ? 3 : 6;
  const smokeCount = airborne ? 3 : 8;
  const dustCount = airborne ? 5 : 10;
  const fragments = useMemo(() => strategicEjecta(event.id, airborne ? 14 : 28), [event.id, airborne]);
  const flame = useMemo(() => atlasBatch(fireMap!, fireCount, true), [fireMap, fireCount]);
  const cloud = useMemo(() => atlasBatch(smokeMap!, smokeCount, false), [smokeMap, smokeCount]);
  const plume = useMemo(() => atlasBatch(dustMap!, dustCount, false), [dustMap, dustCount]);
  const ignition = useMemo(() => atlasBatch(burstMap!, 1, true, 4, 2), [burstMap]);
  const flare = useMemo(fireTexture, []);
  const bits = useMemo(() => {
    const material = fragment?.material.clone() ?? new THREE.MeshStandardMaterial({ color: '#8a8580', metalness: 0.72, roughness: 0.64 });
    material.transparent = true;
    material.depthWrite = false;
    // The galaxy's ships also draw late; test depth locally, never a flat coloured sticker.
    material.depthTest = true;
    material.forceSinglePass = true;
    return material;
  }, [fragment]);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const heard = useRef(false);
  const soundPosition = useMemo(() => new THREE.Vector3(...event.position), [event.position]);
  const phase = fragments[0]?.spin[0] ?? 0;
  const radius = Math.max(0.01, event.radius);
  const intensity = Math.max(0, Math.min(1, event.intensity));
  useEffect(() => () => {
    for (const batch of [flame, cloud, plume, ignition]) {
      batch.geometry.dispose(); batch.material.dispose();
    }
    bits.dispose();
  }, [flame, cloud, plume, ignition, bits]);

  useFrame(({ camera, size }) => {
    const seconds = (serverNow() - event.at) / 1000;
    if (!Number.isFinite(seconds)) { if (root.current) root.current.visible = false; return; }
    // Seen from across the disc the fire keeps a few pixels of world radius (owner, 2026-10-16).
    root.current?.scale.setScalar(screenFloorScale(radius, soundPosition, camera, size.height, BLAST_MIN_PIXELS));
    const layer = strategicLayers(seconds, airborne ? 'interception' : 'surface');
    if (root.current) root.current.visible = Number.isFinite(seconds) && seconds >= 0 && seconds < 8;
    if (!heard.current && seconds >= 0) {
      heard.current = true;
      if (seconds < 0.5) playSceneSound(event.sound ?? 'strategic', soundPosition, camera, intensity, `strategic:${event.id}`);
    }
    if (light.current) light.current.intensity = radius * radius * 48 * Math.max(0, 1 - seconds / 0.42) ** 2 * intensity;
    if (flash.current) {
      flash.current.visible = layer.flash > 0;
      flash.current.scale.setScalar(radius * (airborne ? 2.5 : 3.8) * (0.7 + layer.shockProgress));
      flash.current.material.opacity = layer.flash * 0.8 * intensity;
    }
    if (burst.current) {
      burst.current.visible = layer.flash > 0 || seconds < 0.48;
      const t = Math.max(0, Math.min(1, seconds / 0.48));
      scratch.position.set(0, 0, 0);
      scratch.quaternion.copy(camera.quaternion);
      scratch.rotateZ(phase);
      scratch.scale.setScalar(radius * (airborne ? 2.0 : 3.0) * (0.7 + Math.sqrt(t)));
      scratch.updateMatrix(); burst.current.setMatrixAt(0, scratch.matrix);
      ignition.frames.setX(0, t * 7);
      ignition.alpha.setX(0, (1 - t) ** 1.4 * intensity);
      burst.current.instanceMatrix.needsUpdate = true;
      ignition.frames.needsUpdate = true; ignition.alpha.needsUpdate = true;
    }
    if (fire.current) {
      const node = fire.current;
      node.visible = layer.fire > 0;
      if (node.visible) for (let i = 0; i < fireCount; i++) {
        const bit = fragments[i]!;
        const delay = i === 0 ? 0 : bit.delay + i * 0.025;
        const age = Math.max(0, (seconds - delay) / (airborne ? 1.35 : 2.8));
        const grow = Math.sqrt(Math.min(1, age * 2.2));
        const spread = radius * (i === 0 ? 0 : 0.35 + grow * (airborne ? 0.5 : 0.95));
        scratch.position.set(...bit.direction).multiplyScalar(spread);
        scratch.quaternion.copy(camera.quaternion);
        scratch.rotateZ(bit.spin[2] * 0.6 + age * 0.12);
        const size = radius * (i === 0 ? 3.7 : 2.1 + bit.size * 3) * (airborne ? 0.65 : 1) * (0.55 + grow * 0.65);
        scratch.scale.set(size, size * (0.92 + bit.size), 1);
        scratch.updateMatrix(); node.setMatrixAt(i, scratch.matrix);
        flame.frames.setX(i, Math.min(63, age * 63));
        flame.alpha.setX(i, (seconds >= delay ? layer.fire : 0) * intensity * (i === 0 ? 0.95 : 0.75));
        flame.colours.setXYZ(i, 1.08, 1.05, 1.0);
      }
      node.instanceMatrix.needsUpdate = true;
      flame.frames.needsUpdate = true; flame.alpha.needsUpdate = true; flame.colours.needsUpdate = true;
    }
    for (const [node, batch, count, ballistic] of [
      [smoke.current, cloud, smokeCount, false], [dust.current, plume, dustCount, true],
    ] as const) {
      if (!node) continue;
      node.visible = layer.smoke > 0;
      if (!node.visible) continue;
      for (let i = 0; i < count; i++) {
        const bit = fragments[(i + 7) % fragments.length]!;
        const age = Math.max(0, layer.smokeProgress - bit.delay * 0.15);
        const spread = ballistic ? 0.5 + Math.log1p(Math.max(0, seconds - 0.15) * 3) * bit.speed * 0.75 : 0.25 + age * 2.0;
        scratch.position.set(...bit.direction).multiplyScalar(radius * spread);
        scratch.quaternion.copy(camera.quaternion);
        scratch.rotateZ(bit.spin[2] * 0.7 + age * 0.22);
        const size = radius * (ballistic ? 0.8 + age * 1.9 : 2.2 + age * 2.6) * (airborne ? 0.6 : 1);
        scratch.scale.set(size, size * (ballistic ? 1.4 : 0.88), 1);
        scratch.updateMatrix(); node.setMatrixAt(i, scratch.matrix);
        batch.frames.setX(i, Math.min(63, age * (ballistic ? 53 : 58) + (i % 3) * 1.6));
        batch.alpha.setX(i, layer.smoke * intensity * (ballistic ? 0.74 : 0.63));
        const hot = Math.max(0, 1 - seconds / 2.3);
        batch.colours.setXYZ(i, 0.3 + hot * 0.4, 0.31 + hot * 0.12, 0.34 + hot * 0.04);
      }
      node.instanceMatrix.needsUpdate = true;
      batch.frames.needsUpdate = true; batch.alpha.needsUpdate = true; batch.colours.needsUpdate = true;
    }
    if (debris.current) {
      const node = debris.current;
      node.visible = layer.debris > 0;
      if (node.visible) for (let i = 0; i < fragments.length; i++) {
        const bit = fragments[i]!;
        const age = Math.max(0, seconds - bit.delay);
        // A violent impulse then constant free drift, without atmospheric drag or gravity.
        const reach = radius * (0.4 + age * bit.speed * (airborne ? 0.55 : 0.85));
        scratch.position.set(...bit.direction).multiplyScalar(reach);
        scratch.rotation.set(phase + age * bit.spin[0], i + age * bit.spin[1], age * bit.spin[2]);
        const size = radius * bit.size * (airborne ? 0.7 : 1);
        scratch.scale.set(size * 1.5, size * 0.75, size);
        scratch.updateMatrix(); node.setMatrixAt(i, scratch.matrix);
        const heat = Math.max(0, 1 - age / 1.2);
        node.setColorAt(i, tint.setRGB(0.24 + heat * 2.1, 0.25 + heat * 0.65, 0.27 + heat * 0.08));
      }
      bits.opacity = layer.debris * intensity;
      node.instanceMatrix.needsUpdate = true;
      if (node.instanceColor) node.instanceColor.needsUpdate = true;
    }
  });
  return <group ref={root} position={event.position} name={airborne ? 'death-star-interception-blast' : 'death-star-surface-blast'}>
    <FullRate />
    <pointLight ref={light} color="#ffd7a4" distance={radius * 8} decay={2} intensity={0} />
    <sprite ref={flash} renderOrder={1307} visible={false}>
      <spriteMaterial map={flare} color="#fff1dc" transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
    <instancedMesh ref={burst} args={[ignition.geometry, ignition.material, 1]} name="strategic-rupture-flash" visible={false} frustumCulled={false} renderOrder={1310} raycast={() => null} />
    <instancedMesh ref={smoke} args={[cloud.geometry, cloud.material, smokeCount]} name="strategic-cooling-smoke" visible={false} frustumCulled={false} renderOrder={1308} raycast={() => null} />
    <instancedMesh ref={dust} args={[plume.geometry, plume.material, dustCount]} name="strategic-ballistic-dust" visible={false} frustumCulled={false} renderOrder={1309} raycast={() => null} />
    <instancedMesh ref={fire} args={[flame.geometry, flame.material, fireCount]} name="strategic-fire-lobes" visible={false} frustumCulled={false} renderOrder={1311} raycast={() => null} />
    {fragment ? <instancedMesh ref={debris} args={[fragment.geometry, bits, fragments.length]} name="strategic-hot-fragments" visible={false} frustumCulled={false} renderOrder={1312} raycast={() => null} /> : null}
  </group>;
}
