import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Per-device preference, shared by every world. Storage failure only loses persistence. */
export function useSensorReach(sensor: 'telescope' | 'radar'): [boolean, Dispatch<SetStateAction<boolean>>] {
  const key = `astera.sensor-reach.${sensor}.v1`;
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(visible));
    } catch {
      // Private browsing, blocked storage or quota: the switch still works this visit.
    }
  }, [key, visible]);

  return [visible, setVisible];
}
