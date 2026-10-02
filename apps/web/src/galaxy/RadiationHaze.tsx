import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW, toWorld } from '@astera/rules';
import type { RadiationSourceView } from '../api/schemas.js';
import { drawnClouds, hazeAlpha } from '../lib/radiation.js';
import { useNow } from '../lib/time.js';

/**
 * RADIATION, DRAWN. Owner decision K3 (`plan.md` F10): a simple greenish-yellow haze.
 *
 * ONE SPHERE PER LIT CLOUD, AT THE SERVER'S GEOMETRY — the exact sphere the dose is
 * solved against, through the same `toWorld` every other boundary uses, so where the
 * haze stops is where the dose stops.
 *
 * A GAS, NOT A SHELL. A cloud is thickest where a line of sight crosses the most of it —
 * through the middle — and thins to nothing at the edge, so the alpha follows how
 * squarely the surface faces the eye and the silhouette fades out rather than drawing a
 * rim. (Weighted to the limb, the first version read as a solid yellow planet.)
 *
 * ONLY THE FAR SIDE IS DRAWN. From outside that is one layer instead of two stacked
 * ones; from inside — `SensorRings` learned the camera often is — it is the wall that
 * surrounds you, a faint tint that says you are in it.
 *
 * CHEAP. Additive, no depth write, a 32×24 sphere and a value-noise drift in the
 * fragment; one draw per cloud, and v1 only ever has the operator's few (K4). A shelter
 * is not drawn: it cancels a dose, and a second shape would read as a second cloud.
 */

const COLOUR = new THREE.Color('#d8f04a');

const vertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColour;
  uniform float uAlpha;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float depth = pow(facing, 1.6);
    float drift = noise(vLocal * 2.6 + vec3(uTime * 0.04, uTime * 0.025, -uTime * 0.03));
    float a = uAlpha * depth * (0.6 + 0.8 * drift);
    gl_FragColor = vec4(uColour, a);
  }
`;

function Cloud({ cloud }: { cloud: RadiationSourceView }) {
  const centre = useMemo(() => toWorld(cloud.center), [cloud.center]);
  const uniforms = useMemo(() => ({
    uColour: { value: COLOUR },
    uAlpha: { value: hazeAlpha(cloud.intensityPctPerMinute) },
    uTime: { value: 0 },
  }), [cloud.intensityPctPerMinute]);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
  });

  return (
    <mesh position={centre} scale={cloud.radius / VIEW.scale} renderOrder={-30} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function RadiationHaze({ clouds }: { clouds: readonly RadiationSourceView[] }) {
  /*
    ON A SLOW CLOCK, NOT ON THE GALAXY'S REFETCH. A cloud lit "now" arrives a moment
    before this device's estimate of the server's clock reaches its start, and one set to
    light later arrives long before it — drawn off the payload alone, either would wait
    for an unrelated re-render to appear. Five seconds is plenty for a haze.
  */
  const now = useNow(5_000);
  const lit = drawnClouds(clouds, now);
  return (
    <>
      {lit.map((cloud) => <Cloud key={cloud.id} cloud={cloud} />)}
    </>
  );
}
