import type { Resources } from './types.js';

/** Owner-selected L12 production reference: 32 alloy = 16 crystal = 1 deuterium. */
export const RESOURCE_VALUE: Readonly<Resources> = { alloy: 1, crystal: 2, deuterium: 32 };

/** Replacement/production effort in alloy equivalents; never a Dominion or loot-volume conversion. */
export const resourceValue = (resources: Resources): number =>
  resources.alloy * RESOURCE_VALUE.alloy
  + resources.crystal * RESOURCE_VALUE.crystal
  + resources.deuterium * RESOURCE_VALUE.deuterium;
