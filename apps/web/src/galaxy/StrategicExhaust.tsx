import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SkinAssetBoundary } from './SkinAssetBoundary.js';
import { jetParticle, type JetParticle } from './rocketJet.js';
import { nativeEngineAnchors } from './engineAnchors.js';
import { MODEL } from '../ui/assets.js';

const GRUNGE = '/assets/vfx/premium-v2/thruster-grunge.webp';
const NOISE = '/assets/vfx/premium-v2/thruster-noise.webp';
const COUNT = 64;
const NOZZLE = nativeEngineAnchors(MODEL.deathStar)?.[0] ?? [0, 0, -0.48];

/** GD RocketThrusterExhaustFX: velocity-aligned 3×3 grunge sprites with noise.
 * One instanced draw replaces the Niagara emitter; the stream stays nozzle-sized.
 */
export function StrategicExhaust({ scale }: { scale: number }) {
  return <SkinAssetBoundary fallback={null}><Suspense fallback={null}>
    <RocketPlume scale={scale} />
  </Suspense></SkinAssetBoundary>;
}

function RocketPlume({ scale }: { scale: number }) {
  const [grunge, noise] = useTexture([GRUNGE, NOISE]);
  const root = useRef<THREE.Group>(null), stream = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const result = new THREE.PlaneGeometry(1, 1);
    result.setAttribute('aAge', new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1));
    result.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1));
    result.setAttribute('aFrame', new THREE.InstancedBufferAttribute(Float32Array.from({ length: COUNT }, (_, i) => i % 9), 1));
    return result;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uGrunge: { value: grunge }, uNoise: { value: noise }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute float aAge; attribute float aAlpha; attribute float aFrame;
      varying vec2 vUv; varying float vAge; varying float vAlpha; varying float vFrame;
      void main() {
        vUv=uv; vAge=aAge; vAlpha=aAlpha; vFrame=aFrame;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uGrunge; uniform sampler2D uNoise; uniform float uTime;
      varying vec2 vUv; varying float vAge; varying float vAlpha; varying float vFrame;
      void main() {
        vec2 cell=vec2(mod(vFrame,3.0),2.0-floor(vFrame/3.0));
        float noise=texture2D(uNoise,fract(vUv*0.7+vec2(vFrame*0.17,uTime*0.5))).r;
        float cloud=texture2D(uGrunge,(cell+vUv)/3.0).r;
        float edge=1.0-smoothstep(0.3,0.5,length(vUv-0.5));
        float density=cloud*edge*(0.9+noise*0.2);
        vec3 heat=mix(vec3(1.8,0.7,0.13),vec3(2.8,2.4,1.85),smoothstep(0.03,0.18,vAge));
        heat=mix(heat,vec3(0.5,0.15,1.2),smoothstep(0.35,0.7,vAge));
        heat=mix(heat,vec3(0.035,0.13,1.0),smoothstep(0.72,0.95,vAge));
        gl_FragColor=vec4(heat,density*vAlpha);
      }
    `,
  }), [grunge, noise]);
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const particle = useMemo<JetParticle>(() => ({ x: 0, y: 0, z: 0, width: 0, length: 0, age: 0, alpha: 0, frame: 0 }), []);
  const world = useMemo(() => new THREE.Quaternion(), []), facing = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock, camera }) => {
    const node = stream.current;
    if (!node || !root.current) return;
    root.current.getWorldQuaternion(world);
    axis.set(0, 0, -1).applyQuaternion(world).applyQuaternion(facing.copy(camera.quaternion).invert());
    facing.copy(world).invert().multiply(camera.quaternion);
    const angle = Math.atan2(axis.y, axis.x) - Math.PI / 2;
    const ages = geometry.getAttribute('aAge'), alphas = geometry.getAttribute('aAlpha');
    for (let i = 0; i < COUNT; i++) {
      jetParticle(i, COUNT, clock.elapsedTime, particle);
      scratch.position.set(particle.x, particle.y, particle.z);
      scratch.quaternion.copy(facing); scratch.rotateZ(angle);
      scratch.scale.set(particle.width, particle.length, 1);
      scratch.updateMatrix(); node.setMatrixAt(i, scratch.matrix);
      ages.setX(i, particle.age); alphas.setX(i, particle.alpha);
    }
    node.instanceMatrix.needsUpdate = true; ages.needsUpdate = true; alphas.needsUpdate = true;
    material.uniforms.uTime!.value = clock.elapsedTime;
  });
  return <group ref={root} name="death-star-rocket-exhaust" position={[NOZZLE[0] * scale, NOZZLE[1] * scale, NOZZLE[2] * scale]} scale={scale}>
    <instancedMesh ref={stream} args={[geometry, material, COUNT]} name="rocket-velocity-aligned-fire" frustumCulled={false} renderOrder={1001} raycast={() => null} />
  </group>;
}
