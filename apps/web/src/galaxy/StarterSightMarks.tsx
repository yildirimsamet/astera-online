import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, type Group } from 'three';
import type { AsteroidView } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { useStarterLesson } from '../starter/tutorial/visualGoal.js';
import { rockMarks, sightLesson } from '../starter/tutorial/sightLesson.js';
import { rockInReach, setRockReach, useRockReach, type ReachRock } from '../starter/tutorial/rockReach.js';
import { nearestRock } from '../starter/neighbour.js';
import { asteroidWorldPosition } from './scene.js';
import type { ReachRing } from './SensorRings.js';

/** Over the scene's labels, under the focus panel (`z-20`) that a tap on the mark opens. */
const MARK_LAYER: [number, number] = [15, 15];
const HALO = 'block size-9 rounded-full border border-white/45 shadow-[0_0_12px_rgba(255,255,255,.3)] animate-[sight-land_0.5s_cubic-bezier(.2,1.4,.4,1)_both,ember_1.8s_ease-in-out_0.5s_infinite]';
const minutesInto = (start: Date): number => (serverNow() - start.getTime()) / 60_000;
/** A soft ring on each rock of the lesson: at this distance a rock is a few pixels. The first is the hand's. */
function RockMark({ rock, seasonStart, pointed }: { rock:AsteroidView;seasonStart:Date;pointed:boolean }) {
  const group = useRef<Group>(null);
  useFrame(()=>{group.current?.position.set(...asteroidWorldPosition(rock,seasonStart,serverNow()));});
  return <group ref={group} position={asteroidWorldPosition(rock,seasonStart,serverNow())}><Html center zIndexRange={MARK_LAYER} style={{pointerEvents:'none'}}>
    <span data-scene-mark="" {...(pointed?{'data-guide':'sight-rock'}:{})} className={HALO}/>
  </Html></group>;
}

/** Tells the guide, frame by frame, whether a rock of the lesson has come within a finger's reach. */
function RockReachWatch({ rocks, seasonStart }: { rocks:readonly AsteroidView[];seasonStart:Date }) {
  const invalidate = useThree(state=>state.invalidate);
  const list = useMemo<ReachRock[]>(()=>rocks.map(rock=>({id:rock.id,level:rock.level,at:[0,0,0]})),[rocks]);
  useEffect(()=>{invalidate();return ()=>{setRockReach(null);};},[invalidate]);
  useFrame(({camera,size})=>{
    if (!(camera instanceof PerspectiveCamera)) return;
    list.forEach((item,index)=>{item.at=asteroidWorldPosition(rocks[index]!,seasonStart,serverNow());});
    setRockReach(rockInReach(list,camera,size.height));
  });
  return null;
}

/** The rocks of the telescope's first lessons, marked on the sky where they really are. */
export function StarterSightMarks({ sensors, asteroids, seasonStart }: { sensors:readonly ReachRing[];asteroids:readonly AsteroidView[];seasonStart:Date|undefined }) {
  const answer = useStarterLesson();
  const device = sightLesson(answer), post=sensors[0];
  const id = answer?.kind==='step'?answer.id:undefined;
  const reach = useRockReach();
  if (!device || !post || !rockMarks(answer) || !seasonStart) return null;
  // The hand goes to the rock the player came close to; the nearest only if none is on screen.
  const pointed = id==='findRock' ? reach ?? nearestRock(asteroids, post.at, minutesInto(seasonStart)) : null;
  return <>{id!=='telescopeLook' && <RockReachWatch rocks={asteroids} seasonStart={seasonStart}/>}{asteroids.map(rock=><RockMark key={rock.id} rock={rock} seasonStart={seasonStart} pointed={rock.id===pointed}/>)}</>;
}
