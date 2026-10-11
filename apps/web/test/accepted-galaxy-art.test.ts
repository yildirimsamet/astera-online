import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HULL_ART, HULL_MODEL, HULL_LOD_MODEL, MODEL, MODEL_FACING, PROBE_ART } from '../src/ui/assets.js';
import { FLEET_V2_ASSET_MANIFEST } from '../src/ui/fleet-v2-assets.js';
import { MONUMENT_MODELS } from '../src/galaxy/MonumentModel.js';

describe('owner-approved galaxy art selection', () => {
  it('uses every original Fleet V2 model, native finish, card and icon', () => {
    for (const asset of Object.values(FLEET_V2_ASSET_MANIFEST)) {
      for (const url of [asset.model, asset.lodModel, asset.card, asset.icon]) {
        expect(url).not.toContain('premium-v2');
        expect(existsSync(`public${url}`)).toBe(true);
      }
    }
    expect(HULL_MODEL.DART).toBe('/assets/models/ships/dart.glb');
    expect(MODEL_FACING[MODEL.probe]).toBe('-x');
    expect(MODEL_FACING[MODEL.drill]).toEqual([0.8652, -0.5010, 0.0208]);
    expect(MODEL.probe).toBe('/assets/models/ships/explorer_ship.glb');
    expect(PROBE_ART).toBe('/assets/images/ships/explorer_ship.png');
    expect(MODEL.drill).toBe('/assets/models/drills/drill.glb');
    expect(HULL_LOD_MODEL.PROSPECTOR).toBe(MODEL.drill);
    expect(HULL_ART.PROSPECTOR).toBe('/assets/images/drills/drill_1.png');
  });

  it('uses the older complete rocky ring and original abandoned station', () => {
    expect(MODEL.debris).toBe('/assets/models/debris/debris.glb');
    expect(existsSync(`public${MODEL.debris}`)).toBe(true);
    expect(MONUMENT_MODELS[1]).toBe('/assets/models/monuments/monument_abandoned_station.glb');
    const wreck = readFileSync('src/galaxy/Wrecks.tsx', 'utf8');
    expect(wreck).toContain('useGLTF(MODEL.debris, false)');
    expect(wreck).not.toContain('wreckPieces');
  });

  it('retains the rocket plume without the separate yellow glow ball', () => {
    const engine = readFileSync('src/galaxy/StrategicExhaust.tsx', 'utf8');
    expect(engine).toContain('<RocketPlume');
    expect(engine).not.toContain('<sprite');
    expect(engine).not.toContain('softGlow');
    const fleet = readFileSync('src/galaxy/Fleets.tsx', 'utf8');
    expect(fleet).toContain('<StrategicExhaust');
    expect(fleet).toContain('<EngineJets');
    const sky = readFileSync('src/galaxy/Environment.tsx', 'utf8');
    expect(sky).not.toContain('/assets/sky/premium-');
  });
});
