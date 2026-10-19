import { createContext, useContext, useState, type ReactNode } from 'react';
import { ConsentNotice } from '../../shell/ConsentNotice.js';

const Placement = createContext<(host: HTMLDivElement | null) => void>(() => undefined);
export const useLandingConsentHost = () => useContext(Placement);

/** One consent owner throughout landing/game transitions; only its physical host changes. */
export function ConsentPlacement({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return <Placement.Provider value={setHost}>{children}<ConsentNotice inlineHost={host} /></Placement.Provider>;
}
