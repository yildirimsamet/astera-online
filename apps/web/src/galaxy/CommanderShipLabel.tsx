import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Html } from '@react-three/drei';
import { Vector3, type Camera, type Group, type Object3D } from 'three';
import { useVisualFrame } from './visualFrame.js';

export const CommanderShipLabels = createContext(true);
const shipPosition = new Vector3();
const cameraPosition = new Vector3();

/** DOM annotations must follow the moving formation's world transform and visibility. */
export function commanderShipLabelStyle(anchor: Object3D, camera: Camera, enabled = true) {
  let visible = enabled;
  for (let parent: Object3D | null = anchor; parent; parent = parent.parent) {
    if (!parent.visible) { visible = false; break; }
  }
  const distance = anchor.getWorldPosition(shipPosition).distanceTo(camera.getWorldPosition(cameraPosition));
  return {
    display: visible && distance < 24 ? '' : 'none',
    scale: String(Math.min(1, 12 / distance)),
    opacity: String(Math.min(1, Math.max(0, (24 - distance) / 12))),
  };
}

/** The same zoom/universe rule for parked ships and both players' flying escorts. */
export function CommanderShipLabel({ children }: { children: ReactNode }) {
  const enabled = useContext(CommanderShipLabels);
  const anchor = useRef<Group>(null);
  const text = useRef<HTMLDivElement>(null);
  useVisualFrame(({ camera }) => {
    if (anchor.current && text.current) Object.assign(text.current.style, commanderShipLabelStyle(anchor.current, camera, enabled));
  });
  if (!enabled) return null;
  return <group ref={anchor}>
    <Html zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}>
      <div ref={text} data-commander-ship-label style={{ display: 'none', transformOrigin: '0 0' }}>{children}</div>
    </Html>
  </group>;
}
