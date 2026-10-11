import { describe, expect, it } from 'vitest';
import { formationEngineUnits } from '../src/galaxy/engineUnits.js';
import { nativeEngineAnchors } from '../src/galaxy/engineAnchors.js';
import { HULL_MODEL, hullPoseLift } from '../src/ui/assets.js';
import { SHIP_SKIN_DRIVES } from '../src/galaxy/shipSkinDrive.js';
import { hullVisualScale } from '../src/galaxy/flightVisual.js';
import type { Marker } from '../src/galaxy/Squadrons.js';
import { HULLS, MOBILE_HULLS } from '@astera/rules';

describe('shared flight and equipped-engine attachments', () => {
  const markers: Marker[] = (['CORSAIR', 'CITADEL', 'VIPER', 'LEVIATHAN', 'DART'] as const)
    .map(hull => ({ hull, filled: 1, ordinal: 0 }));
  const skins = { CORSAIR: 'ship-red-dragon', CITADEL: 'ship-shark', VIPER: 'ship-scorpion', LEVIATHAN: 'ship-stingray' } as const;

  it('uses the equipped body’s own ports for both ordinary and purchased engine effects', () => {
    const units = formationEngineUnits(markers, [[3, 2, -5]], 2, skins, .8);
    for (const [index, id] of ['ship-red-dragon', 'ship-shark', 'ship-scorpion', 'ship-stingray'].entries()) {
      const drive = Object.entries(SHIP_SKIN_DRIVES).find(([skin]) => skin === id)?.[1];
      expect(units[index]?.nozzles).toEqual(drive?.slots.map(slot => slot.position));
      expect(units[index]?.size).toBe(hullVisualScale(markers[index]!.hull, 2));
      expect(units[index]?.intensity).toBe(.8);
    }
    expect(units[0]?.at).toEqual([3, 2, -5]);
    expect(units[1]?.at).toEqual([0, 0, 0]);
    expect(units[4]?.nozzles).toEqual(nativeEngineAnchors(HULL_MODEL.DART));
    // The inherited Corsair pose would move this skin's engine well above its own mouth.
    expect(hullPoseLift('CORSAIR')).toBeGreaterThan(0);
    expect(units[0]?.nozzles[0]?.[1]).toBeLessThan(0);
  });

  it('restores stock ports when equipment is absent or mapped to the wrong hull', () => {
    const units = formationEngineUnits(markers, [], 1, { CORSAIR: 'ship-shark' });
    for (const [index, marker] of markers.entries()) {
      expect(units[index]?.nozzles).toEqual(nativeEngineAnchors(HULL_MODEL[marker.hull]));
    }
  });

  it('grows flame width and reach modestly with the hull’s tier, without moving its ports', () => {
    const stepped: Marker[] = (['DART', 'VIPER', 'TEMPEST', 'CORSAIR'] as const)
      .map(hull => ({ hull, filled: 1, ordinal: 0 }));
    const units = formationEngineUnits(stepped, [], 1);
    expect(units[0]?.widthFactor).toBe(1);
    expect(units[0]?.lengthFactor).toBe(1);
    for (let i = 1; i < units.length; i++) {
      expect(units[i]?.widthFactor).toBeGreaterThan(units[i - 1]!.widthFactor);
      expect(units[i]?.lengthFactor).toBeGreaterThan(units[i - 1]!.lengthFactor);
    }
    for (const [index, marker] of stepped.entries()) {
      expect(units[index]?.size).toBe(hullVisualScale(marker.hull, 1));
      expect(units[index]?.nozzles).toEqual(nativeEngineAnchors(HULL_MODEL[marker.hull]));
    }
    expect(units.at(-1)?.widthFactor).toBeLessThanOrEqual(1.2);
    expect(units.at(-1)?.lengthFactor).toBeLessThanOrEqual(1.3);
  });

  it('keeps tier growth identical on stock and equipped bodies and neutral on the drill', () => {
    const all: Marker[] = [...MOBILE_HULLS, 'PROSPECTOR' as const].map(hull => ({ hull, filled: 1, ordinal: 0 }));
    const stock = formationEngineUnits(all, [], 1), equipped = formationEngineUnits(all, [], 1, skins);
    for (const [index, marker] of all.entries()) {
      expect(stock[index]?.widthFactor).toBe(equipped[index]?.widthFactor);
      expect(stock[index]?.lengthFactor).toBe(equipped[index]?.lengthFactor);
      if (HULLS[marker.hull].tier === null) {
        expect(stock[index]?.widthFactor).toBe(1);
        expect(stock[index]?.lengthFactor).toBe(1);
      }
    }
  });
});
