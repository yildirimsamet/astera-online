import { describe, expect, it } from 'vitest';
import { HULL_MODEL, MODEL } from '../src/ui/assets.js';
import { nativeEngineAnchors } from '../src/galaxy/engineAnchors.js';
import { cosmeticById, SHIP_SKIN_IDS } from '@astera/rules';
import { SHIP_SKIN_DRIVES } from '../src/galaxy/shipSkinDrive.js';

/** Counts reviewed on original meshes from rear, top and side, not inferred from tier. */
const APERTURES = {
  DART: 2, PIKE: 2, RAMPART: 1, WARDEN: 2, COURIER: 2,
  VIPER: 4, TALON: 4, STRONGHOLD: 2, SENTINEL: 2, WAYFARER: 2,
  TEMPEST: 2, BALLISTA: 2, LEVIATHAN: 2, PRAETORIAN: 2, ATLAS: 2,
  NULLIFIER: 2, GARBAGE_COLLECTOR: 1, CATACLYSM: 1, CORSAIR: 2,
  CITADEL: 2, PALADIN: 2, ARGOSY: 2, PROSPECTOR: 1,
} as const;

describe('model-specific engine attachments', () => {
  it.each(Object.entries(APERTURES))('covers %s with its reviewed exhaust count (%i)', (hull, count) => {
    const url = Object.entries(HULL_MODEL).find(([id]) => id === hull)?.[1];
    if (!url) throw new Error(`No model for reviewed hull ${hull}`);
    const anchors = nativeEngineAnchors(url);
    expect(anchors).toHaveLength(count);
    expect(new Set(anchors?.map(at => at.join(','))).size).toBe(count);
    for (const at of anchors ?? []) {
      expect(at.every(Number.isFinite)).toBe(true);
      expect(Math.abs(at[0])).toBeLessThan(0.51);
      expect(Math.abs(at[1])).toBeLessThan(0.65);
      expect(at[2]).toBeLessThan(0.1);
      expect(at[2]).toBeGreaterThan(-0.65);
    }
  });

  it('places Dart’s restored engines across the hull at its existing posed height', () => {
    const anchors = nativeEngineAnchors(HULL_MODEL.DART);
    expect(anchors?.[0]?.[0]).toBeGreaterThan(0.1);
    expect(anchors?.[1]?.[0]).toBeLessThan(-0.1);
    expect(anchors?.[0]?.[1]).toBeGreaterThan(0.2);
  });

  it('puts Cataclysm’s jet on its raised stern rather than inside the hull', () => {
    const at = nativeEngineAnchors(HULL_MODEL.CATACLYSM)?.[0];
    expect(at?.[1]).toBeGreaterThan(0.1);
    expect(at?.[2]).toBeLessThan(-0.45);
  });

  it('covers the probe, strategic missile and merchant without borrowing a fighter’s stern', () => {
    expect(nativeEngineAnchors(MODEL.probe)).toHaveLength(1);
    expect(nativeEngineAnchors(MODEL.deathStar)).toHaveLength(1);
    expect(nativeEngineAnchors(MODEL.tradeShip)).toHaveLength(4);
    const probe = nativeEngineAnchors(MODEL.probe)?.[0];
    expect(probe?.[2]).toBeGreaterThan(-0.36);
    expect(probe?.[2]).toBeLessThan(-0.25);
  });

  it('uses each equipped skin’s own ports for flight, LOD and inspection without a stock height lift', () => {
    for (const id of SHIP_SKIN_IDS) {
      const item = cosmeticById(id);
      const reviewed = SHIP_SKIN_DRIVES[id].slots.map(slot => slot.position);
      for (const url of [item?.model, item?.lodModel, item?.previewModel]) {
        if (!url) throw new Error(`${id}: missing model`);
        expect(nativeEngineAnchors(url), `${id}: ${url}`).toEqual(reviewed);
      }
    }
    expect(nativeEngineAnchors('/assets/models/ships/skins/red-dragon/model.glb')).not.toEqual(nativeEngineAnchors(HULL_MODEL.CORSAIR));
  });

  it('does not invent an aft jet for the UFO’s downward-facing propulsion emitter', () => {
    expect(nativeEngineAnchors(MODEL.probeUfo)).toEqual([]);
  });

  it('never supplies attachment points for rejected replacements or unknown models', () => {
    expect(nativeEngineAnchors('/assets/models/ships/dart-premium-v2.glb')).toBeUndefined();
    expect(nativeEngineAnchors('/unknown.glb')).toBeUndefined();
  });
});
