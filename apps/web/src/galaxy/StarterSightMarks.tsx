import { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { AsteroidView, Contact } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useStarterLesson } from '../starter/tutorial/visualGoal.js';
import { lessonContact, sightLesson } from '../starter/tutorial/sightLesson.js';
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
  if (!device || !post) return null;
  if (id==='findRock' && seasonStart) {
    const nearest = nearestRock(asteroids, post.at, minutesInto(seasonStart));
    return <>{asteroids.map(rock=><RockMark key={rock.id} rock={rock} seasonStart={seasonStart} pointed={rock.id===nearest}/>)}</>;
  }
  return contact ? <MovingMark contact={contact} nodes={nodes}/> : null;
}
