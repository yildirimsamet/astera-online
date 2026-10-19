import { useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OwnFleets, Traffic } from '../../galaxy/Fleets.js';
import { SCENE_LIGHT } from '../../galaxy/planetSurface.js';
import type { Contact, PendingThread } from '../../api/schemas.js';
import type { Vec3Tuple } from '../../galaxy/scene.js';
import { serverNow } from '../../lib/clock.js';

/** Write-free preview of the actual owner and identified observer flight renderers. */
export function FleetTowingGallery() {
  const [count, setCount] = useState(3);
  const [observer, setObserver] = useState(false);
  const [epoch] = useState(serverNow);
  const camera = useMemo<Vec3Tuple>(() => window.innerWidth < 600 ? [4.4, 9, 14] : [1.4, 3.2, 3.8], []);
  const {pending, contacts} = useMemo(() => {
    const towing = count === 1 ? {TALON: 1} : {TALON: 1, DART: count - 1};
    const fleet = {CITADEL: 1, VIPER: 12, DART: 22 + count - 1, COURIER: 2, TALON: 1};
    const from = {x: -20, y: 0, z: 0}, to = {x: 20, y: 0, z: 0};
    const departAt = new Date(epoch - 1800000), arriveAt = new Date(epoch + 1800000);
    const pending: PendingThread[] = [{id: 'towing-preview', kind: 'unknown_signal', targetName: 'Önizleme',
      minutesRemaining: 30, leg: 'return', arriveAt, fleet, towing, path: {from, to, departAt, arriveAt}}];
    const contacts: Contact[] = [{id: 'towing-preview', kind: 'fleet', fleet, towing, from, to, startAt: departAt, endAt: arriveAt}];
    return {pending, contacts};
  }, [count, epoch]);
  return <div data-fleet-towing-gallery className="relative h-dvh overflow-hidden bg-v2-void text-v2-ink">
    <Canvas camera={{position: camera, fov: 42}} dpr={1}>
      <color attach="background" args={['#070d18']} />
      <ambientLight intensity={SCENE_LIGHT.ambient} />
      <directionalLight position={[-8, 12, 9]} intensity={SCENE_LIGHT.key} />
      <directionalLight position={[10, -3, -12]} intensity={.48} color="#91b5de" />
      {observer ? <Traffic contacts={contacts} nodes={[]} focusedId={null} onSelect={() => undefined} />
        : <OwnFleets pending={pending} nodes={[]} focusedKey={null} onSelect={() => undefined} />}
      <PreviewReady />
      <OrbitControls target={[-1.2, 0, 0]} minDistance={1.5} maxDistance={25} />
    </Canvas>
    <div className="plate-inset absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-xl p-3">
      <h1 className="text-base font-semibold">Çekilen gemiler</h1>
      <p className="mt-1 text-xs text-v2-ink/65">Gemiler tek sıra halinde filonun ortasındaki uç gemiye bağlı.</p>
      <div className="mt-3 flex gap-2" aria-label="Kazanılan gemi sayısı">
        {[1, 2, 3].map(value => <button key={value} type="button" aria-pressed={value === count}
          onClick={() => { setCount(value); }} className="rounded-lg border border-white/15 px-3 py-2 text-sm aria-pressed:border-cyan-300/60 aria-pressed:bg-cyan-300/10">{value} gemi</button>)}
      </div>
      <div className="mt-2 flex gap-2" aria-label="Bakış açısı">
        <button type="button" aria-pressed={!observer} onClick={() => { setObserver(false); }} className="rounded-lg border border-white/15 px-3 py-2 text-sm aria-pressed:bg-white/10">Kendi filom</button>
        <button type="button" aria-pressed={observer} onClick={() => { setObserver(true); }} className="rounded-lg border border-white/15 px-3 py-2 text-sm aria-pressed:bg-white/10">Diğer oyuncu</button>
      </div>
      <p className="mt-2 text-xs text-v2-ink/55">Sürükleyerek döndür. Tekerlek veya iki parmakla yakınlaştır.</p>
    </div>
  </div>;
}

function PreviewReady() {
  useFrame(({scene, gl}) => {
    const prizes = scene.getObjectsByProperty('name', 'towed-prize');
    if (prizes.some(prize => !prize.getObjectByName(`formation-hulls-${String(prize.userData.hull).toLowerCase()}`))) return;
    gl.domElement.closest('[data-fleet-towing-gallery]')?.setAttribute('data-towing-count', String(prizes.length));
  });
  return null;
}
