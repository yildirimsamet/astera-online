import { HANGAR, START_BUILDINGS } from './constants.js';
import {
  alloyRate,
  buildingCost,
  buildingMinutes,
  crystalRate,
  deuteriumRate,
  deuteriumStorageCap,
  hullWorkMinutes,
  researchMinutes,
  storageCap,
} from './economy.js';
import { HULLS, hullBulk } from './hulls.js';
import { missionFuel } from './fuel.js';
import { RESEARCH_PROJECTS } from './research.js';
import {
  RESEARCH_PROJECT_IDS,
  type Fleet,
  type HullId,
  type MobileHullId,
  type ResearchProjectId,
  type Resources,
} from './types.js';
import type { TechLevels } from './tech.js';

/**
 * CAN A COMMANDER ON THE FLEET PATH EVER HOLD THIS PRICE AT ONCE — AND WHAT DOES A FIRST NAVY
 * REALLY COST? Plan §15.5b, items 2B.1 and 2B.3.
 *
 * TWO INSTRUMENTS, ONE REASON. The chat logs report the same wall from two sides: *"hangar 263k
 * alaşım"* and *"filo yapamıyorum"*. Nothing in the game could answer either question, because
 * both are about a WHOLE path and every figure the game keeps is about one purchase.
 *
 *   · `hangarBankability` asks whether a rung's price fits inside a world's store AT ALL. A store
 *     has a hard ceiling — production past it overflows and is lost — so a rung priced above what
 *     a world can hold is not a long grind. It is a level that cannot be bought, by anyone, ever,
 *     and no amount of patience changes that. PER RESOURCE, never in alloy-equivalent: a healthy
 *     AE headroom can sit entirely in crystal while the alloy line is the one refusing the sale.
 *
 *   · `navyPackage` prices the whole fleet path as ONE figure — *"filo yolunun gerçek bariyeri
 *     budur; parçalar ayrı ölçülmez"*. A Shipyard rung looks affordable; a Shipyard rung plus the
 *     Core it needs plus Engineering plus the doctrine plus the Hangar room plus the wing plus the
 *     transports plus a collector plus ten launches of fuel is the thing a player actually faces.
 *
 * THIS PACKAGE MEASURES, IT DOES NOT PRICE. Nothing here decides a cost; every figure is read off
 * the shipped ladders. It lives beside `economy-profile.ts` and `raid-trials.ts` for the same
 * reason they do — the simulator, the balance studies and the tests all need one definition.
 */

/* ── the state a fleet-path commander is measured in ──────────── */

export interface FleetPathReference {
  core: number;
  refinery: number;
  extractor: number;
  plant: number;
  vault: number;
}

/**
 * THE MOST GENEROUS FLEET-PATH WORLD THERE IS, AND THAT IS DELIBERATE.
 *
 * The plan rejects "reachable store" by name: a Refinery 18 is technically reachable, and
 * measuring against it would describe the ECONOMY path's world while claiming to describe the
 * fleet path's. So the producers are pegged to the CORE — the one ladder both paths must climb,
 * and the ceiling the game itself enforces, since no building may exceed the Core.
 *
 * A commander cannot do better than this on the fleet path. If a rung will not fit here, it fits
 * nowhere.
 *
 * THE VAULT IS AN INPUT, NOT AN ASSUMPTION. It is the one building a fleet-path commander has a
 * real reason to skip — it protects ore they are spending anyway — and it moves the store ceiling
 * by a factor of eight at Core 16. Defaulting it to zero states the fleet path; passing the Core
 * states the commander who built both.
 */
export const fleetPathReference = (core: number, vault = 0): FleetPathReference => {
  const level = Math.max(0, Math.floor(core));
  return {
    core: level,
    refinery: level,
    extractor: level,
    plant: level,
    vault: Math.min(level, Math.max(0, Math.floor(vault))),
  };
};

/** The most of each resource this world can hold at one instant. Past it, production is lost. */
export const storeCeiling = (ref: FleetPathReference): Resources => ({
  alloy: storageCap(alloyRate(ref.refinery), ref.vault),
  crystal: storageCap(crystalRate(ref.extractor), ref.vault),
  deuterium: deuteriumStorageCap(
    deuteriumRate(ref.plant), crystalRate(ref.extractor), ref.vault,
  ),
});

/**
 * HOW MUCH OF A FULL STORE A PRICE MAY TAKE. Owner plan, 2B.1: `cost <= margin x cap`.
 *
 * One, because the invariant this exists to state is the hard one: a price above a full store is
 * a price nobody can assemble. A softer margin is a design target and belongs in the balance
 * discussion, not in the definition of "possible".
 */
export const BANKABILITY_MARGIN = 1;

export interface Bankability {
  rung: number;
  reference: FleetPathReference;
  cost: Resources;
  ceiling: Resources;
  /** Price as a multiple of a full store, per resource. Above the margin on ANY line refuses. */
  ratio: Resources;
  bankable: boolean;
}

export function hangarBankability(rung: number, reference: FleetPathReference): Bankability {
  const cost = buildingCost('HANGAR', rung - 1);
  const ceiling = storeCeiling(reference);
  const share = (price: number, cap: number): number =>
    price <= 0 ? 0 : cap <= 0 ? Infinity : price / cap;
  const ratio: Resources = {
    alloy: share(cost.alloy, ceiling.alloy),
    crystal: share(cost.crystal, ceiling.crystal),
    deuterium: share(cost.deuterium, ceiling.deuterium),
  };
  return {
    rung,
    reference,
    cost,
    ceiling,
    ratio,
    bankable: ratio.alloy <= BANKABILITY_MARGIN
      && ratio.crystal <= BANKABILITY_MARGIN
      && ratio.deuterium <= BANKABILITY_MARGIN,
  };
}

/* ── what a rung is sized for ─────────────────────────────────── */

export type NavyTier = 1 | 2 | 3 | 4;

/**
 * THE COMBAT TIER EACH HANGAR RUNG IS MEANT TO SUPPORT — AUTHORED, AND THAT IS THE POINT.
 *
 * Plan 2B.3: *"rung başına yazılı referans formasyon … `HULLS`'tan dinamik 'en ucuz' okuma yok —
 * bir gövde dengesi değişikliği altyapıyı sessizce yeniden fiyatlandırmasın."* A reference that
 * read the catalogue for the cheapest legal hull would answer DART at every rung, and the late
 * rungs would be priced for a tier-1 wing — which is how "25–35% of the cheapest legal formation"
 * produced a figure three times too small in the Codex round.
 *
 * The mapping follows `HANGAR.coreGate`: the rung a Core opens is sized for the tier a commander
 * at that Core is fighting with. Rungs 7–10 all sit behind Core 16 and are the late-game rungs, so
 * they are sized for tier 4.
 *
 * IT IS A WRITTEN DECISION AND MAY BE ARGUED WITH. Change it here, in one place, and every figure
 * that depends on it moves together.
 */
export const NAVY_RUNG_TIER: Readonly<Record<number, NavyTier>> = {
  1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 4, 10: 4,
};

/** The line-of-battle hull each tier is represented by. Authored, never derived from a price. */
export const NAVY_TIER_HULL: Readonly<Record<NavyTier, MobileHullId>> = {
  1: 'RAMPART',
  2: 'VIPER',
  3: 'BALLISTA',
  4: 'CITADEL',
};

/** The transport and the salvager a navy is not a navy without. */
export const NAVY_TIER_CARGO: Readonly<Record<NavyTier, HullId>> = {
  1: 'COURIER', 2: 'COURIER', 3: 'ATLAS', 4: 'ATLAS',
};

/**
 * THE WING THAT FILLS THE ROOM THIS RUNG ADDS, in the rung's authored tier.
 *
 * Whole hulls only: a rung that adds room for 6.4 Citadels buys six. The ROSTER is fixed by the
 * tables above; only its PRICE moves when the catalogue is rebalanced.
 */
export function referenceFormation(rung: number): Fleet {
  const tier: NavyTier = NAVY_RUNG_TIER[rung] ?? 4;
  const hull = NAVY_TIER_HULL[tier];
  const added = (HANGAR.capacity[rung] ?? 0) - (HANGAR.capacity[rung - 1] ?? 0);
  const count = Math.max(1, Math.floor(added / hullBulk(hull)));
  return { [hull]: count };
}

/* ── the whole cost of a first useful navy ────────────────────── */

export interface NavyLine {
  what: 'CORE' | 'SHIPYARD' | 'HANGAR' | 'STARSHIP_ENGINEERING' | 'DOCTRINE'
    | 'SUPPORT_RESEARCH' | 'WING' | 'CARGO' | 'COLLECTORS' | 'FUEL';
  detail: string;
  cost: Resources;
  minutes: number;
}

export interface NavyPackage {
  tier: NavyTier;
  /** The combat wing alone — the part the Hangar rung was sized for. */
  wing: Fleet;
  /** Everything the package flies: the wing, its transports and its salvager. */
  fleet: Fleet;
  /** The state the package ends in, so a reader can check it against the product's gates. */
  core: number;
  shipyard: number;
  hangar: number;
  research: TechLevels;
  cost: Resources;
  minutes: number;
  breakdown: readonly NavyLine[];
}

/** How many launches a first navy is expected to pay for before it has earned anything. */
export const NAVY_FIRST_LAUNCHES = 10;

/** The reach those launches fly, in the same units `distance` returns. A neighbourhood raid. */
export const NAVY_LAUNCH_DISTANCE = 600;

/** One salvager, because a raid that cannot lift its own wreck leaves its only profit behind. */
export const NAVY_COLLECTORS = 1;

/** Two transports: one to carry the take home, one because a single hull is a single loss. */
export const NAVY_CARGO_COUNT = 2;

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const add = (a: Resources, b: Resources): Resources => ({
  alloy: a.alloy + b.alloy, crystal: a.crystal + b.crystal, deuterium: a.deuterium + b.deuterium,
});
const times = (r: Resources, n: number): Resources => ({
  alloy: r.alloy * n, crystal: r.crystal * n, deuterium: r.deuterium * n,
});
const hullCost = (id: HullId): Resources => ({
  alloy: HULLS[id].alloy, crystal: HULLS[id].crystal, deuterium: HULLS[id].deuterium,
});

/**
 * THE LADDER A BUILDING IS CLIMBED THROUGH, TIMED THE WAY THE CONSTRUCTION QUEUE TIMES IT.
 *
 * `buildingMinutes(id, level + 1)` and nothing else — the generic `buildMinutes(cost, core)` is
 * what the first version used, and it priced a Tier 3 climb at five times the queue's real time.
 */
const ladder = (
  id: 'CORE' | 'SHIPYARD' | 'HANGAR',
  from: number,
  to: number,
): { cost: Resources; minutes: number } => {
  let cost = ZERO;
  let minutes = 0;
  for (let level = from; level < to; level++) {
    cost = add(cost, buildingCost(id, level));
    minutes += buildingMinutes(id, level + 1, {});
  }
  return { cost, minutes };
};

/**
 * EVERY RESEARCH RUNG THESE HULLS NEED, WITH THE CHAIN IN FRONT OF IT.
 *
 * A hull names its own requirements; the server also refuses a project whose `prerequisite` is not
 * held (one rung is enough). Walking that chain is what the first version skipped, and it is how
 * an Atlas came to be flown without the Dense Fuel Cells and Isotope Spectrometry it stands behind.
 */
const researchNeeded = (hulls: readonly HullId[]): TechLevels => {
  const need: TechLevels = {};
  const require = (id: ResearchProjectId, level: number): void => {
    if ((need[id] ?? 0) >= level) return;
    need[id] = level;
    const prerequisite = RESEARCH_PROJECTS[id].prerequisite;
    if (prerequisite !== null) require(prerequisite, 1);
  };
  for (const hull of hulls) {
    for (const row of HULLS[hull].requiredResearch) require(row.project, row.level);
  }
  return need;
};

/**
 * EVERYTHING BETWEEN A NEW COMMANDER AND A NAVY THAT CAN FLY, AS ONE FIGURE.
 *
 * The parts are listed because a reader needs to see where the weight sits, and totalled because
 * the plan is explicit that they are not to be measured separately: every one of them is
 * mandatory, and quoting any single one is how the fleet path came to look affordable.
 *
 * WHAT IT ASSUMES, STATED:
 *   · the commander starts from `START_BUILDINGS`;
 *   · the Shipyard is the highest any flown hull needs — the salvager's 4 sets it at Tier 1 and 2;
 *   · the Core climbs only as far as that Shipyard and the research's own `requiredCore` demand
 *     (no building may exceed the Core; the Hangar is exempt since plan 2B.6);
 *   · research is bought after the Core is climbed, so every rung is timed at the package's Core —
 *     the capital's, which is the one the research queue reads (D209);
 *   · one Hangar rung of room is taken for the wing, and the transports and salvager fit beside it.
 *
 * WHAT IT DOES NOT PRICE, BECAUSE IT IS NOT A COST: Isotope Spectrometry opens on the season clock
 * and Dense Fuel Cells is discovered by a cargo-limited raid. From Tier 3 the Atlas stands behind
 * both — a gate of time and of play, not of ore.
 *
 * Minutes are the SUM of queue time, not a finish date: construction, research and the yard are
 * three queues that run side by side in the product, and this figure is the work, not the calendar.
 */
export function navyPackage(tier: NavyTier): NavyPackage {
  const hull = NAVY_TIER_HULL[tier];
  const cargoHull = NAVY_TIER_CARGO[tier];
  const hulls: readonly HullId[] = [hull, cargoHull, 'GARBAGE_COLLECTOR'];

  const research = researchNeeded(hulls);
  const yard = Math.max(...hulls.map((id) => HULLS[id].minShipyard));
  const held = RESEARCH_PROJECT_IDS.filter((id) => (research[id] ?? 0) > 0);
  const researchCore = Math.max(0, ...held.map((id) => RESEARCH_PROJECTS[id].requiredCore ?? 0));
  const core = Math.max(START_BUILDINGS.CORE, yard, researchCore);

  const rung = Object.keys(NAVY_RUNG_TIER)
    .map(Number)
    .filter((r) => NAVY_RUNG_TIER[r] === tier)
    .sort((a, b) => a - b)[0] ?? START_BUILDINGS.HANGAR;
  const wing = referenceFormation(rung);

  const coreLadder = ladder('CORE', START_BUILDINGS.CORE, core);
  const yardLadder = ladder('SHIPYARD', START_BUILDINGS.SHIPYARD, yard);
  const hangarLadder = ladder('HANGAR', START_BUILDINGS.HANGAR, rung);

  // Each project priced once, in exactly one line: Engineering, the wing's doctrine, or what the
  // transports and the salvager bring with them.
  const doctrineIds = new Set(HULLS[hull].requiredResearch.map((row) => row.project));
  const lineOf = (id: ResearchProjectId): 'STARSHIP_ENGINEERING' | 'DOCTRINE' | 'SUPPORT_RESEARCH' =>
    id === 'STARSHIP_ENGINEERING' ? id : doctrineIds.has(id) ? 'DOCTRINE' : 'SUPPORT_RESEARCH';
  const researchLine = (
    what: 'STARSHIP_ENGINEERING' | 'DOCTRINE' | 'SUPPORT_RESEARCH',
  ): NavyLine => {
    let cost = ZERO;
    let minutes = 0;
    const named: string[] = [];
    for (const id of held) {
      if (lineOf(id) !== what) continue;
      const top = research[id] ?? 0;
      named.push(`${id} ${String(top)}`);
      for (let level = 1; level <= top; level++) {
        const rungCost = RESEARCH_PROJECTS[id].costAt(level);
        cost = add(cost, rungCost);
        minutes += researchMinutes(rungCost, core);
      }
    }
    return { what, detail: named.join(' · '), cost, minutes };
  };

  const wingCount = wing[hull] ?? 1;
  const fleet: Fleet = {
    ...wing, [cargoHull]: NAVY_CARGO_COUNT, GARBAGE_COLLECTOR: NAVY_COLLECTORS,
  };
  const fuel = missionFuel(fleet, NAVY_LAUNCH_DISTANCE, 2) * NAVY_FIRST_LAUNCHES;

  const breakdown: NavyLine[] = [
    { what: 'CORE', detail: `Core ${String(START_BUILDINGS.CORE)} → ${String(core)}`, ...coreLadder },
    { what: 'SHIPYARD', detail: `Shipyard ${String(START_BUILDINGS.SHIPYARD)} → ${String(yard)}`, ...yardLadder },
    { what: 'HANGAR', detail: `Hangar ${String(START_BUILDINGS.HANGAR)} → ${String(rung)}`, ...hangarLadder },
    researchLine('STARSHIP_ENGINEERING'),
    researchLine('DOCTRINE'),
    researchLine('SUPPORT_RESEARCH'),
    {
      what: 'WING', detail: `${String(wingCount)} × ${hull}`,
      cost: times(hullCost(hull), wingCount),
      minutes: hullWorkMinutes(hull, wingCount, yard, research),
    },
    {
      what: 'CARGO', detail: `${String(NAVY_CARGO_COUNT)} × ${cargoHull}`,
      cost: times(hullCost(cargoHull), NAVY_CARGO_COUNT),
      minutes: hullWorkMinutes(cargoHull, NAVY_CARGO_COUNT, yard, research),
    },
    {
      what: 'COLLECTORS', detail: `${String(NAVY_COLLECTORS)} × GARBAGE_COLLECTOR`,
      cost: times(hullCost('GARBAGE_COLLECTOR'), NAVY_COLLECTORS),
      minutes: hullWorkMinutes('GARBAGE_COLLECTOR', NAVY_COLLECTORS, yard, research),
    },
    {
      what: 'FUEL',
      detail: `${String(NAVY_FIRST_LAUNCHES)} round trips at ${String(NAVY_LAUNCH_DISTANCE)}`,
      cost: { alloy: 0, crystal: 0, deuterium: fuel },
      minutes: 0,
    },
  ];

  return {
    tier,
    wing,
    fleet,
    core,
    shipyard: yard,
    hangar: rung,
    research,
    cost: breakdown.reduce((acc, line) => add(acc, line.cost), ZERO),
    minutes: breakdown.reduce((n, line) => n + line.minutes, 0),
    breakdown,
  };
}
