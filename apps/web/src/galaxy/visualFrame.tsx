import { createContext, useContext, type ReactNode } from 'react';
import { useFrame, type RenderCallback } from '@react-three/fiber';

const VisualPriority = createContext(0);

/** Galaxy already renders explicitly at priority 1 (and warmup at 2).
 * Buffer/culling work follows all default-priority movement and camera updates.
 * Previews retain priority 0 so they keep Fiber's automatic rendering. */
export function GalaxyVisualPhase({ children }: { children: ReactNode }) {
  return <VisualPriority.Provider value={0.5}>{children}</VisualPriority.Provider>;
}

export function useVisualFrame(callback: RenderCallback): void {
  useFrame(callback, useContext(VisualPriority));
}

/** Culling is safe only where motion/camera are guaranteed to precede this pass. */
export function useGalaxyCulling(): boolean {
  return useContext(VisualPriority) > 0;
}
