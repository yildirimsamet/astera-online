import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, type Group } from 'three';
import type { AsteroidView, Contact } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useStarterLesson } from '../starter/tutorial/visualGoal.js';
import { lessonContact, sightLesson } from '../starter/tutorial/sightLesson.js';
import { rockInReach, setRockReach, useRockReach, type ReachRock } from '../starter/tutorial/rockReach.js';
import { nearestRock } from '../starter/neighbour.js';
import { asteroidWorldPosition, contactPosition, type PlanetNode } from './scene.js';
import type { ReachRing } from './SensorRings.js';

/** Over the scene's labels, under the focus panel (`z-20`) that a tap on the mark opens. */
const MARK_LAYER: [number, number] = [15, 15];
/** Owner 2026-11-08: it draws nothing. What is flying, or the red question mark, is the thing to look at. */
const FACE = 'block size-11';
const HALO = 'block size-9 rounded-full border border-white/45 shadow-[0_0_12px_rgba(255,255,255,.3)] animate-[ember_1.8s_ease-in-out_infinite]';
const minutesInto = (start: Date): number => (serverNow() - start.getTime()) / 60_000;
const markOf = (contact: Contact) => contact.kind==='unknown'?'sight-unknown':'sight-craft';
/** The craft a lesson is about, riding its flight. */
function MovingMark({ contact, nodes }: { contact:Contact;nodes:readonly PlanetNode[] }) {
  const group = useRef<Group>(null);
  useFrame(()=>{group.current?.position.set(...contactPosition(contact,serverNow(),nodes));});
  return <group ref={group} position={contactPosition(contact,serverNow(),nodes)}><Html center zIndexRange={MARK_LAYER} style={{pointerEvents:'none'}}>
    <span data-scene-mark="" data-guide={markOf(contact)} className={FACE}/>
  </Html></group>;
}

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

/** The radar's first warning is an event in the sky. */
function useWarned(id: string | undefined, contactId: string | undefined) {
  const told = useRef(false);
  useEffect(()=>{
    if (!contactId || id!=='radarRing' || told.current) return;
    told.current=true;
    playSound('alert'); haptic('warn');
  },[id,contactId]);
}

/** Labels ride actual sensor geometry and actual server-earned traffic. */
export function StarterSightMarks({ sensors, contacts, nodes, asteroids, seasonStart }: { sensors:readonly ReachRing[];contacts:readonly Contact[];nodes:readonly PlanetNode[];asteroids:readonly AsteroidView[];seasonStart:Date|undefined }) {
  const answer = useStarterLesson();
  const device = sightLesson(answer), post=sensors[0];
  const id = answer?.kind==='step'?answer.id:undefined;
  const contact = post ? lessonContact(id,contacts,post) : undefined;
  useWarned(device ? id : undefined, contact?.id);
  const reach = useRockReach();
  if (!device || !post) return null;
  if ((id==='zoomRock' || id==='findRock') && seasonStart) {
    // The hand goes to the rock the player came close to; the nearest only if none is on screen.
    const pointed = id==='findRock' ? reach ?? nearestRock(asteroids, post.at, minutesInto(seasonStart)) : null;
    return <><RockReachWatch rocks={asteroids} seasonStart={seasonStart}/>{asteroids.map(rock=><RockMark key={rock.id} rock={rock} seasonStart={seasonStart} pointed={rock.id===pointed}/>)}</>;
  }
  return contact ? <MovingMark contact={contact} nodes={nodes}/> : null;
}
