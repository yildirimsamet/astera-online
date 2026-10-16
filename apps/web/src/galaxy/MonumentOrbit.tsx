import type { MonumentMotion } from '@astera/rules';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { serverNow } from '../lib/clock.js';
import { createMonumentOrbit } from './monumentOrbit.js';

export function MonumentOrbit({ id, motion, scale, focused, hasFocus }: {
  id: string; motion: MonumentMotion; scale: number; focused: boolean; hasFocus: boolean;
}) {
  const orbit = useMemo(() => createMonumentOrbit(motion, scale), [motion, scale]);
  useEffect(() => () => { orbit.dispose(); }, [orbit]);
  useFrame(({ camera, size }) => { orbit.update(serverNow(), camera, size.height, focused, hasFocus); });
  return <primitive object={orbit.object} name={`monument-orbit-${id}`} />;
}
