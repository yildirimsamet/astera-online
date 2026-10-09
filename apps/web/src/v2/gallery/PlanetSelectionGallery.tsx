import { Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Mesh, RingGeometry } from 'three';
import { galaxySchema } from '../../api/schemas.js';
import { PlanetField } from '../../galaxy/PlanetField.jsx';
import { planetNodes } from '../../galaxy/scene.js';
import { installTapGuard } from '../../galaxy/tap.js';

const nodes = planetNodes(galaxySchema.parse({
  you: { planetId: 'selection-home', playerId: 'selection-commander' }, sensors: [],
  planets: [
    { id: 'selection-home', name: 'Kestrel', owner: 'Orion', position: { x: -65, y: 0, z: 0 },
      intel: 'RESOLVED', isOwned: true, isSelf: true, coreLevel: 1, kind: 'CAPITAL' },
    { id: 'selection-hidden', position: { x: 65, y: 0, z: 0 }, intel: 'UNKNOWN', isSelf: false },
  ],
}).planets).map(node => ({ ...node, radius: .8 }));

function ReadBorders() {
  useFrame(({ gl, scene }) => {
    const radii: number[] = [];
    scene.traverse(object => {
      if (object instanceof Mesh && object.geometry instanceof RingGeometry) radii.push(object.geometry.parameters.outerRadius);
    });
    gl.domElement.closest('[data-selection-review]')?.setAttribute('data-border-radii', JSON.stringify(radii));
  });
  return null;
}

/** Real planet renderer: selected unknown, selected home, and the persistent home edge. */
export function PlanetSelectionGallery() {
  const [selectedId, select] = useState<string | null>(null);
  useEffect(installTapGuard, []);
  return <div className="mx-auto max-w-3xl bg-v2-void p-3 text-v2-ink">
    <div className="flex gap-2">
      <button type="button" onClick={() => { select(null); }}>Seçimi kaldır</button>
      <button type="button" onClick={() => { select('selection-home'); }}>Kendi gezegenim</button>
      <button type="button" onClick={() => { select('selection-hidden'); }}>Keşfedilmemiş</button>
    </div>
    <div data-selection-review data-selected={selectedId ?? 'none'} style={{ aspectRatio: '1.5' }}>
      <Canvas camera={{ position: [0, 0, 7], fov: 40 }} dpr={1}>
        <ambientLight intensity={1.4} /><directionalLight position={[-3, 4, 6]} intensity={2} />
        <Suspense fallback={null}>
          <PlanetField nodes={nodes} selectedId={selectedId} rivals={[]} onSelect={select} />
        </Suspense>
        <ReadBorders />
      </Canvas>
    </div>
  </div>;
}
