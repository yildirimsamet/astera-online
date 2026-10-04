import { toWorld } from '@astera/rules';
import { Html } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import type { PublicMonument } from '../api/schemas.js';
import { MonumentModel, MONUMENT_SCALE } from './MonumentModel.js';
import { monumentName } from '../i18n/names.js';
import { markHit, wasTap } from './tap.js';

export function Monuments({ monuments, focusedId, onSelect }: {
  monuments: readonly PublicMonument[]; focusedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return <>{monuments.map((monument) => <group key={monument.id} position={toWorld(monument.position)}
    name={`monument-${monument.id}`} onClick={(event) => {
      if (!wasTap()) return;
      event.stopPropagation(); markHit(); onSelect(monument.id);
    }}>
    <MonumentModel ordinal={monument.ordinal} focused={focusedId === monument.id} />
    <mesh><sphereGeometry args={[MONUMENT_SCALE / 2, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    <Html position={[0, MONUMENT_SCALE / 2 + 0.35, 0]} center distanceFactor={20} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`whitespace-nowrap rounded-control border px-2 py-1 text-center font-v2-ui shadow-sm ${focusedId === monument.id ? 'border-v2-self bg-v2-panel/90 text-v2-self' : 'border-v2-line bg-v2-panel/70 text-v2-ink-2'}`}>
        <p className="text-caption font-semibold">{monumentName(monument.ordinal)}</p>
        <p className="text-micro">{monument.controller.kind === 'PLAYER' ? monument.controller.name
          : monument.controller.kind === 'CLAN' ? `[${monument.controller.tag}] ${monument.controller.name}` : t(monument.emptySince ? 'monument.empty' : 'monument.neutral')}</p>
      </div>
    </Html>
  </group>)}</>;
}
