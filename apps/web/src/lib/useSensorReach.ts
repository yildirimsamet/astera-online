import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

type ReachState = [boolean, Dispatch<SetStateAction<boolean>>];
/** Exercise overlays never write the real commander's device preferences. */
export const SensorReachContext = createContext<{ telescope: ReachState; radar: ReachState } | null>(null);

/** Per-device preference, shared by every world. Storage failure only loses persistence. */
export function useSensorReach(sensor: 'telescope' | 'radar'): [boolean, Dispatch<SetStateAction<boolean>>] {
  const key = `astera.sensor-reach.${sensor}.v1`;
  const exercise = useContext(SensorReachContext);
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (exercise) return;
    try {
      localStorage.setItem(key, String(visible));
    } catch {
      // Private browsing, blocked storage or quota: the switch still works this visit.
    }
  }, [key, visible, exercise]);

  return exercise?.[sensor] ?? [visible, setVisible];
}
