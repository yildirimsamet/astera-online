import { PIRATE } from './constants.js';

/** Version 2 keeps the existing random draw order and excludes unarmed transports. */
export interface PirateGeneration {
  version: 2;
  oreValueMult: number;
  oreByLevel: number[];
  deuteriumByLevel: number[];
  alloyShare: number;
  fuelMult: number;
}

/** The hour stores a copy. Missing snapshots are the original transport-bearing field. */
export function currentPirateGeneration(): PirateGeneration {
  return {
    version: 2,
    oreValueMult: PIRATE.balanced.oreValueMult,
    oreByLevel: [...PIRATE.balanced.oreByLevel],
    deuteriumByLevel: [...PIRATE.balanced.deuteriumByLevel],
    alloyShare: PIRATE.balanced.alloyShare,
    fuelMult: PIRATE.balanced.fuelMult,
  };
}
