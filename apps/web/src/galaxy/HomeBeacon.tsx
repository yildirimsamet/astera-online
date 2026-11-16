import { Html } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** How long the beacon burns after a press. */
const BEACON_MS = 2_400;

/**
 * Lit for a moment after each press of the home button; dark before the first. A second press
 * while it burns starts the moment again.
 */
export function useBeaconPulse(signal: number): boolean {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (signal === 0) return undefined;
    setLit(true);
    const dark = window.setTimeout(() => { setLit(false); }, BEACON_MS);
    return () => { window.clearTimeout(dark); };
  }, [signal]);
  return lit;
}

/** Rings that open out from the home world, and what it is. */
export function HomeBeaconMark() {
  const { t } = useTranslation();
  return (
    <span data-home-beacon className="gk gk-beacon" aria-hidden="true">
      <span className="gk-beacon__ring" />
      <span className="gk-beacon__ring gk-beacon__ring--late" />
      <span className="gk-beacon__label gk-display">{t('view.youAreHere')}</span>
    </span>
  );
}

/**
 * THE HOME BUTTON ANSWERS (owner review 2026-11-16, item 12). When the camera already stood at
 * home a press changed nothing a player could see; now every press lights this over the home
 * world while the camera flies (or stays), so the button always says what it did.
 */
export function HomeBeacon({ at, signal }: { at: [number, number, number]; signal: number }) {
  const lit = useBeaconPulse(signal);
  if (!lit) return null;
  return (
    <Html key={signal} position={at} center zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}>
      <HomeBeaconMark />
    </Html>
  );
}
