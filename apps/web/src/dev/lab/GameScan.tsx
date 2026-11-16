import { useEffect, useMemo, useState } from 'react';
import { VIEW } from '@astera/rules';
import { ScanReveals } from '../../galaxy/ScanReveals.js';
import type { PlanetNode } from '../../galaxy/scene.js';

/**
 * The game's own discovery scan (`ScanReveals`) on the lab world: the world starts dark, and a moment
 * later the galaxy knows it, as a Telescope reading from a home world off to the side (`telescope`) or
 * as a probe's record (`probe`). Each replay is a new commander, so its first look stays quiet.
 */
export function GameScan({ world, start, probe }: { world: PlanetNode; start: number; probe: boolean }) {
  const R = world.radius;
  // A new commander for each replay, dark first and then known, so the replay is a real first discovery.
  const [phase, setPhase] = useState({ id: start, known: false });
  useEffect(() => {
    setPhase({ id: start, known: false });
    const timer = setTimeout(() => { setPhase({ id: start, known: true }); }, Math.max(50, start - Date.now()));
    return () => { clearTimeout(timer); };
  }, [start]);
  const { known } = phase;
  const homeAt = useMemo<[number, number, number]>(() => [-7 * R, -0.25 * R, -3 * R], [R]);
  const nodes = useMemo<PlanetNode[]>(() => [
    { ...world, id: 'lab-home', isOwned: true, kind: 'CAPITAL', position: homeAt },
    { ...world, kind: 'CAPITAL', intel: known ? (probe ? 'REMEMBERED' : 'RESOLVED') : 'UNKNOWN' },
  ], [world, known, probe, homeAt]);
  const sensors = useMemo(() => [{ planetId: 'lab-home', telescope: true, detect: 0,
    at: { x: homeAt[0] * VIEW.scale, y: homeAt[1] * VIEW.scale, z: homeAt[2] * VIEW.scale }, identify: R * 9 * VIEW.scale }], [R, homeAt]);
  return <ScanReveals nodes={nodes} selfId={`lab-${String(phase.id)}`} sensors={sensors} />;
}
