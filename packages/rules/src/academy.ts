import { OPENING_BONUS, START_BUILDINGS, PROSPECTOR } from './constants.js';
import { buildingCost, buildMinutes, instrumentCost } from './economy.js';
import { HULLS, fleetCargo } from './hulls.js';
import { resolveCombat } from './combat.js';
import { mulberry32 } from './rng.js';
import { pirateCapture, pirateStats, pirateHoard } from './pirates.js';
import { computeLoot } from './loot.js';
import { missionFuel } from './fuel.js';
import { claimOre } from './galaxy.js';
import { findRewardTier } from './rewards.js';
import type { BuildingId, Fleet, Resources } from './types.js';

/** D172. Authored checkpoints, not client state. No clock, I/O or ambient RNG.
 * Each action and reward is a separate checkpoint so stopping before Claim
 * cannot mark an unseen reward paid. The UI must allow only the current action.
 */
export const ACADEMY_STEPS = [
  { id: 'welcome' }, { id: 'production' },
  { id: 'core', building: 'CORE' }, { id: 'coreReward', reward: 'CORE:2' },
  { id: 'refinery', building: 'REFINERY' }, { id: 'refineryReward', reward: 'REFINERY:2' },
  { id: 'extractor', building: 'EXTRACTOR' }, { id: 'extractorReward', reward: 'EXTRACTOR:2' },
  { id: 'deuterium' }, { id: 'foundry' }, { id: 'intel' }, { id: 'uplink' },
  { id: 'telescope' }, { id: 'radar' }, { id: 'veil' }, { id: 'defend' },
  { id: 'vault', building: 'VAULT' }, { id: 'vaultReward', reward: 'VAULT:1' },
  { id: 'aegis' }, { id: 'aegisReward', reward: 'AEGIS:1' },
  { id: 'thorn' }, { id: 'bastion' }, { id: 'fleet' },
  { id: 'shipyard', building: 'SHIPYARD' }, { id: 'shipyardReward', reward: 'SHIPYARD:1' },
  { id: 'hangar' }, { id: 'darts' }, { id: 'pirate' }, { id: 'pirateReport' },
  { id: 'pirateReward', reward: 'PIRATE:1' }, { id: 'shipsReward', reward: 'SHIPS:2' },
  { id: 'prospector' }, { id: 'mine' }, { id: 'mineReward', reward: 'MINE:1' },
  { id: 'research' }, { id: 'reinforcements' }, { id: 'courier' },
  { id: 'raid' }, { id: 'raidReport' }, { id: 'departure' },
] as const;
export type AcademyStepId = (typeof ACADEMY_STEPS)[number]['id'];

export interface AcademyCheckpoint {
  buildings: Record<BuildingId, number>;
  instruments: { AEGIS: number };
  fleet: Fleet;
  builtEver: Fleet;
  resources: Resources;
  buffer: Resources;
  claimedRewards: string[];
  progress: { PIRATE: number; MINE: number; RAID: number };
  queue: { building: 'CORE' | 'REFINERY' | 'EXTRACTOR'; seconds: number; cost: Resources } | null;
}

export const ACADEMY_PIRATE_FLEET: Fleet = { WARDEN: 1 };

/**
 * WHAT EACH MISSION LESSON SENDS, AND WHY IT IS EXACTLY WHAT IS STANDING THERE.
 *
 * The tutorial teaches one gesture for filling a picker — Max — and points its
 * hand at it. So a lesson may only ask for a number Max actually produces, which
 * is every one of that hull the commander is holding at that step. Anything else
 * refuses the launch, and the Academy silences toasts, so the refusal arrives as
 * a button that does nothing.
 *
 * `ACADEMY_RAID_FLEET` read `{ DART: 2, COURIER: 1 }` and was wrong from the day
 * the pirate fight started leaving a survivor: one Dart comes home, two more are
 * built by `reinforcements`, and the commander stands on three. `academy.test.ts`
 * now ties both of these to `academyCheckpoint`, so the economy above them cannot
 * drift away from them again in silence.
 *
 * NEITHER NAMES THE CAPTURED WARDEN, on owner instruction. It is a real warship
 * and it would be legal to send, but the raid lesson is the payoff of "build two
 * Darts and a Courier" and a third hull in the picker asks a question the lesson
 * has not taught the answer to. It stays in the hangar; the roster screen is
 * where a captured hull is meant to be discovered.
 */
export const ACADEMY_PIRATE_RAID_FLEET: Fleet = { DART: 2 };
export const ACADEMY_RAID_FLEET: Fleet = { DART: 3, COURIER: 1 };

/**
 * WHAT COMES HOME FROM THE PIRATE LESSON: the survivors, plus the prize.
 *
 * A DECISIVE win tows one of the pirate's hulls back (D133/D150) and this fight
 * always wins one, so the commander lands with a Warden they never built. The
 * disc used to draw the return leg from `attackerSurvivors` alone — one Dart —
 * and the captured ship just turned up in the hangar afterwards with nothing on
 * screen tying it to the fight. One statement, read by the checkpoint below and
 * by `academyPending`, so the fleet that flies home and the fleet that lands
 * cannot disagree.
 */
export function academyPirateHomecoming(): Fleet {
  const battle = academyPirateBattle();
  const home: Fleet = { ...battle.attackerSurvivors };
  const captured = pirateCapture(1, ACADEMY_PIRATE_FLEET, battle.grade, () => 0);
  if (captured) home[captured] = (home[captured] ?? 0) + 1;
  return home;
}
export const academyLessonFleet = (kind: 'pirate' | 'raid'): Fleet =>
  kind === 'pirate' ? ACADEMY_PIRATE_RAID_FLEET : ACADEMY_RAID_FLEET;

export const academyPirateBattle = () => resolveCombat(
  { ...ACADEMY_PIRATE_RAID_FLEET }, ACADEMY_PIRATE_FLEET, 0, mulberry32(1),
  { attacker: { tech: {} }, defender: { tech: {}, ...pirateStats(1) } },
);
export const ACADEMY_FLIGHT_DISTANCE = 150;
export const ACADEMY_LEG_SECONDS = 6;
export const academyOrderSeconds = (minutes: number): number => Math.max(1, Math.min(8, Math.ceil(minutes * 60)));
export const academyRaidBattle = () => resolveCombat(
  ACADEMY_RAID_FLEET, {}, 0, mulberry32(2),
  { attacker: { tech: {} }, defender: { tech: {} } },
);
const empty: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
export const academyPirateLoot = () => computeLoot(
  pirateHoard(ACADEMY_PIRATE_FLEET), empty, empty,
  academyPirateBattle().grade, fleetCargo(academyPirateBattle().attackerSurvivors, {}),
);
export const academyRaidLoot = () => computeLoot(
  { alloy: 600, crystal: 240, deuterium: 0 }, empty, empty,
  academyRaidBattle().grade, fleetCargo(academyRaidBattle().attackerSurvivors, {}),
);
export const academyMinedOre = (): Resources => {
  const ore = claimOre(120, PROSPECTOR.hold, 0.3, 0);
  return { alloy: ore.alloy, crystal: ore.crystal, deuterium: ore.deuterium };
};
export const academyFuel = (kind: 'pirate' | 'raid'): number =>
  missionFuel(academyLessonFleet(kind), ACADEMY_FLIGHT_DISTANCE, 2);

const departureCost = buildingCost('CORE', 2);
function lessonCost(step: (typeof ACADEMY_STEPS)[number] | undefined, state: AcademyCheckpoint): Resources {
  if (!step) return empty;
  if ('building' in step) return buildingCost(step.building, state.buildings[step.building]);
  if (step.id === 'aegis') return instrumentCost('AEGIS', 0);
  if (step.id === 'departure') return departureCost;
  if (step.id === 'pirate' || step.id === 'raid') return { ...empty, deuterium: academyFuel(step.id) };
  const id = step.id === 'darts' || step.id === 'reinforcements' ? 'DART'
    : step.id === 'prospector' ? 'PROSPECTOR' : step.id === 'courier' ? 'COURIER' : null;
  if (!id) return empty;
  const count = id === 'DART' ? 2 : 1;
  return { alloy: HULLS[id].alloy * count, crystal: HULLS[id].crystal * count, deuterium: HULLS[id].deuterium * count };
}

export function academyCheckpoint(completed: number): AcademyCheckpoint {
  if (!Number.isInteger(completed) || completed < 0 || completed > ACADEMY_STEPS.length) {
    throw new RangeError('Unauthored Academy step');
  }
  const state: AcademyCheckpoint = {
    buildings: { ...START_BUILDINGS }, instruments: { AEGIS: 0 },
    fleet: {}, builtEver: {}, resources: { ...OPENING_BONUS }, buffer: { ...empty }, claimedRewards: [],
    progress: { PIRATE: 0, MINE: 0, RAID: 0 }, queue: null,
  };
  const spend = (cost: Resources) => {
    state.resources.alloy -= cost.alloy;
    state.resources.crystal -= cost.crystal;
    state.resources.deuterium -= cost.deuterium;
  };
  // Only fund the current commitment's shortfall. Skipping the first lesson
  // cannot collect the prices of every ship that would have been taught later.
  const fund = (step: (typeof ACADEMY_STEPS)[number] | undefined) => {
    const cost = lessonCost(step, state);
    state.resources.alloy = Math.max(state.resources.alloy, cost.alloy);
    state.resources.crystal = Math.max(state.resources.crystal, cost.crystal);
    state.resources.deuterium = Math.max(state.resources.deuterium, cost.deuterium);
  };
  const build = (id: 'DART' | 'PROSPECTOR' | 'COURIER', count: number) => {
    const hull = HULLS[id];
    spend({ alloy: hull.alloy * count, crystal: hull.crystal * count, deuterium: hull.deuterium * count });
    state.fleet[id] = (state.fleet[id] ?? 0) + count;
    state.builtEver[id] = (state.builtEver[id] ?? 0) + count;
  };
  for (const step of ACADEMY_STEPS.slice(0, completed)) {
    fund(step);
    if ('building' in step) {
      spend(buildingCost(step.building, state.buildings[step.building]));
      state.buildings[step.building]++;
    }
    if ('reward' in step) {
      const ref = findRewardTier(step.reward);
      if (!ref) throw new Error(`Missing Academy reward: ${step.reward}`);
      state.claimedRewards.push(ref.id);
      spend({ alloy: -ref.tier.reward.alloy, crystal: -ref.tier.reward.crystal, deuterium: -ref.tier.reward.deuterium });
    }
    switch (step.id) {
      case 'aegis': spend(instrumentCost('AEGIS', 0)); state.instruments.AEGIS = 1; break;
      case 'darts': case 'reinforcements': build('DART', 2); break;
      case 'prospector': build('PROSPECTOR', 1); break;
      case 'courier': build('COURIER', 1); break;
      case 'pirate': {
        state.fleet = academyPirateHomecoming();
        state.progress.PIRATE = 1;
        const loot = academyPirateLoot();
        spend({ alloy: -loot.alloy, crystal: -loot.crystal, deuterium: academyFuel('pirate') - loot.deuterium });
        break;
      }
      case 'mine': state.progress.MINE = 1; state.buffer = academyMinedOre(); break;
      case 'raid': {
        state.progress.RAID = 1;
        const loot = academyRaidLoot();
        spend({ alloy: -loot.alloy, crystal: -loot.crystal, deuterium: academyFuel('raid') - loot.deuterium });
        break;
      }
      case 'departure':
        spend(departureCost);
        state.queue = { building: 'CORE', seconds: Math.ceil(buildMinutes(departureCost, state.buildings.CORE) * 60), cost: { ...departureCost } };
        break;
    }
  }
  fund(ACADEMY_STEPS[completed]);
  return state;
}

/** Leaving early preserves taught progress but must not create an empty first
 * session. Start the first missing opening upgrade; otherwise start Core 3. */
export function academyExitCheckpoint(completed: number): AcademyCheckpoint {
  const state = academyCheckpoint(completed);
  if (state.queue) return state;
  const building = (['CORE', 'REFINERY', 'EXTRACTOR'] as const)
    .find((id) => state.buildings[id] < 2) ?? 'CORE';
  const cost = buildingCost(building, state.buildings[building]);
  state.resources = {
    alloy: Math.max(0, state.resources.alloy - cost.alloy),
    crystal: Math.max(0, state.resources.crystal - cost.crystal),
    deuterium: Math.max(0, state.resources.deuterium - cost.deuterium),
  };
  state.queue = { building, cost, seconds: Math.ceil(buildMinutes(cost, state.buildings.CORE) * 60) };
  return state;
}

export const TUTORIAL_EXIT = academyExitCheckpoint(ACADEMY_STEPS.length);
/** Separate from the untouched neutral-world grant. */
export const PLANET_START_WITH_TUTORIAL: Resources = { ...TUTORIAL_EXIT.resources };
