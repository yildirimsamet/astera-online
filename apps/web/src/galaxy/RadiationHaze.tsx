import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW, toWorld } from '@astera/rules';
import type { HpRadiationSourceView, RadiationSourceView } from '../api/schemas.js';
import { drawnClouds, drawnHpClouds, hazeAlpha, hpHazeAlpha } from '../lib/radiation.js';
import { useNow } from '../lib/time.js';
import { paintRadiationVolume } from './radiationVolume.js';

/**
 * The server's exact sphere, drawn as sparse smoke rather than a tinted shell.
 * Six fixed samples along the view ray reveal depth, warped filaments and clear
 * lanes. Density fades continuously to zero at the boundary. From inside, only
 * the remaining path to the exit contributes, avoiding an opaque enclosing wall.
 * One draw per cloud, one shared 108 KiB density texture and sphere geometry;
 * no per-frame noise baking, particles or post-processing.
 */

const COLOUR = new THREE.Color('#b5d58b');
const COOL_COLOUR = new THREE.Color('#7eaf98');
const LEVEL_ONE_COLOUR = new THREE.Color('#e5cf73');
const LEVEL_ONE_COOL_COLOUR = new THREE.Color('#bfa95f');

const vertex = /* glsl */ `
  out vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp sampler3D;
  uniform sampler3D uDensity;
  uniform vec3 uColour;
  uniform vec3 uCoolColour;
  uniform vec3 uEye;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uPhase;
  in vec3 vLocal;
  out vec4 hazeColour;

  void main() {
    vec3 ray = normalize(vLocal - uEye);
    float b = dot(uEye, ray);
    float chord = sqrt(max(0.0, b * b - dot(uEye, uEye) + 1.0));
    float entry = max(0.0, -b - chord);
    float path = max(0.0, -b + chord - entry);
    vec3 start = uEye + ray * entry;

    // Slow motion in the field, with a different orientation for each cloud.
    float turn = uPhase + uTime * 0.009;
    float tilt = uPhase * 0.71 + uTime * 0.006;
    mat2 spin = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
    mat2 lean = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt));
    float column = 0.0;
    for (int i = 0; i < 6; i++) {
      vec3 p = start + ray * path * ((float(i) + 0.5) / 6.0);
      float envelope = pow(max(0.0, 1.0 - dot(p, p)), 1.35);
      p.xz = spin * p.xz;
      p.xy = lean * p.xy;
      column += texture(uDensity, p * 0.5 + 0.5).r * envelope;
    }
    column *= path / 6.0;
    float density = 1.0 - exp(-column * 3.6);
    // Both opacity and colour thin into the surrounding space, without a rim.
    vec3 colour = mix(uCoolColour, uColour, density);
    hazeColour = vec4(colour, uAlpha * density);
  }
`;

type CloudView = RadiationSourceView | HpRadiationSourceView;

function Cloud({ cloud, volume, geometry }: {
  cloud: CloudView;
  volume: THREE.Data3DTexture;
  geometry: THREE.SphereGeometry;
}) {
  const centre = useMemo(() => toWorld(cloud.center), [cloud.center]);
  const radius = cloud.radius / VIEW.scale;
  const level = 'intensityHpPerMinute' in cloud ? cloud.level : undefined;
  const alpha = 'intensityHpPerMinute' in cloud ? hpHazeAlpha(cloud.intensityHpPerMinute, level) : hazeAlpha(cloud.intensityPctPerMinute);
  const uniforms = useMemo(() => ({
    uDensity: { value: volume },
    uColour: { value: level === 1 ? LEVEL_ONE_COLOUR : COLOUR },
    uCoolColour: { value: level === 1 ? LEVEL_ONE_COOL_COLOUR : COOL_COLOUR },
    uEye: { value: new THREE.Vector3() },
    uAlpha: { value: alpha },
    uTime: { value: 0 },
    uPhase: { value: cloud.center.x * 0.017 + cloud.center.z * 0.029 },
  }), [alpha, level, volume, cloud.center.x, cloud.center.z]);

  useFrame(({ camera }, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uEye.value.set(
      camera.position.x - centre[0],
      camera.position.y - centre[1],
      camera.position.z - centre[2],
    ).divideScalar(radius);
  });

  return (
    <mesh name={`radiation-haze-${cloud.id}`} position={centre} scale={radius} geometry={geometry} renderOrder={-30} frustumCulled={false}>
      <shaderMaterial
        name="RadiationHaze"
        vertexShader={vertex}
        fragmentShader={fragment}
        glslVersion={THREE.GLSL3}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Clouds({ clouds }: { clouds: readonly CloudView[] }) {
  const volume = useMemo(() => paintRadiationVolume(), []);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 32, 24), []);
  useEffect(() => {
    volume.needsUpdate = true;
    return () => {
      volume.dispose();
      geometry.dispose();
    };
  }, [volume, geometry]);
  return clouds.map((cloud) => <Cloud key={cloud.id} cloud={cloud} volume={volume} geometry={geometry} />);
}

export function RadiationHaze({ clouds = [], hpClouds = [] }: { clouds?: readonly RadiationSourceView[]; hpClouds?: readonly HpRadiationSourceView[] }) {
  // A scheduled cloud appears on the server clock without waiting for a refetch.
  const now = useNow(5_000);
  const lit = [...drawnClouds(clouds, now), ...drawnHpClouds(hpClouds, now)];
  return lit.length > 0 ? <Clouds clouds={lit} /> : null;
}
