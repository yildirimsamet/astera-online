import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { serverNow } from '../../lib/clock.js';
import { CoreLevelUps } from '../../galaxy/CoreLevelUps.js';
import { drawnRadius, landsAfter } from '../../galaxy/coreLevelUp.js';
import type { PlanetNode } from '../../galaxy/scene.js';

/**
 * The game's own Core step (`CoreLevelUps`) on the lab world, through its live path: the world is the
 * player's own, a Core upgrade is queued, and its time runs out a moment after the replay — so the light
 * starts gathering early and the world steps as the queue ends. `tier` queues 9 → 10 (Kademe 4), else
 * 10 → 11. Each replay is a new commander, so its first look stays quiet.
 */
export function GameLevelUp({ world, start, tier, children }: { world: PlanetNode; start: number; tier: boolean; children: ReactNode }) {
  const from = tier ? 9 : 10;
  const node = useMemo<PlanetNode>(() => ({ ...world, isOwned: true, coreLevel: from }), [world, from]);
  const nodes = useMemo(() => [node], [node]);
  const finish = start + 600 + landsAfter(tier ? 'tier' : 'level') * 1000;
  const cores = useMemo(() => [{ id: node.id, level: from, finishes: [finish] }], [node.id, from, finish]);
  const body = useRef<THREE.Group>(null);
  // The lab's world is not the galaxy's field: it reads the drawn size the way the field does.
  useFrame(() => { body.current?.scale.setScalar(drawnRadius(node, serverNow()) / node.radius); });
  return (
    <>
      <group ref={body}>{children}</group>
      <CoreLevelUps nodes={nodes} cores={cores} selfId={`lab-core-${String(start)}`} />
    </>
  );
}
