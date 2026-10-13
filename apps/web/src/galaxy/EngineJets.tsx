import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useGalaxyCulling, useVisualFrame } from './visualFrame.js';
import { createLocalVisibility, localSphereVisible, engineUnitsRadius } from './formationVisibility.js';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3Tuple } from './scene.js';
import { formationAimDirection } from './flightVisual.js';
import { jetParticle, type JetParticle } from './rocketJet.js';

export interface EngineUnit {
  at: Vec3Tuple;
  nozzles: readonly Vec3Tuple[];
  size: number;
  colour: string;
  intensity: number;
  widthFactor: number;
  lengthFactor: number;
}
const PARTICLES = 24;

/** Velocity-aligned native GD grunge, one draw for all engines in a formation. */
export function EngineJets({ units, aimDistance, name = 'formation-lights' }: {
  units: readonly EngineUnit[]; aimDistance: RefObject<number>; name?: string;
}) {
  const [grunge, noise] = useTexture(['/assets/vfx/premium-v2/thruster-grunge.webp', '/assets/vfx/premium-v2/thruster-noise.webp']);
  const stream = useRef<THREE.InstancedMesh>(null);
  const count = units.reduce((total, unit) => total + unit.nozzles.length * PARTICLES, 0);
  const geometry = useMemo(() => {
    const mesh = new THREE.PlaneGeometry(1, 1);
    mesh.setAttribute('aAge', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    mesh.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    mesh.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    mesh.setAttribute('aFrame', new THREE.InstancedBufferAttribute(Float32Array.from({ length: count }, (_, i) => i % 9), 1));
    return mesh;
  }, [count]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uGrunge: { value: grunge }, uNoise: { value: noise }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute float aAge; attribute float aAlpha; attribute float aFrame; attribute vec3 aTint;
      varying vec2 vUv; varying float vAge; varying float vAlpha; varying float vFrame; varying vec3 vTint;
      void main() {
        vUv=uv; vAge=aAge; vAlpha=aAlpha; vFrame=aFrame; vTint=aTint;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uGrunge; uniform sampler2D uNoise; uniform float uTime;
      varying vec2 vUv; varying float vAge; varying float vAlpha; varying float vFrame; varying vec3 vTint;
      void main() {
        vec2 cell=vec2(mod(vFrame,3.0),2.0-floor(vFrame/3.0));
        float turbulence=texture2D(uNoise,fract(vUv*0.7+vec2(vFrame*0.13,uTime*0.5))).r;
        float cloud=texture2D(uGrunge,(cell+vUv)/3.0).r;
        float edge=1.0-smoothstep(0.25,0.5,length(vUv-0.5));
        vec3 heat=mix(vec3(2.7,2.4,2.0),vTint*(1.7-vAge),smoothstep(0.04,0.35,vAge));
        gl_FragColor=vec4(heat,cloud*edge*(0.85+turbulence*0.2)*vAlpha);
        #include <colorspace_fragment>
      }
    `,
  }), [grunge, noise]);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const particle = useMemo<JetParticle>(() => ({ x: 0, y: 0, z: 0, width: 0, length: 0, age: 0, alpha: 0, frame: 0 }), []);
  const forward = useMemo(() => new THREE.Vector3(0, 0, 1), []), direction = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Quaternion(), []), world = useMemo(() => new THREE.Quaternion(), []), cameraLocal = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []), nozzle = useMemo(() => new THREE.Vector3(), []), offset = useMemo(() => new THREE.Vector3(), []), tint = useMemo(() => new THREE.Color(), []);
  const aimed = useMemo<Vec3Tuple>(() => [0, 0, 1], []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);
  const culling = useGalaxyCulling();
  const visibility = useMemo(createLocalVisibility, []);
  const radius = useMemo(() => engineUnitsRadius(units), [units]);
  useVisualFrame(({ clock, camera }) => {
    const node = stream.current;
    if (!node) return;
    node.visible = !culling || localSphereVisible(visibility, camera, node, radius);
    if (!node.visible) return;
    node.getWorldQuaternion(world);
    cameraLocal.copy(world).invert().multiply(camera.quaternion);
    const ages = geometry.getAttribute('aAge'), alpha = geometry.getAttribute('aAlpha'), colours = geometry.getAttribute('aTint');
    let cursor = 0;
    for (let u = 0; u < units.length; u++) {
      const unit = units[u]!;
      formationAimDirection(unit.at, aimDistance.current, aimed);
      direction.set(...aimed); rotation.setFromUnitVectors(forward, direction);
      axis.copy(direction).negate().applyQuaternion(world).applyQuaternion(scratch.quaternion.copy(camera.quaternion).invert());
      const angle = Math.atan2(axis.y, axis.x) - Math.PI / 2;
      tint.set(unit.colour);
      for (const anchor of unit.nozzles) {
        nozzle.set(...anchor).multiplyScalar(unit.size).applyQuaternion(rotation);
        nozzle.x += unit.at[0]; nozzle.y += unit.at[1]; nozzle.z += unit.at[2];
        for (let i = 0; i < PARTICLES; i++) {
          jetParticle(i, PARTICLES, clock.elapsedTime + u * 0.137, particle);
          offset.set(particle.x * 0.6 * unit.widthFactor, particle.y * 0.6 * unit.widthFactor,
            (-.025 + (particle.z + .025) * unit.lengthFactor) * .55).multiplyScalar(unit.size).applyQuaternion(rotation);
          scratch.position.copy(nozzle).add(offset);
          scratch.quaternion.copy(cameraLocal); scratch.rotateZ(angle);
          scratch.scale.set(particle.width * unit.size * 0.75 * unit.widthFactor, particle.length * unit.size * 0.65 * unit.lengthFactor, 1);
          scratch.updateMatrix(); node.setMatrixAt(cursor, scratch.matrix);
          ages.setX(cursor, particle.age); alpha.setX(cursor, particle.alpha * unit.intensity);
          colours.setXYZ(cursor, tint.r, tint.g, tint.b); cursor++;
        }
      }
    }
    node.instanceMatrix.needsUpdate = true; ages.needsUpdate = true; alpha.needsUpdate = true; colours.needsUpdate = true;
    material.uniforms.uTime!.value = clock.elapsedTime;
  });
  return <instancedMesh ref={stream} args={[geometry, material, count]} name={name} frustumCulled={false} renderOrder={1000} raycast={() => null} />;
}
