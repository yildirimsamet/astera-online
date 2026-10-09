import { describe, expect, it } from 'vitest';
import { HULL_MODEL, HULL_LOD_MODEL, MODEL_FACING } from '../src/ui/assets.js';
import { shipHullModels } from '../src/galaxy/shipCosmetics.js';

describe('equipped model selection in mixed formations', () => {
  it('replaces only each matching ship, with separate full and distant models', () => {
    const skins = { CORSAIR: 'ship-red-dragon', CITADEL: 'ship-shark' } as const;
    expect(shipHullModels('CORSAIR', skins)).toEqual({ model: '/assets/models/ships/skins/red-dragon/model.glb', lodModel: '/assets/models/ships/skins/red-dragon/model_lod.glb' });
    expect(shipHullModels('CITADEL', skins)).toEqual({ model: '/assets/models/ships/skins/shark/model.glb', lodModel: '/assets/models/ships/skins/shark/model_lod.glb' });
    for (const hull of ['DART', 'PROSPECTOR', 'NULLIFIER'] as const) {
      expect(shipHullModels(hull, skins)).toEqual({ model: HULL_MODEL[hull], lodModel: HULL_LOD_MODEL[hull] });
    }
  });
  it('uses the base model without equipment and rejects a skin mapped to the wrong hull', () => {
    expect(shipHullModels('VIPER')).toEqual({ model: HULL_MODEL.VIPER, lodModel: HULL_LOD_MODEL.VIPER });
    expect(shipHullModels('VIPER', { VIPER: 'ship-red-dragon' })).toEqual(shipHullModels('VIPER'));
  });
  it('declares the measured nose for flight, LOD and inspection, including wide wings', () => {
    for (const [name, facing] of [['red-dragon', '-x'], ['scorpion', '+z'], ['shark', '-x'], ['stingray', '+z']] as const) {
      for (const suffix of ['', '_lod', '_preview']) expect(MODEL_FACING[`/assets/models/ships/skins/${name}/model${suffix}.glb`]).toBe(facing);
    }
  });
});
