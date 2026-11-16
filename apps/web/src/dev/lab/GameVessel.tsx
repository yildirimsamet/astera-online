import { useEffect, useMemo, useState } from 'react';
import { VESSEL_SYSTEMS } from '@astera/rules';
import { damageSpots, NO_LIGHTS, vesselModelFile, type VesselLights } from '../../galaxy/mainSky.js';
import { VesselBody } from '../../galaxy/VesselBody.js';

/**
 * The game's own wrecked ship (`VesselBody`), burning as players see it. `repair` mends its systems
 * one by one, the next one half done (smouldering), and starts over once the ship is whole.
 */
export function GameVessel({ radius, repair }: { radius: number; repair: boolean }) {
  const [mended, setMended] = useState(0);
  useEffect(() => {
    if (!repair) return;
    const timer = setInterval(() => { setMended((count) => (count + 1) % (VESSEL_SYSTEMS.length + 2)); }, 2500);
    return () => { clearInterval(timer); };
  }, [repair]);
  const damage = useMemo(() => {
    const lights: VesselLights = { ...NO_LIGHTS };
    VESSEL_SYSTEMS.forEach((system, index) => { lights[system] = index < mended ? 1 : index === mended ? 0.4 : 0; });
    return damageSpots(repair ? lights : NO_LIGHTS);
  }, [mended, repair]);
  return (
    <group scale={radius * 1.3}>
      <VesselBody file={vesselModelFile('SPINE', 'WRECKED')} hull="SPINE" damage={damage} />
    </group>
  );
}
