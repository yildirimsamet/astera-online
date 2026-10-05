import { toWorld } from '@astera/rules';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import { useTranslation } from 'react-i18next';
import type { PublicMonument } from '../api/schemas.js';
import { MonumentModel, MONUMENT_SCALE } from './MonumentModel.js';
import { monumentName } from '../i18n/names.js';
import { markHit, wasTap } from './tap.js';

export function Monuments({ monuments, focusedId, onSelect }: {
  monuments: readonly PublicMonument[]; focusedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const lastHidden = useRef<ReadonlySet<string>>(hidden);
  const trace = useMemo(() => {
    const occluders: Object3D[] = [];
    return { ray: new Raycaster(), point: new Vector3(), projected: new Vector3(), screen: new Vector2(), occluders };
  }, []);
  useFrame(({ camera, scene }) => {
    if (monuments.length === 0) return;
    camera.updateMatrixWorld();
    // Trace only planets: transparent sensor fields and padded craft pickers must not hide a caption.
    trace.occluders.length = 0;
    scene.traverse((object) => {
      const data: unknown = object.userData;
      if (typeof data === 'object' && data !== null && Reflect.get(data, 'planetOccluder') === true) {
        trace.occluders.push(object);
      }
    });
    const next = new Set<string>();
    for (const monument of monuments) {
      const [x, y, z] = toWorld(monument.position);
      trace.point.set(x, y + MONUMENT_SCALE / 2 + 0.35, z);
      trace.projected.copy(trace.point).project(camera);
      trace.screen.set(trace.projected.x, trace.projected.y);
      trace.ray.setFromCamera(trace.screen, camera);
      const nearest = trace.ray.intersectObjects(trace.occluders, false)[0];
      if (nearest && nearest.distance < trace.point.distanceTo(trace.ray.ray.origin)) next.add(monument.id);
    }
    if (next.size !== lastHidden.current.size || [...next].some((id) => !lastHidden.current.has(id))) {
      lastHidden.current = next;
      setHidden(next);
    }
  });
  return <>{monuments.map((monument) => <group key={monument.id} position={toWorld(monument.position)}
    name={`monument-${monument.id}`} onClick={(event) => {
      if (!wasTap()) return;
      event.stopPropagation(); markHit(); onSelect(monument.id);
    }}>
    <MonumentModel ordinal={monument.ordinal} focused={focusedId === monument.id} />
    <mesh><sphereGeometry args={[MONUMENT_SCALE / 2, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    <Html position={[0, MONUMENT_SCALE / 2 + 0.35, 0]} center distanceFactor={20} zIndexRange={[8, 0]} style={{ pointerEvents: 'none', visibility: hidden.has(monument.id) ? 'hidden' : 'visible' }}>
      <div className={`whitespace-nowrap rounded-control border px-2 py-1 text-center font-v2-ui shadow-sm ${focusedId === monument.id ? 'border-v2-self bg-v2-panel/90 text-v2-self' : 'border-v2-line bg-v2-panel/70 text-v2-ink-2'}`}>
        <p className="text-caption font-semibold">{monumentName(monument.ordinal)}</p>
        <p className="text-micro">{monument.controller.kind === 'PLAYER' ? monument.controller.name
          : monument.controller.kind === 'CLAN' ? `[${monument.controller.tag}] ${monument.controller.name}` : t(monument.emptySince ? 'monument.empty' : 'monument.neutral')}</p>
      </div>
    </Html>
  </group>)}</>;
}
