import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { toGame } from '@astera/rules';
import { Mesh, ShaderMaterial } from 'three';
import { OwnFleets, Traffic } from '../../galaxy/Fleets.js';
import type { Contact, PendingThread } from '../../api/schemas.js';
import { serverNow } from '../../lib/clock.js';

/** Actual own/foreign renderers, plus a default probe and unknown contact to check skin isolation. */
export function UfoProbeGallery() {
  const fixtures = useMemo(() => {
    const now = serverNow();
    const startAt = new Date(now - 30 * 60_000);
    const endAt = new Date(now + 30 * 60_000);
    const leg = (x: number, z: number) => ({ from: toGame([x - 10, 0, z]), to: toGame([x + 10, 0, z]) });
    const own = (id: string, x: number, z: number): PendingThread => ({
      id, kind: 'probe', targetName: 'Preview', minutesRemaining: 30, arriveAt: endAt,
      path: { ...leg(x, z), departAt: startAt, arriveAt: endAt },
    });
    const contacts: Contact[] = [
      { id: 'seen-ufo', kind: 'probe', appearance: { probeId: 'probe-ufo' }, ...leg(.65, 0), startAt, endAt },
      { id: 'unknown', kind: 'unknown', ...leg(.65, -.9), startAt, endAt },
    ];
    return { ownUfo: [own('own-ufo', -.65, 0)], normal: [own('normal-probe', -.65, -.9)], contacts };
  }, []);
  return <div data-ufo-flight className="bg-v2-void" style={{ height: 560 }}>
    <Canvas camera={{ position: [0, 1.8, 3.4], fov: 40 }} dpr={1}>
      <ambientLight intensity={1.3} /><directionalLight position={[3, 5, 4]} intensity={3} />
      <Suspense fallback={null}>
        <OwnFleets pending={fixtures.ownUfo} nodes={[]} appearance={{ probeId: 'probe-ufo' }} focusedKey={null} onSelect={() => undefined} />
        <OwnFleets pending={fixtures.normal} nodes={[]} focusedKey={null} onSelect={() => undefined} />
        <Traffic contacts={fixtures.contacts} nodes={[]} focusedId={null} onSelect={() => undefined} />
        <FlightReady />
      </Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  </div>;
}

function FlightReady() {
  const measured = useRef(false);
  useFrame(({ gl, scene }) => {
    if (measured.current) return;
    const hulls = scene.getObjectsByProperty('name', 'craft-hull');
    const beams = scene.getObjectsByProperty('name', 'ufo-probe-beam');
    if (hulls.length !== 3 || beams.length !== 2) return;
    const checks = beams.map(beam => {
      const volume = beam.getObjectByName('ufo-light-volume');
      return { attachedToHull: beam.parent?.name === 'craft-hull',
        depthTest: volume instanceof Mesh && volume.material instanceof ShaderMaterial && volume.material.depthTest,
        depthWrite: volume instanceof Mesh && volume.material instanceof ShaderMaterial && volume.material.depthWrite };
    });
    const stage = gl.domElement.closest('[data-ufo-flight]');
    stage?.setAttribute('data-beam-checks', JSON.stringify(checks));
    stage?.setAttribute('data-ufo-flight-ready', 'true');
    measured.current = true;
  });
  return null;
}
