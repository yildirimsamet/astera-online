import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Contact } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { Icon } from '../v2/icons.js';
import { moduleName } from '../starter/shipCopy.js';
import { useStarterLesson } from '../starter/tutorial/visualGoal.js';
import { lessonContact, sightLesson } from '../starter/tutorial/sightLesson.js';
import { contactPosition, toWorld, type PlanetNode } from './scene.js';
import type { ReachRing } from './SensorRings.js';

function MovingMark({ contact, nodes }: { contact:Contact;nodes:readonly PlanetNode[] }) {
  const group = useRef<Group>(null);
  useFrame(()=>{group.current?.position.set(...contactPosition(contact,serverNow(),nodes));});
  return <group ref={group} position={contactPosition(contact,serverNow(),nodes)}><Html center zIndexRange={[45,45]} style={{pointerEvents:'none'}}>
    <span data-scene-mark data-guide={contact.kind==='unknown'?'sight-unknown':'sight-craft'} className="grid size-10 place-items-center rounded-full border border-v2-self text-v2-self shadow-[0_0_15px_var(--color-v2-self)] animate-[ember_1.8s_ease-in-out_infinite]">
      {contact.kind==='unknown' ? <span className="font-v2-mono text-title">?</span> : <Icon id={contact.kind==='probe'?'i-probe':contact.kind==='mining'?'i-mine':'i-fleet'} className="size-4"/>}
    </span>
  </Html></group>;
}

/** Labels ride actual sensor geometry and actual server-earned traffic. */
export function StarterSightMarks({ sensors, contacts, nodes }: { sensors:readonly ReachRing[];contacts:readonly Contact[];nodes:readonly PlanetNode[] }) {
  const answer = useStarterLesson();
  const device = sightLesson(answer), post=sensors[0];
  if (!device || !post) return null;
  const radius=device==='radar'?post.detect:post.identify;
  const anchor=toWorld({x:post.at.x-radius*.6,y:post.at.y,z:post.at.z-radius*.8});
  const contact=lessonContact(answer?.kind==='step'?answer.id:undefined,contacts,post);
  return <>
    <group position={anchor}><Html center zIndexRange={[45,45]} style={{pointerEvents:'none'}}>
      <span data-scene-mark data-guide={`sight-${device}`} className="flex items-center gap-1 whitespace-nowrap rounded-full border border-v2-self/60 bg-v2-void/90 px-2 py-1 text-caption text-v2-self">
        <Icon id={device==='radar'?'i-radar':'i-telescope'} className="size-4"/>{moduleName(device==='radar'?'RADAR':'TELESCOPE')}
      </span>
    </Html></group>
    {contact && <MovingMark contact={contact} nodes={nodes}/>}
  </>;
}
