import { COMBAT } from '../constants.js';
import { shieldHp } from '../economy.js';
import { STARTER } from './constants.js';

/**
 * WHAT A SHIP'S AEGIS IS WORTH HERE. Damage is halved in this galaxy, so a wall kept at the main
 * game's height would turn 6 Darts on 3 Darts + Aegis 1 away empty 86% of the time (13% in the main
 * game). The wall scales with the tempo, and stops at the stage past which it closes PvP for pocket
 * money. Plan §3.5.
 */
export const vesselAegisHp = (stage: number): number =>
  Math.round(shieldHp(Math.min(stage, STARTER.combat.aegisMax)) * STARTER.combat.tempo / COMBAT.tempo);
