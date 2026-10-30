/**
 * @astera/rules — the single source of truth for every game rule.
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
export * from './tempo.js';
export * from './valuation.js';
export * from './honor.js';
export * from './honorTeam.js';
export * from './honorRewards.js';
export * from './honorBenefits.js';
export * from './honorValuation.js';
export * from './honorHistory.js';
export * from './honorTactical.js';
export * from './notificationCenter.js';
export * from './honorRadiation.js';
export * from './constants.js';
export * from './pvpBalance.js';
export * from './rng.js';
export * from './hulls.js';
export * from './cosmetics.js';
export * from './countries.js';
export * from './economy.js';
export * from './faults.js';
export * from './fuel.js';
export * from './tech.js';
export * from './travel.js';
export * from './combat.js';
export * from './battleRecording.js';
export * from './shipShield.js';
export * from './battleRetreat.js';
export * from './matchupPower.js';
export * from './powerRange.js';
export * from './damage.js';
export * from './radiation.js';
export * from './radiationHp.js';
export * from './radiationBomb.js';
export * from './hpDamage.js';
export * from './shipMaintenance.js';
export * from './monument.js';
export * from './monumentMotion.js';
export * from './monumentFuel.js';
export * from './monumentCapacity.js';
export * from './monumentCombat.js';
export * from './monumentProbe.js';
export * from './forecast.js';
export * from './escape.js';
export * from './loot.js';
export * from './salvage.js';
export * from './intel.js';
export * from './sight.js';
export * from './score.js';
export * from './galaxy.js';
export * from './asteroidDynamic.js';
export * from './asteroidGeneration.js';
export * from './galaxyEvents.js';
export * from './intergalacticConvoy.js';
export * from './pirates.js';
export * from './trade.js';
export * from './rewards.js';
export * from './brandRecall.js';
export * from './seasonRankRewards.js';
export * from './research.js';
export * from './strategic.js';
export * from './view.js';
export * from './clan.js';
export * from './clanWar.js';
export * from './clanSupport.js';
export * from './academy.js';
export * from './returnQueue.js';
export * from './inactivity.js';
export * from './vacation.js';
export * from './waitingPlacement.js';
export * from './returnPlacement.js';

export * from './economy-profile.js';
export * from './raid-ledger.js';
export * from './raid-trials.js';
export * from './navy-package.js';
export * from './cosmeticCatalog.js';
export * from './pirateGeneration.js';
export * from './pirateLoot.js';
export * from './pirateProfit.js';
export * from './unknownSignal.js';
export * from './spawnGate.js';

export type { ChatMedia } from './chatMedia.js';
export { CHAT_MEDIA } from './chatMedia.js';
export { COMMUNITY_POLICY_VERSION } from './communityPolicy.js';
export { findProfanity } from './profanity.js';
