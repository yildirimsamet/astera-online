import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { toWorld, type Vec3 } from '@astera/rules';
import type { DepartureBeam } from './mainSky.js';

const SEGMENTS = 2;

/** One neighbour's streak toward the main galaxy, a thin line that keeps pulsing as it fades. */
function Beam({ beam, offset }: { beam: DepartureBeam; offset: Vec3 }) {
  const line = useMemo(() => {
    const target = new THREE.Vector3(...toWorld(offset));
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...beam.at), target]);
    const colours = new Float32Array((SEGMENTS) * 3);
    colours.set([0.55, 0.85, 1, 0, 0.1, 0.25]);
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  }, [beam.at, offset]);
  useEffect(() => () => { line.geometry.dispose(); if (line.material instanceof THREE.Material) line.material.dispose(); }, [line]);
  useFrame(({ clock }) => {
    if (line.material instanceof THREE.LineBasicMaterial) line.material.opacity = beam.strength * (0.6 + Math.sin(clock.elapsedTime * 2.1) * 0.25);
  });
  return <primitive object={line} raycast={() => null} />;
}

/** The sky remembers who just left. Cheap on purpose: one line per departure in the last ten minutes. */
export function DepartureBeams({ beams, offset }: { beams: readonly DepartureBeam[]; offset: Vec3 }) {
  return <>{beams.map(beam => <Beam key={beam.name} beam={beam} offset={offset} />)}</>;
}
