import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { starterGlowDirections } from './mainSky.js';

/**
 * The same spiral the first galaxies' screens show, cut for the sky: the badge's navy ground taken
 * out and its edge faded to black. Drawn additively, the badge itself added its ground too and hung
 * in the sky as a pale rectangle (owner, 2026-11-20). 248×136.
 */
const GALAXY_URL = '/assets/images/starter/galaxy-badge-sky.webp';
const GALAXY_ASPECT = 136 / 248;

/**
 * Light added to the sky. Out of the scene fog: the sprites hang past its far edge, where fog turns
 * any lit pixel into its own navy — added to the sky, each galaxy became a flat rectangle that came
 * and went with the camera's distance (owner, 2026-11-20).
 */
export const SKY_GALAXY_MATERIAL = {
  sizeAttenuation: false,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
} as const;

/**
 * WHERE YOU CAME FROM, in the main galaxy's sky (A18). No data, no tap, nothing to read: only that
 * those places are really out there.
 *
 * VFX brief (owner 2026-11-18: no round glow anywhere). In the world: the first galaxies hang far off
 * in the main galaxy's sky, each a small spiral turned its own way. Asset:
 * `assets/images/starter/galaxy-badge-sky.webp`, the spiral the starter screens use. Why: a galaxy looks
 * like a galaxy; a blur of light says nothing about where you came from.
 */
function Galaxies() {
  const map = useTexture(GALAXY_URL);
  const far = useThree(state => (state.camera instanceof THREE.PerspectiveCamera ? state.camera.far : 6000));
  const galaxies = useMemo(() => starterGlowDirections().map(([x, y, z], index) => ({
    at: [x * far * 0.8, y * far * 0.8, z * far * 0.8] as const,
    // Screen-fixed sizes a little apart, so they read as near and far, each turned its own way.
    width: 0.034 + 0.012 * ((index * 5) % 3) / 2,
    turn: index * 1.13,
  })), [far]);
  return (
    <>
      {galaxies.map(({ at, width, turn }, index) => (
        <sprite key={index} position={[...at]} scale={[width, width * GALAXY_ASPECT, 1]} raycast={() => null}>
          <spriteMaterial map={map} rotation={turn} {...SKY_GALAXY_MATERIAL} />
        </sprite>
      ))}
    </>
  );
}

export function StarterGlow() {
  return <Suspense fallback={null}><Galaxies /></Suspense>;
}
