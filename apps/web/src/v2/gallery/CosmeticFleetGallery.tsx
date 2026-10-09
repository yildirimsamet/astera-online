import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OwnFleets } from '../../galaxy/Fleets.jsx';
import type { PendingThread } from '../../api/schemas.js';
import { serverNow } from '../../lib/clock.js';
import type { ShipCosmeticEquipment } from '@astera/rules';
import { BufferGeometry, InstancedMesh, ShaderMaterial } from 'three';
import { PER_MODEL } from '../../galaxy/Squadrons.js';

function FleetRenderProbe() {
  const frame = useRef(0);
  useFrame(({ gl, scene }) => {
    if (++frame.current !== 12) return;
    const batches: { count: number; triangles: number; singlePass: boolean }[] = [];
    scene.traverse(node => {
      if (node instanceof InstancedMesh && node.name === 'formation-cosmetic-exhaust' && node.geometry instanceof BufferGeometry && node.material instanceof ShaderMaterial) {
        batches.push({ count: node.count, triangles: (node.geometry.index?.count ?? 0) / 3, singlePass: node.material.forceSinglePass });
      }
    });
    const stage = gl.domElement.closest('[data-cosmetic-fleet]');
    stage?.setAttribute('data-exhaust-batches', JSON.stringify(batches));
    stage?.setAttribute('data-fleet-ready', 'true');
  });
  return null;
}

/** The actual in-game formation renderer, including its instanced exhaust and clan standard. */
export function CosmeticFleetGallery({ shipSkins, engineId }: { shipSkins?: ShipCosmeticEquipment; engineId?: string }) {
  const pending = useMemo<PendingThread[]>(() => {
    const now = serverNow();
    const arriveAt = new Date(now + 30 * 60_000);
    return [{ id: 'cosmetic-flight', kind: 'fleet', targetName: 'Preview', minutesRemaining: 30, arriveAt,
      fleet: shipSkins ? { DART: 1, CORSAIR: 1, CITADEL: 1, VIPER: 1, LEVIATHAN: 1 } : { DART: 8 * PER_MODEL, VIPER: 4 * PER_MODEL, COURIER: 4 * PER_MODEL },
      path: { from: { x: shipSkins ? -10 : -100, y: 0, z: 0 }, to: { x: shipSkins ? 10 : 100, y: 0, z: 0 }, departAt: new Date(now - 30 * 60_000), arriveAt },
    }];
  }, [shipSkins]);
  return <div data-cosmetic-fleet className="bg-v2-void" style={{ height: 560 }}>
    <Canvas camera={{ position: shipSkins ? [-2.9, 3.5, 5] : [-1.9, 2.3, 3.3], fov: 40 }} dpr={1}>
      <ambientLight intensity={1.3} /><directionalLight position={[3, 5, 4]} intensity={3} />
      <Suspense fallback={null}>
        <OwnFleets pending={pending} nodes={[]} focusedKey={null} onSelect={() => undefined}
          appearance={shipSkins ? { shipSkins } : { engineId: engineId ?? 'engine-aurora', flagId: 'flag-helios' }} />
        <FleetRenderProbe />
      </Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  </div>;
}
