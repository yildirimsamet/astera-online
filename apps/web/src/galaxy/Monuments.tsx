import type { Group } from 'three';
import { serverNow } from '../lib/clock.js';
import { toWorld, motionPositionAt } from '@astera/rules';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicMonument } from '../api/schemas.js';
import { MonumentModel, monumentScale } from './MonumentModel.js';
import { monumentName } from '../i18n/names.js';
import { markHit, wasTap } from './tap.js';
import { createMonumentVisibility } from './monumentVisibility.js';
import type { PlanetNode } from './scene.js';

export function Monuments({ monuments, planets, focusedId, onSelect }: {
  monuments: readonly PublicMonument[]; planets: readonly PlanetNode[];
  focusedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const groups = useRef(new Map<string,Group>());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const lastHidden = useRef<ReadonlySet<string>>(hidden);
  const trace = useMemo(() => createMonumentVisibility(hidden), []);
  const captions = useMemo(() => monuments.map(monument => {
    const [x, y, z] = toWorld(monument.position);
    return { id: monument.id, position: [x, y + monumentScale(monument.difficulty) / 2 + 0.35, z] as const };
  }), [monuments]);
  useFrame(({ camera }) => {
    const now=serverNow();
    for(const monument of monuments){
      if(!monument.motion)continue;
      const [x,y,z]=toWorld(motionPositionAt(monument.motion,now));
      groups.current.get(monument.id)?.position.set(x,y,z);
      const caption=captions.find(c=>c.id===monument.id);
      if(caption)caption.position=[x,y+monumentScale(monument.difficulty)/2+0.35,z];
    }
    const next = trace.update(camera, captions, planets, monuments.some(m=>m.motion)?Math.floor(now/250):undefined);
    if (next !== lastHidden.current) {
      lastHidden.current = next;
      setHidden(next);
    }
  });
  return <>{monuments.map((monument) => <group key={monument.id} ref={group=>{if(group)groups.current.set(monument.id,group);else groups.current.delete(monument.id);}} position={toWorld(monument.position)}
    name={`monument-${monument.id}`} onClick={(event) => {
      if (!wasTap()) return;
      event.stopPropagation(); markHit(); onSelect(monument.id);
    }}>
    <MonumentModel ordinal={monument.ordinal} difficulty={monument.difficulty} focused={focusedId === monument.id} />
    <mesh><sphereGeometry args={[monumentScale(monument.difficulty) / 2, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    <Html position={[0, monumentScale(monument.difficulty) / 2 + 0.35, 0]} center distanceFactor={20} zIndexRange={[8, 0]} style={{ pointerEvents: 'none', visibility: hidden.has(monument.id) ? 'hidden' : 'visible' }}>
      <div className={`whitespace-nowrap rounded-control border px-2 py-1 text-center font-v2-ui shadow-sm ${focusedId === monument.id ? `${monument.difficulty === 'HARD' ? 'border-v2-hostile text-v2-hostile' : 'border-v2-self text-v2-self'} bg-v2-panel/90` : 'border-v2-line bg-v2-panel/70 text-v2-ink-2'}`}>
        <p className="text-caption font-semibold">{monumentName(monument.ordinal)}</p>
        {monument.difficulty !== 'LEGACY' && <p className={`text-micro ${monument.difficulty === 'HARD' ? 'text-v2-hostile' : 'text-v2-self'}`}>
          {t(monument.difficulty === 'EASY' ? 'monument.easyAccess' : 'monument.hardAccess')}</p>}
        <p className="text-micro">{monument.controller.kind === 'PLAYER' ? monument.controller.name
          : monument.controller.kind === 'CLAN' ? `[${monument.controller.tag}] ${monument.controller.name}` : t(monument.emptySince ? 'monument.empty' : 'monument.neutral')}</p>
      </div>
    </Html>
  </group>)}</>;
}
