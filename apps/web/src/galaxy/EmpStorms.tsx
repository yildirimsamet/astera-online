import { Suspense } from 'react';
import { EmpStorm } from './EmpStorm.js';
import { empStormStart } from './empSchedule.js';
import { PLANET_SKIN_BODY_SCALE } from './planetSkinAttachments.js';
import type { PlanetNode } from './scene.js';
import { SkinAssetBoundary } from './SkinAssetBoundary.js';

export type EmpWorld = Pick<PlanetNode, 'id' | 'position' | 'radius' | 'state'>;

/**
 * THE EMP STORM OVER EVERY WORLD IN ITS HOUR (owner approved the storm, 2026-11-12), beside the
 * ember that tells it from afar (`PlanetEmbers`). Each is there as soon as its world is under EMP and
 * stays quiet until the strike that caused it has finished playing, so the two never compete for the
 * frame of impact; the strike warmed its art and programs in flight (`EmpStormWarmup`). A storm whose
 * art fails leaves the world as it was.
 */
export function EmpStorms({ nodes }: { nodes: readonly EmpWorld[] }) {
  return <>{nodes.map((node) => node.state.kind === 'EMP'
    ? <Storm key={node.id} node={node} until={node.state.until.getTime()} />
    : null)}</>;
}

function Storm({ node, until }: { node: EmpWorld; until: number }) {
  // A later hit moves `since`: the storm fades out under that strike and back after it.
  const since = empStormStart(until);
  return (
    <SkinAssetBoundary fallback={null}>
      <Suspense fallback={null}>
        <EmpStorm position={node.position} radius={node.radius * PLANET_SKIN_BODY_SCALE} since={since} until={until} />
      </Suspense>
    </SkinAssetBoundary>
  );
}
