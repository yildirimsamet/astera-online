import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, type ShaderMaterial } from 'three';
import { createProbeBeamGeometry, hasProbeSkinBeam, probeBeamFragment, probeBeamVertex } from './probeSkinBeam.js';

const skipRaycast = () => undefined;

/** Shared by flight hulls and every cosmetic model preview. It scales with the UFO body. */
export function ProbeSkinBeam({ url, bodySize = 1, still = false }: { url: string; bodySize?: number; still?: boolean }) {
  return hasProbeSkinBeam(url) ? <BeamVolume bodySize={bodySize} still={still} /> : null;
}

function BeamVolume({ bodySize, still }: { bodySize: number; still: boolean }) {
  const geometry = useMemo(createProbeBeamGeometry, []);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 2.7 } }), []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useFrame(({ clock }) => {
    if (!still && material.current) material.current.uniforms.uTime!.value = clock.elapsedTime;
  });
  return <group name="ufo-probe-beam" scale={bodySize}>
    <mesh name="ufo-light-volume" geometry={geometry} raycast={skipRaycast}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={probeBeamVertex} fragmentShader={probeBeamFragment}
        transparent depthWrite={false} depthTest side={DoubleSide} forceSinglePass toneMapped={false} blending={AdditiveBlending} />
    </mesh>
    <mesh name="ufo-light-emitter" position={[0, -.15, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={skipRaycast}>
      <circleGeometry args={[.115, 32]} />
      <meshBasicMaterial color="#edf5ff" transparent opacity={.35} depthWrite={false} depthTest side={DoubleSide}
        forceSinglePass toneMapped={false} blending={AdditiveBlending} />
    </mesh>
  </group>;
}
