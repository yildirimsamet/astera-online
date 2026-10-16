import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { motionPositionAt, toWorld } from '@astera/rules';
import type { HpRadiationSourceView, PublicMonument } from '../api/schemas.js';
import type { PlanetNode } from './scene.js';
import { serverNow } from '../lib/clock.js';
import { useNow } from '../lib/time.js';
import { radiationAtTarget } from '../lib/targetRadiation.js';
import { recentHitAges, rememberStarts, screenFloorScale } from './publicMoments.js';

/** The smallest world radius, in screen pixels, a radiation cloud is drawn around. */
const CLOUD_MIN_PIXELS = 7;

const vertex = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
/** Detonations one cloud carries at once: a level-1/2/3 salvo from two worlds, with room to spare. */
const HIT_SLOTS = 6;

const fragment = `
varying vec2 vUv;
uniform sampler2D uSmoke;
uniform float uTime;
uniform float uHitAges[${String(HIT_SLOTS)}];
uniform float uStrength;
mat2 spin(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
float fog(vec2 uv,float a,float s){vec2 p=spin(a)*(uv-.5)*s+.5;return texture2D(uSmoke,clamp(p,0.,1.)).a;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float billow(vec2 p){return noise(p)*.55+noise(p*2.07+4.7)*.3+noise(p*4.13-7.1)*.15;}
void main(){
  vec2 p=vUv-.5; float r=length(p);
  float wisps=fog(vUv,uTime*.018,1.2)*.6+fog(vUv,-uTime*.013+.8,1.65)*.4;
  float turbulence=billow(p*15.+vec2(uTime*.08,-uTime*.055));
  float edge=1.-smoothstep(.32,.49,r+(turbulence-.5)*.09);
  float rim=smoothstep(.13,.3,r)*edge;
  float lingering=wisps*rim*(.26+.18*uStrength);
  // Every recent hit runs its own detonation; a burst layers them instead of restarting one.
  float mass=0.,heat=0.,front=0.,smoke=0.;
  for(int i=0;i<${String(HIT_SLOTS)};i++){
    float age=uHitAges[i];
    if(age<0.)continue;
    float life=1.-smoothstep(.6,3.6,age);
    if(life<=0.)continue;
    float expansion=.14+.29*(1.-exp(-age*2.4));
    float rolling=billow(p*17.-vec2(age*.38,age*.9)+float(i)*3.7);
    float m=(1.-smoothstep(expansion*.6,expansion,r+(rolling-.5)*.105))*life;
    mass=max(mass,m);
    heat=max(heat,exp(-age*1.55)*m*(.35+rolling*.85));
    // A broad, turbulent pressure front and dense ion cloud; no radial spark streaks.
    front=max(front,exp(-pow((r-expansion)/.065,2.))*exp(-age*1.8)*life*(.35+rolling*.65));
    smoke=max(smoke,m*(.25+.5*wisps)*(1.-exp(-age*3.)));
  }
  float alpha=clamp(lingering+mass*.65+front*.28,0.,.9)*edge;
  vec3 cool=mix(vec3(.26,.38,.12),vec3(.55,.74,.27),turbulence);
  vec3 colour=cool*(.7+smoke*.4)+vec3(.55,.95,.24)*(heat*1.9+front*.55);
  colour+=vec3(.75,.92,.53)*pow(heat,3.)*.7;
  gl_FragColor=vec4(colour,alpha);
}`;

/** One combined, depth-tested billboard per irradiated body; stack count never multiplies draw calls. */
export function RadiationBombEffects({ sources, nodes, monuments }: {
  sources: readonly HpRadiationSourceView[]; nodes: readonly PlanetNode[]; monuments: readonly PublicMonument[];
}) {
  const now = useNow(1000);
  /*
    WHEN EACH HIT STARTS ON THIS SCREEN. A bystander — and, with the worker waking once a
    second, often the attacker too — reads a new source from the refetch the hit triggers,
    about a second late; its detonation then plays from discovery rather than half over, and a
    burst read together keeps its spacing (`rememberStarts`). Remembered per source so a later
    refetch does not restart it.
  */
  const starts = useRef(new Map<string, number>());
  const targets = useMemo(() => {
    const live = sources.flatMap((source) => source.origin === 'BOMB' && source.target
      && !(source.activeUntil && source.activeUntil.getTime() <= now) ? [{ source, target: source.target }] : []);
    rememberStarts(starts.current, live.map(({ source }) => ({ id: source.id, at: source.activeFrom.getTime() })), serverNow());
    const grouped = new Map<string, { kind: 'PLANET' | 'MONUMENT'; id: string; hits: number[]; until: number }>();
    for (const { source, target } of live) {
      const key = `${target.kind}:${target.id}`;
      const hit = starts.current.get(source.id) ?? source.activeFrom.getTime();
      const previous = grouped.get(key);
      if (previous) {
        previous.hits.push(hit);
        previous.until = Math.max(previous.until, source.activeUntil?.getTime() ?? Infinity);
      } else grouped.set(key, { ...target, hits: [hit], until: source.activeUntil?.getTime() ?? Infinity });
    }
    return [...grouped.values()].map(target => ({ ...target, hits: target.hits.sort((a, b) => a - b) }));
  }, [sources, now]);
  return <>{targets.map(target => {
    const node = target.kind === 'PLANET' ? nodes.find(item => item.id === target.id) : undefined;
    const monument = target.kind === 'MONUMENT' ? monuments.find(item => item.id === target.id) : undefined;
    // Mount known future hits early; the shader's server clock opens them on the exact impact frame.
    const state = radiationAtTarget(target, sources, Math.max(now, target.hits[0]!));
    if ((!node && !monument) || !state) return null;
    return <RadiationAura key={`${target.kind}:${target.id}`} position={node?.position ?? toWorld(monument!.position)}
      motion={monument?.motion} size={node ? node.radius * 3.8 : 3.3} hits={target.hits} until={target.until} rate={state.rate} />;
  })}</>;
}

function RadiationAura({ position, motion, size, hits, until, rate }: {
  position: readonly [number, number, number]; motion: PublicMonument['motion'] | undefined;
  size: number; hits: readonly number[]; until: number; rate: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const smoke = useLoader(THREE.TextureLoader, '/assets/fx/radiation-smoke.png');
  const ages = useMemo(() => new Array<number>(HIT_SLOTS).fill(-1), []);
  const material = useMemo(() => new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
    uniforms: { uSmoke: { value: smoke }, uTime: { value: 0 },
      uHitAges: { value: ages }, uStrength: { value: 0 } }, transparent: true, depthWrite: false,
    depthTest: true, blending: THREE.NormalBlending, side: THREE.DoubleSide, toneMapped: false }), [smoke, ages]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(({ camera, size: viewport }) => {
    const now = serverNow();
    material.uniforms.uTime!.value = (now % 3600000) / 1000;
    recentHitAges(hits, now, HIT_SLOTS, ages);
    material.uniforms.uStrength!.value = Math.min(1, rate / 50);
    if (mesh.current) {
      mesh.current.visible = now >= hits[0]! && now < until;
      mesh.current.quaternion.copy(camera.quaternion);
      mesh.current.position.set(...(motion ? toWorld(motionPositionAt(motion, now)) : position));
      // From across the disc the cloud keeps a few pixels of body radius (owner, 2026-10-16).
      const drawn = size * screenFloorScale(size / 3.8, mesh.current.position, camera, viewport.height, CLOUD_MIN_PIXELS);
      mesh.current.scale.setScalar(drawn);
      offset.copy(camera.position).sub(mesh.current.position).normalize().multiplyScalar(drawn * .28);
      mesh.current.position.add(offset);
    }
  });
  return <mesh ref={mesh} position={position} scale={size} material={material} raycast={() => undefined}>
    <planeGeometry args={[1, 1]} />
  </mesh>;
}
