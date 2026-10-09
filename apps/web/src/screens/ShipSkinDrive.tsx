import { useEffect, useMemo } from 'react';
import { cosmeticById, type ShipSkinId } from '@astera/rules';
import { SHIP_SKIN_DRIVES, createShipDriveGeometry } from '../galaxy/shipSkinDrive.js';
import { EffectSurface } from '../galaxy/CosmeticEffects.jsx';
import { HULL_LIGHT } from '../galaxy/flightVisual.js';

export function ShipSkinDrive({ id, still }: { id: ShipSkinId; still: boolean }) {
  const drive = SHIP_SKIN_DRIVES[id];
  const hull = cosmeticById(id)?.hull;
  const geometry = useMemo(createShipDriveGeometry, []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  if (!hull) return null;
  return <group name="ship-preview-drive">
    {drive.slots.map((slot, index) => <mesh key={index} position={slot.position} rotation={[0, slot.yaw, 0]} scale={[drive.width, drive.width, drive.length]} geometry={geometry}>
      <EffectSurface style="aurora" kind={1} still={still} colour={HULL_LIGHT[hull].flame} secondary="#b6e5ff" />
    </mesh>)}
  </group>;
}
