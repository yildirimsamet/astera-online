/** Shared display/contracts need ship rules, never the arena's generated world geometry. */
export { SHIP_CLASSES, type ShipClass } from './classes.js';
export { ARENA_TUNING, RING_DISTANCE, TACTICS } from './tuning.js';
export { ARENA_ECONOMY, repairQuote, type LoadoutPlan, type Resources as ArenaResources } from './economy.js';
export { ADMIRAL_WAIT, ADMIRAL_XP, admiralApplies, admiralBonuses, type AdmiralBonuses } from './admiral.js';
export type { Ability } from './ranks.js';
