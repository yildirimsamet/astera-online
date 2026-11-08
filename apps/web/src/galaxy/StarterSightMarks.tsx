import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Contact } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { Icon } from '../v2/icons.js';
import { moduleName } from '../starter/shipCopy.js';
import { useStarterLesson } from '../starter/tutorial/visualGoal.js';
import { lessonContact, sightLesson } from '../starter/tutorial/sightLesson.js';
import { contactPosition, toWorld, type PlanetNode } from './scene.js';
import type { ReachRing } from './SensorRings.js';

const glyph = (contact: Contact) => contact.kind==='unknown'
  ? <span className="font-v2-mono text-title">?</span>
  : <Icon id={contact.kind==='probe'?'i-probe':contact.kind==='mining'?'i-mine':'i-fleet'} className="size-4"/>;

/** Over the scene's labels, under the focus panel (`z-20`) that a tap on the mark opens. */
const MARK_LAYER: [number, number] = [15, 15];
const FACE = 'grid size-10 place-items-center rounded-full border border-v2-self text-v2-self shadow-[0_0_15px_var(--color-v2-self)] animate-[ember_1.8s_ease-in-out_infinite]';
const markOf = (contact: Contact) => contact.kind==='unknown'?'sight-unknown':'sight-craft';
/** The scene listens on the container this mark lives in: a press on the craft must not reach the sky behind it. */
const keep = (event: { stopPropagation: () => void }) => { event.stopPropagation(); };

/** The craft a lesson asks to be touched. It opens as any contact does (plan F6: inspect it yourself). */
export function InspectMark({ contact, onSelect }: { contact:Contact;onSelect:(id:string)=>void }) {
  const { t } = useTranslation();
  return <button type="button" data-scene-mark="" data-guide={markOf(contact)} aria-label={t('starter.tutorial.inspect')}
    onPointerDown={keep} onPointerUp={keep}
    onClick={(event)=>{event.stopPropagation();playSound('tap');haptic('tap');onSelect(contact.id);}}
    className={`${FACE} touch-manipulation bg-v2-void/40`}>{glyph(contact)}</button>;
}

/** The craft a lesson is about, riding its flight. */
function MovingMark({ contact, nodes, onSelect }: { contact:Contact;nodes:readonly PlanetNode[];onSelect?:(id:string)=>void }) {
  const group = useRef<Group>(null);
  useFrame(()=>{group.current?.position.set(...contactPosition(contact,serverNow(),nodes));});
  return <group ref={group} position={contactPosition(contact,serverNow(),nodes)}><Html center zIndexRange={MARK_LAYER} style={{pointerEvents:onSelect?'auto':'none'}}>
    {onSelect ? <InspectMark contact={contact} onSelect={onSelect}/> : <span data-scene-mark="" data-guide={markOf(contact)} className={FACE}>{glyph(contact)}</span>}
  </Html></group>;
}

/** A lesson's first sight of its subject is an event in the sky: the radar warns, the telescope chimes. */
function useSighted(id: string | undefined, contactId: string | undefined) {
  const told = useRef<string | null>(null);
  useEffect(()=>{
    if (!contactId || (id!=='telescopeRing' && id!=='radarRing') || told.current===id) return;
    told.current=id;
    if (id==='radarRing') { playSound('alert'); haptic('warn'); } else { playSound('confirm'); haptic('tap'); }
  },[id,contactId]);
}

/** Labels ride actual sensor geometry and actual server-earned traffic. */
export function StarterSightMarks({ sensors, contacts, nodes, onSelect }: { sensors:readonly ReachRing[];contacts:readonly Contact[];nodes:readonly PlanetNode[];onSelect:(id:string)=>void }) {
  const answer = useStarterLesson();
  const device = sightLesson(answer), post=sensors[0];
  const id = answer?.kind==='step'?answer.id:undefined;
  const contact = post ? lessonContact(id,contacts,post) : undefined;
  useSighted(device ? id : undefined, contact?.id);
  if (!device || !post) return null;
  const anchor=toWorld({x:post.at.x-post.detect*.6,y:post.at.y,z:post.at.z-post.detect*.8});
  return <>
    {device==='radar' && <group position={anchor}><Html center zIndexRange={MARK_LAYER} style={{pointerEvents:'none'}}>
      <span data-scene-mark data-guide="sight-radar" className="flex items-center gap-1 whitespace-nowrap rounded-full border border-v2-self/60 bg-v2-void/90 px-2 py-1 text-caption text-v2-self">
        <Icon id="i-radar" className="size-4"/>{moduleName('RADAR')}
      </span>
    </Html></group>}
    {contact && <MovingMark contact={contact} nodes={nodes} {...(id==='telescopeTraffic'?{onSelect}:{})}/>}
  </>;
}
