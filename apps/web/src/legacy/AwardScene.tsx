/**
 * THE PIECES OF THE 3D SHOWCASE AND THE DETAIL STAGE.
 *
 * The cabinet and the stage are painted (`/assets/legacy/*.webp`); only the awards are 3D,
 * drawn on a transparent canvas laid exactly over the painting. No real-time lights beyond
 * one key light: a baked room environment gives the metal its reflections, and a soft
 * painted disc stands in for the contact shadow (owner rule: cheap tricks over costly passes).
 */
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { awardStudioRoom } from './studio.js';
import { isAppActive, watchAppActivity } from '../platform/activity.js';
import { Exhaust } from '../galaxy/Fleets.js';
import { StrategicExhaust } from '../galaxy/StrategicExhaust.js';
import { buildAward, type BuiltAward } from './awardObject.js';
import { legacyArt, legacyFinish, legacyEditionLabel } from './presentation.js';
import type { LegacyAward } from '../api/legacySchemas.js';

/** A frame rate a turntable needs and no more; paused while unseen. */
export const TURNTABLE_FPS = 30;

/** Ask for frames at `fps` while the canvas is on screen and the app is in front. */
export function TurntableFrames({ fps = TURNTABLE_FPS }: { fps?: number }) {
  const invalidate = useThree(state => state.invalidate);
  const element = useThree(state => state.gl.domElement);
  useEffect(() => {
    let visible = true;
    let timer = 0;
    const stop = () => { window.clearInterval(timer); timer = 0; };
    const sync = () => {
      if (visible && isAppActive()) {
        if (timer === 0) timer = window.setInterval(() => { invalidate(); }, 1000 / fps);
      } else stop();
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      sync();
    });
    observer?.observe(element);
    const stopActivity = watchAppActivity(sync);
    sync();
    return () => { stop(); observer?.disconnect(); stopActivity(); };
  }, [element, fps, invalidate]);
  return null;
}

/** The room the metal reflects, generated once per renderer. */
export function StudioLight({ keyIntensity = 2.4 }: { keyIntensity?: number }) {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = awardStudioRoom();
    const texture = generator.fromScene(room, 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.85;
    return () => { scene.environment = null; texture.dispose(); generator.dispose(); room.dispose(); };
  }, [gl, scene]);
  return <>
    <ambientLight intensity={0.25} />
    {/* The painted spotlights fall from above and slightly in front. */}
    <directionalLight position={[0.2, 3, 2.2]} intensity={keyIntensity} color="#ffe2b8" />
    <directionalLight position={[-2, 0.6, 1.5]} intensity={0.45} color="#9fd8ff" />
  </>;
}

const shadowTexture = (() => {
  let texture: THREE.Texture | null = null;
  return () => {
    if (texture) return texture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    texture = new THREE.CanvasTexture(canvas);
    return texture;
  };
})();

/** A soft dark disc where a standing piece meets its plinth. */
function ContactShadow({ width }: { width: number }) {
  const map = useMemo(shadowTexture, []);
  return <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={-1}>
    <planeGeometry args={[width, width * 0.55]} />
    <meshBasicMaterial map={map} transparent depthWrite={false} />
  </mesh>;
}

/** Built once per award identity; disposed when it leaves the shelf. */
export function useBuiltAward(award: LegacyAward | null): BuiltAward | null {
  const [built, setBuilt] = useState<BuiltAward | null>(null);
  const definitionId = award?.definitionId, tier = award?.tier, rarity = award?.rarity;
  const edition = award ? legacyEditionLabel(award) : null;
  useEffect(() => {
    if (definitionId === undefined || tier === undefined || rarity === undefined) { setBuilt(null); return; }
    const art = legacyArt({ definitionId, tier, rarity });
    if (!art) return;
    let alive = true;
    let current: BuiltAward | null = null;
    void buildAward(art, legacyFinish({ definitionId, tier, rarity }), edition).then(next => {
      if (!alive) { next.dispose(); return; }
      current = next;
      setBuilt(next);
    }).catch(() => undefined);
    return () => { alive = false; current?.dispose(); setBuilt(null); };
  }, [definitionId, tier, rarity, edition]);
  return built;
}

/** The same native nozzle attachments and exhaust renderers used by the galaxy. */
export function AwardEngines({ built }: { built: BuiltAward | null }) {
  const engines = built?.engines;
  if (!engines) return null;
  return createPortal(<Suspense fallback={null}>
    {engines.url.includes('death_star') ? <StrategicExhaust scale={1} />
      : <Exhaust url={engines.url} colour="#8fd8ff" scale={1} />}
  </Suspense>, engines.mount);
}

/**
 * One award on one plinth. Standing pieces sway a quarter turn so their face stays to the
 * room; floating pieces hover a hand above the plinth and turn all the way round.
 */
export function PlinthAward({ award, scale, phase = 0, children }: {
  award: LegacyAward | null; scale: number; phase?: number; children?: ReactNode;
}) {
  const built = useBuiltAward(award);
  const turn = useRef<THREE.Group>(null);
  const appear = useRef(0);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { appear.current = 0; invalidate(); }, [built, invalidate]);
  useFrame((state, delta) => {
    const group = turn.current;
    if (!group || !built) return;
    const t = state.clock.elapsedTime + phase;
    appear.current = Math.min(1, appear.current + delta * 3);
    const eased = 1 - (1 - appear.current) ** 3;
    group.scale.setScalar(scale * (0.86 + 0.14 * eased));
    group.rotation.y = built.motion === 'spin' ? t * 0.45 : Math.sin(t * 0.5) * 0.42;
    group.position.y = built.hovers ? scale * (0.1 + Math.sin(t * 1.3) * 0.025) : 0;
  });
  return <group>
    {built && <ContactShadow width={scale * (built.hovers ? 0.55 : 0.8)} />}
    <group ref={turn} scale={scale * 0.86}>
      {built && <primitive object={built.object} />}
      <AwardEngines built={built} />
    </group>
    {children}
  </group>;
}
