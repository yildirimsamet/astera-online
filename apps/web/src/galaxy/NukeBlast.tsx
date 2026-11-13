import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { DeathStarImpactEvent } from './DeathStarImpact.jsx';
import { atlasBatch, BLAST_MIN_PIXELS } from './StrategicBlast.jsx';
import { NukeCloud, type NukeCloudLayer } from './NukeCloud.js';
import { NUKE_SECONDS, nukeLayers, nukeStrikeAxis } from './nukeLayers.js';
import { PLANET_SKIN_BODY_SCALE } from './planetSkinAttachments.js';
import { EXPLOSION_ATLAS, fireTexture } from './vfx.js';
import { EMP_ARC, EMP_BOLT } from './empSchedule.js';
import { serverNow } from '../lib/clock.js';
import { FULL_RATE_FPS, HoldRate } from './frames.jsx';
import { createRehearsal, type Rehearsal } from './rehearsal.js';
import { playSceneSound } from './audio.js';
import { screenFloorScale } from './publicMoments.js';

/*
  A DEATH STAR THAT LANDS, AS A NUCLEAR STRIKE SEEN FROM ORBIT (owner, 2026-11-12). A flash, a
  fireball, a shock front racing over the world with ash behind it, a condensation disc, the column
  and the rolling cap of a mushroom cloud, and a crater still burning when the EMP hour takes over.
  Seven draws for eight seconds and one world. A weapon shot down still bursts in the air
  (`StrategicBlast`).

  It is mounted while the weapon is still in flight and draws each part once, unseen, before the
  moment (`createRehearsal`), so the frame of impact only draws (S22, 2026-11-13).

  Library art (CREDITS.md): Space Combat Kit's smoke, Unique AoE Magic's white shock wave and Unique
  Projectiles' flare.
*/

export const NUKE_SMOKE = '/assets/vfx/library/sck-smoke-8x8.webp';
export const NUKE_SHOCK = '/assets/vfx/library/white-shock-4x4.webp';
export const NUKE_FLARE = '/assets/vfx/library/flare-star.webp';

/** A known future strike warms its sources, and the EMP storm's that takes over from its crater. */
export function prewarmNukeBlast(): void {
  useTexture.preload([EXPLOSION_ATLAS, NUKE_SMOKE, NUKE_SHOCK, NUKE_FLARE, EMP_ARC, EMP_BOLT]);
}

/** The galaxy's key light (`GalaxyCanvas`), so the cloud is lit from the side the worlds are. */
const SUN = new THREE.Vector3(-8, 12, 9).normalize();
const FIRE_PUFFS = 5;
const Z = new THREE.Vector3(0, 0, 1);
const SCREEN_UP = new THREE.Vector3();

const SHELL_VERT = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NOISE = /* glsl */`
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;
/**
 * The glow shell also carries the strike's light on the world (S22, 2026-11-13). A real light would
 * change the light count every lit material in the galaxy was compiled for, and all of them would
 * compile again on the frame of impact. This is the same light worked out on the surface: a source
 * 0.7 radii above the strike point, the world's face lit by how squarely it faces it and dimmed by
 * the square of the distance, saturating the way an overexposed photograph does.
 */
const GLOW_FRAG = /* glsl */`
  uniform vec3 uStrike; uniform float uAngle; uniform float uRing; uniform float uEmber; uniform float uHeat;
  uniform float uLight; uniform float uFlash;
  varying vec3 vDir;
  ${NOISE}
  vec3 heatColour(float h) {
    return h > 0.5 ? mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.93, 0.78), (h - 0.5) * 2.0)
                   : mix(vec3(0.55, 0.06, 0.02), vec3(1.0, 0.45, 0.12), h * 2.0);
  }
  void main() {
    float theta = acos(clamp(dot(vDir, uStrike), -1.0, 1.0));
    float ragged = (noise(vDir * 9.0) - 0.5) * 0.09 + (noise(vDir * 23.0) - 0.5) * 0.04;
    float d = theta + ragged - uAngle;
    float front = (0.75 * exp(-((d / 0.06) * (d / 0.06))) + 0.45 * exp(-((d / 0.2) * (d / 0.2)))) * uRing;
    float wake = (1.0 - smoothstep(uAngle * 0.35, max(uAngle, 1e-4), theta + ragged)) * step(theta, uAngle) * 0.22 * uRing;
    float crater = exp(-(((theta + ragged * 0.6) / 0.11) * ((theta + ragged * 0.6) / 0.11))) * uEmber;
    float veins = smoothstep(0.62, 0.78, noise(vDir * 40.0)) * exp(-((theta / 0.26) * (theta / 0.26))) * uEmber * 0.6;
    vec3 colour = front * vec3(1.0, 0.9, 0.76) * 2.4 + wake * vec3(1.0, 0.55, 0.25) + (crater + veins) * heatColour(uHeat) * 1.4;
    vec3 toLight = uStrike * 1.7 - vDir;
    float d2 = max(dot(toLight, toLight), 1e-4);
    float facing = max(dot(vDir, toLight), 0.0) * inversesqrt(d2);
    float lit = (1.0 - exp(-4.0 * uLight * facing * 0.49 / d2)) * 0.9;
    colour += lit * vec3(1.0, 0.75 + 0.25 * uFlash, 0.5 + 0.5 * uFlash);
    gl_FragColor = vec4(colour, 1.0);
  }`;
const ASH_FRAG = /* glsl */`
  uniform vec3 uStrike; uniform float uAngle; uniform float uAsh;
  varying vec3 vDir;
  ${NOISE}
  void main() {
    float theta = acos(clamp(dot(vDir, uStrike), -1.0, 1.0));
    float mottled = 0.55 + 0.45 * noise(vDir * 14.0);
    float inside = (1.0 - smoothstep(uAngle * 0.55, max(uAngle * 0.92, 1e-4), theta + (noise(vDir * 7.0) - 0.5) * 0.12));
    gl_FragColor = vec4(vec3(0.11, 0.085, 0.07), inside * mottled * uAsh);
  }`;

export function NukeBlast({ event }: { event: DeathStarImpactEvent }) {
  const [fireMap, smokeMap, discMap, flareMap] = useTexture([EXPLOSION_ATLAS, NUKE_SMOKE, NUKE_SHOCK, NUKE_FLARE]);
  // The world as drawn, not its pick radius: the shells lie on its surface.
  const radius = Math.max(0.01, event.radius) * PLANET_SKIN_BODY_SCALE;
  const centre = useMemo(() => new THREE.Vector3(...event.position), [event.position]);
  // Aimed on the first frame it is seen, from that viewer's camera (`nukeStrikeAxis`), then held.
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const across = useMemo(() => [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)] as const, []);
  const ground = useMemo(() => new THREE.Vector3(), []);
  const aimed = useRef(false);
  const heard = useRef(false);

  const fire = useMemo(() => atlasBatch(fireMap!, FIRE_PUFFS, true, 8, 8, true), [fireMap]);
  const cloudLayer = useRef<NukeCloudLayer>({ capProgress: 0, columnHeight: 0, heat: 1, cap: 0, column: 0 });
  const age = useRef(0);
  const disc = useMemo(() => {
    discMap!.colorSpace = THREE.SRGBColorSpace;
    discMap!.generateMipmaps = false;
    discMap!.minFilter = THREE.LinearFilter;
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: discMap }, uFrame: { value: 0 }, uAlpha: { value: 0 } },
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; uniform float uFrame; uniform float uAlpha; varying vec2 vUv;
        void main() {
          float f = floor(uFrame); vec2 cell = vec2(mod(f, 4.0), 3.0 - floor(f / 4.0));
          vec4 t = texture2D(uMap, (cell + vUv) / 4.0);
          float lit = t.a * max(t.r, max(t.g, t.b));
          gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), min(1.0, lit * 1.8) * uAlpha);
        }`,
    });
  }, [discMap]);
  const glow = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uStrike: { value: axis }, uAngle: { value: 0 }, uRing: { value: 0 }, uEmber: { value: 0 }, uHeat: { value: 1 }, uLight: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: SHELL_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }), [axis]);
  const ash = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uStrike: { value: axis }, uAngle: { value: 0 }, uAsh: { value: 0 } },
    vertexShader: SHELL_VERT, fragmentShader: ASH_FRAG, transparent: true, depthWrite: false,
  }), [axis]);
  const shell = useMemo(() => new THREE.SphereGeometry(1, 96, 64), []);
  // Shared and cached by `vfx.ts`: never disposed here.
  const flash = useMemo(fireTexture, []);
  useEffect(() => () => {
    fire.geometry.dispose(); fire.material.dispose();
    disc.dispose(); glow.dispose(); ash.dispose(); shell.dispose();
  }, [fire, disc, glow, ash, shell]);

  const root = useRef<THREE.Group>(null);
  const rehearsal = useRef<Rehearsal | null>(null);
  const [live, setLive] = useState(false);
  const shownLive = useRef(false);
  const lifted = useRef<THREE.Group>(null);
  const fireMesh = useRef<THREE.InstancedMesh>(null);
  const discMesh = useRef<THREE.Mesh>(null);
  const flashSprite = useRef<THREE.Sprite>(null);
  const starSprite = useRef<THREE.Sprite>(null);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);
  const at = useMemo(() => new THREE.Vector3(), []);

  /** A quad drawn a little toward the camera, so it reads over the ground it rises from without clipping into the world. */
  const place = (mesh: THREE.InstancedMesh, index: number, position: THREE.Vector3, size: number, spin: number, camera: THREE.Camera) => {
    toCamera.copy(camera.position).sub(centre).normalize().multiplyScalar(radius * 0.3);
    scratch.position.copy(position).add(toCamera);
    scratch.quaternion.copy(camera.quaternion);
    scratch.rotateZ(spin);
    scratch.scale.setScalar(size);
    scratch.updateMatrix();
    mesh.setMatrixAt(index, scratch.matrix);
  };

  useFrame(({ camera, size }) => {
    const seconds = (serverNow() - event.at) / 1000;
    const visible = Number.isFinite(seconds) && seconds >= 0 && seconds < NUKE_SECONDS;
    if (visible !== shownLive.current) { shownLive.current = visible; setLive(visible); }
    if (!root.current) return;
    rehearsal.current ??= createRehearsal(root.current);
    if (!visible) {
      // Before the moment: one part a frame drawn unseen until each has drawn once. After it: hidden.
      if (seconds >= NUKE_SECONDS) rehearsal.current.end();
      if (!rehearsal.current.next()) root.current.visible = false;
      return;
    }
    rehearsal.current.end();
    root.current.visible = true;
    const R = radius;
    if (!aimed.current) {
      aimed.current = true;
      toCamera.copy(camera.position).sub(centre);
      SCREEN_UP.set(0, 1, 0).applyQuaternion(camera.quaternion);
      axis.set(...nukeStrikeAxis([toCamera.x, toCamera.y, toCamera.z], [SCREEN_UP.x, SCREEN_UP.y, SCREEN_UP.z], event.id));
      across[0].crossVectors(axis, Math.abs(axis.y) < 0.9 ? SCREEN_UP.set(0, 1, 0) : SCREEN_UP.set(1, 0, 0)).normalize();
      across[1].crossVectors(axis, across[0]).normalize();
      ground.copy(axis).multiplyScalar(R);
    }
    if (!heard.current) {
      heard.current = true;
      if (seconds < 0.5) playSceneSound(event.sound ?? 'strategic', centre, camera, Math.max(0, Math.min(1, event.intensity)), `strategic:${event.id}`);
    }
    // Seen from across the disc the strike keeps a few pixels of world radius (owner, 2026-10-16). Only
    // what rises off the world grows, about the strike point so it stays on the ground; the shock and
    // ash stay on the surface, never a halo around the world.
    const lift = screenFloorScale(R, centre, camera, size.height, BLAST_MIN_PIXELS);
    lifted.current?.scale.setScalar(lift);
    lifted.current?.position.copy(ground).multiplyScalar(1 - lift);
    const layer = nukeLayers(seconds);
    age.current = seconds;
    cloudLayer.current = { capProgress: layer.capProgress, columnHeight: layer.columnHeight, heat: layer.heat, cap: layer.cap, column: layer.column };

    glow.uniforms.uAngle!.value = layer.ringAngle;
    glow.uniforms.uRing!.value = layer.ring;
    glow.uniforms.uEmber!.value = layer.ember;
    glow.uniforms.uHeat!.value = layer.heat;
    glow.uniforms.uLight!.value = layer.light;
    glow.uniforms.uFlash!.value = layer.flash;
    ash.uniforms.uAngle!.value = layer.ringAngle;
    ash.uniforms.uAsh!.value = layer.ash;

    for (const [sprite, scale, opacity] of [[flashSprite.current, 2.6 + 3.5 * (1 - layer.flash), layer.flash], [starSprite.current, 6.5, layer.flash * 0.95]] as const) {
      if (!sprite) continue;
      sprite.visible = opacity > 0.002;
      sprite.position.copy(ground).addScaledVector(axis, R * 0.08);
      sprite.scale.setScalar(R * scale);
      sprite.material.opacity = opacity;
    }

    if (discMesh.current) {
      discMesh.current.visible = layer.disc > 0.002;
      discMesh.current.position.copy(ground).addScaledVector(axis, R * (0.22 + 0.12 * layer.discProgress));
      discMesh.current.quaternion.setFromUnitVectors(Z, axis);
      discMesh.current.scale.setScalar(R * (0.3 + 1.7 * layer.discProgress));
      disc.uniforms.uFrame!.value = Math.min(15, layer.discProgress * 15);
      disc.uniforms.uAlpha!.value = layer.disc * 0.85;
    }

    const top = R * (0.08 + 1.15 * layer.columnHeight);
    const fireNode = fireMesh.current;
    if (fireNode) {
      const core = Math.max(layer.fireball, layer.cap * layer.heat * 0.75);
      fireNode.visible = core > 0.002;
      for (let i = 0; i < FIRE_PUFFS; i++) {
        // 0 rises into the cap as its core; 1–2 are the dome left burning on the ground; 3–4 ride up beside the core.
        const main = i === 0;
        const dome = i === 1 || i === 2;
        const angle = (i / (FIRE_PUFFS - 1)) * Math.PI * 2;
        const spread = R * (0.14 + 0.4 * layer.capProgress) * (0.5 + 0.5 * layer.fireProgress);
        at.copy(ground);
        if (dome) at.addScaledVector(axis, R * 0.05).addScaledVector(across[0], (i === 1 ? -1 : 1) * R * 0.13 * (0.4 + layer.fireProgress));
        else {
          at.addScaledVector(axis, Math.max(R * 0.06, top * (main ? 0.9 : 0.8)));
          if (!main) at.addScaledVector(across[0], Math.cos(angle) * spread).addScaledVector(across[1], Math.sin(angle) * spread);
        }
        const puff = main ? 0.75 + 0.7 * Math.sqrt(layer.fireProgress) : dome ? 0.5 + 0.35 * layer.fireProgress : 0.45 + 0.4 * layer.fireProgress;
        place(fireNode, i, at, R * puff, angle + seconds * 0.15, camera);
        fire.frames.setX(i, Math.min(main ? 30 : 40, layer.fireProgress * 63 + (main ? 0 : 3)));
        fire.alpha.setX(i, (dome ? layer.fireball : core) * (main ? 1 : 0.85));
        const white = layer.flash;
        fire.colours.setXYZ(i, 1.25 + 0.6 * white, 1.1 + 0.5 * white, 1 + 0.4 * white);
      }
      fireNode.instanceMatrix.needsUpdate = true;
      fire.frames.needsUpdate = true; fire.alpha.needsUpdate = true; fire.colours.needsUpdate = true;
    }
  });

  return (
    <group ref={root} position={event.position} visible={false} name="death-star-nuclear-strike">
      <HoldRate fps={FULL_RATE_FPS} active={live} />
      {/* Never culled: a part must draw to rehearse, even with the world off screen. */}
      <mesh geometry={shell} material={ash} scale={radius * 1.004} frustumCulled={false} renderOrder={1313} raycast={() => null} />
      <mesh geometry={shell} material={glow} scale={radius * 1.012} frustumCulled={false} renderOrder={1314} raycast={() => null} />
      <group ref={lifted}>
      <NukeCloud map={smokeMap!} radius={radius} axis={axis} across={across} sun={SUN} layer={cloudLayer} seconds={age} />
      <instancedMesh ref={fireMesh} args={[fire.geometry, fire.material, FIRE_PUFFS]} frustumCulled={false} renderOrder={1316} raycast={() => null} />
      <mesh ref={discMesh} material={disc} frustumCulled={false} renderOrder={1317} raycast={() => null}><planeGeometry args={[1, 1]} /></mesh>
      <sprite ref={flashSprite} frustumCulled={false} renderOrder={1318} visible={false} raycast={() => null}>
        <spriteMaterial map={flash} color="#fff6e8" opacity={0} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={starSprite} frustumCulled={false} renderOrder={1319} visible={false} raycast={() => null}>
        <spriteMaterial map={flareMap} color="#ffffff" opacity={0} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      </group>
    </group>
  );
}
