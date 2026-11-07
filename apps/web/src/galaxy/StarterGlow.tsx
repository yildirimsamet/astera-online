import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { softGlow } from './Environment.js';
import { starterGlowDirections } from './mainSky.js';

/**
 * WHERE YOU CAME FROM, in the main galaxy's sky (A18). A handful of faint lights on the far sky in one
 * draw call. No data, no tap, nothing to read: only that those places are really out there.
 */
export function StarterGlow() {
  const far = useThree(state => (state.camera instanceof THREE.PerspectiveCamera ? state.camera.far : 6000));
  const { geometry, material } = useMemo(() => {
    const positions = starterGlowDirections().flatMap(([x, y, z]) => [x * far * 0.8, y * far * 0.8, z * far * 0.8]);
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return {
      geometry: made,
      material: new THREE.PointsMaterial({ map: softGlow(), color: '#8fc7ff', size: 26, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
  }, [far]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} raycast={() => null} frustumCulled={false} />;
}
