import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { flipbookFrame } from './bayFx.js';
import { NUKE_SMOKE } from './NukeBlast.js';
import { BURN_FIRE } from './VesselBurn.js';

/**
 * VFX BRIEF (owner 2026-11-18, plan 2026-11-20 §4 An 1 / Faz 2):
 * 1. Fiziksel olay: Kuruluş Saati boyunca başkentin iki rafineri ocağı bacası ×5 aşırı yükte yanar;
 *    iniş kartı onaylandığında ateşleme alevi ve yükselen duman bulutu patlar, ardından sürekli
 *    yüksek tempolu çalışma alevine oturur.
 * 2. Kütüphane asset'leri:
 *    - `library/vfx/flipbooks/realistic-fire-vfx/realistic-fire--textures--flame-style-3.png` (`BURN_FIRE`, 6×6)
 *    - `library/vfx/flipbooks/realistic-fire-vfx/realistic-fire--textures--smoke.png` (`NUKE_SMOKE`, 8×8)
 * 3. Neden bu olay: İki endüstriyel ocak çıkışı + duman katmanı, tek bir dev mum alevi veya jenerik
 *    yuvarlak parlama yerine başkentin aşırı yükte çalışan rafineri ocaklarını fiziksel olarak okutur.
 */

const FLARE_EVENT = 'astera:furnace-flare';
const FLARE_DURATION_MS = 2_600;
/** Only animate while the camera is close enough to see the vents (mobile battery). */
const MAX_ACTIVE_DISTANCE = 42;

const VENTS: readonly (readonly [number, number, number])[] = [
  [-0.28, 0.82, 0.22],
  [0.26, 0.8, -0.18],
];

/** Dispatches a flare pulse when the player taps the Kuruluş Saati landing card. */
export function triggerFurnaceFlare(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FLARE_EVENT));
}

export function FurnaceOverloadFx({
  position,
  radius,
  active,
}: {
  position: readonly [number, number, number];
  radius: number;
  active: boolean;
}) {
  const fireSrc = useTexture(BURN_FIRE);
  const smokeSrc = useTexture(NUKE_SMOKE);
  const { fireSheet, smokeSheet } = useMemo(() => {
    const f = fireSrc.clone();
    f.repeat.set(1 / 6, 1 / 6);
    f.needsUpdate = true;
    const s = smokeSrc.clone();
    s.repeat.set(1 / 8, 1 / 8);
    s.needsUpdate = true;
    return { fireSheet: f, smokeSheet: s };
  }, [fireSrc, smokeSrc]);

  const materials = useMemo(() => ({
    fire: new THREE.SpriteMaterial({
      map: fireSheet,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    smoke: new THREE.SpriteMaterial({
      map: smokeSheet,
      color: '#6e665c',
      transparent: true,
      depthWrite: false,
    }),
  }), [fireSheet, smokeSheet]);

  useEffect(() => () => {
    fireSheet.dispose();
    smokeSheet.dispose();
    materials.fire.dispose();
    materials.smoke.dispose();
  }, [fireSheet, smokeSheet, materials]);

  const flareUntil = useRef(0);
  useEffect(() => {
    const onFlare = () => { flareUntil.current = Date.now() + FLARE_DURATION_MS; };
    window.addEventListener(FLARE_EVENT, onFlare);
    return () => { window.removeEventListener(FLARE_EVENT, onFlare); };
  }, []);

  const origin = useMemo(() => new THREE.Vector3(), []);
  const jetRefs = useRef<(THREE.Sprite | null)[]>([]);
  const smokeRefs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(({ clock, camera, invalidate }) => {
    if (!active) return;
    origin.set(position[0], position[1], position[2]);
    if (camera.position.distanceTo(origin) > MAX_ACTIVE_DISTANCE) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const flare = Math.max(0, flareUntil.current - Date.now()) / FLARE_DURATION_MS;
    // The hour-long burn rides the ambient ticker (`frames.tsx`, 24 fps floor); only the 2.6 s ignition asks
    // for every frame, so an hour on the home view does not keep the phone at full rate (review 2026-11-23).
    if (flare > 0) invalidate();

    const t = clock.elapsedTime;
    const fireFrame = flipbookFrame(t, 28, 36);
    fireSheet.offset.set((fireFrame % 6) / 6, 1 - (Math.floor(fireFrame / 6) + 1) / 6);

    const smokeCycle = (t * 0.55) % 1;
    const smokeFrame = Math.min(63, Math.floor(smokeCycle * 64));
    smokeSheet.offset.set((smokeFrame % 8) / 8, 1 - (Math.floor(smokeFrame / 8) + 1) / 8);

    const boost = 1 + flare * 0.9;
    materials.fire.opacity = 0.72 + flare * 0.25;
    materials.smoke.opacity = (0.34 + flare * 0.22) * (1 - smokeCycle);

    VENTS.forEach(([vx, vy, vz], i) => {
      const pulse = 1 + 0.09 * Math.sin(t * 22 + i * 2.1);
      const jet = jetRefs.current[i];
      if (jet) {
        jet.scale.set(radius * 0.38 * boost, radius * 0.62 * boost * pulse, 1);
      }
      const puff = smokeRefs.current[i];
      if (puff) {
        puff.position.set(
          position[0] + vx * radius,
          position[1] + (vy + 0.18 + smokeCycle * 0.65) * radius,
          position[2] + vz * radius,
        );
        puff.scale.setScalar(radius * (0.28 + smokeCycle * 0.48) * boost);
      }
    });
  });

  if (!active) return null;
  return (
    <>
      {VENTS.map(([vx, vy, vz], i) => (
        <group key={i}>
          <sprite
            ref={(el) => { smokeRefs.current[i] = el; }}
            position={[position[0] + vx * radius, position[1] + vy * radius, position[2] + vz * radius]}
            material={materials.smoke}
            raycast={() => null}
          />
          <sprite
            ref={(el) => { jetRefs.current[i] = el; }}
            position={[position[0] + vx * radius, position[1] + vy * radius, position[2] + vz * radius]}
            center={[0.5, 0.08]}
            material={materials.fire}
            raycast={() => null}
          />
        </group>
      ))}
    </>
  );
}
