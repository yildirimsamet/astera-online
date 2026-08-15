/**
 * @blindspace/rules — the single source of truth for every game rule.
 *
 * Pure functions only. No clock, no I/O, no ambient randomness. The server
 * imports this to decide outcomes; the simulator imports it to validate balance;
 * the client imports it only to predict and render.
 *
 * ARCHITECTURAL INVARIANT: this package has zero runtime dependencies and must
 * never import a clock, a database, the network, or Math.random. Anything that
 * needs randomness takes an Rng as an argument.
 */

export * from './types.js';
export * from './constants.js';
export * from './rng.js';
export * from './hulls.js';
export * from './economy.js';
export * from './travel.js';
export * from './combat.js';
export * from './loot.js';
export * from './intel.js';
export * from './score.js';
export * from './galaxy.js';
