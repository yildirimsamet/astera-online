import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useVisualFrame } from './visualFrame.js';
import { streakAlong, streakFade } from './corridorStreaks.js';

const STREAKS = 64;
/** The tube the streaks run in, the span they cross and how long each is, in units of the formation. */
const RING = [1.1, 3.0] as const;
const SPAN = 16;
const LENGTH = [1.6, 3.4] as const;
/** Spans a second the lane runs back past the craft: one crossing in under a second. */
const FLOW = 1.2;
const PEAK = 1;

const seed = (i: number, k: number): number => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * LANE STREAKS ON A CLAN CORRIDOR LEG (owner, 2026-11-24). Thin lines along the heading rush back
 * past the formation, so the wave reads as FAST from what moves past it. The group this sits in
 * already points down +Z; every streak is local to it. One draw, nothing allocated per frame, and
 * each line is born and dies at zero alpha so none pops.
 */
export function LaneStreaks({ unit, colour }: { unit: number; colour: string }) {
  const seeds = useMemo(() => Array.from({ length: STREAKS }, (_, i) => {
    const angle = seed(i, 1) * Math.PI * 2;
    const radius = RING[0] + seed(i, 2) * (RING[1] - RING[0]);
    return {
      x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
      offset: seed(i, 3), length: LENGTH[0] + seed(i, 4) * (LENGTH[1] - LENGTH[0]),
    };
  }), []);
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    made.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(STREAKS * 2), 1));
    return made;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColour: { value: new THREE.Color(colour) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute float aAlpha; varying float vAlpha;
      void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 uColour; varying float vAlpha;
      void main() { gl_FragColor = vec4(mix(uColour, vec3(1.0), vAlpha * 0.5), vAlpha); }
    `,
  }), [colour]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useVisualFrame(({ clock }) => {
    const position = geometry.getAttribute('position'), alpha = geometry.getAttribute('aAlpha');
    if (!(position instanceof THREE.BufferAttribute) || !(alpha instanceof THREE.BufferAttribute)) return;
    const span = SPAN * unit;
    for (let i = 0; i < STREAKS; i++) {
      const s = seeds[i]!;
      const head = streakAlong(s.offset, clock.elapsedTime, span, FLOW * span);
      const fade = streakFade(head, span) * PEAK;
      // The head leads along +Z; the tail trails behind it and is always dark.
      position.setXYZ(i * 2, s.x * unit, s.y * unit, head);
      position.setXYZ(i * 2 + 1, s.x * unit, s.y * unit, head + s.length * unit);
      alpha.setX(i * 2, fade);
      alpha.setX(i * 2 + 1, 0);
    }
    position.needsUpdate = true;
    alpha.needsUpdate = true;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={999} raycast={() => null} name="lane-streaks" />;
}
