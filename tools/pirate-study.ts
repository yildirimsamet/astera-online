import { generateGalaxy } from '../packages/rules/src/galaxy.js';
import { sensorReach, radarContactRange } from '../packages/rules/src/intel.js';
import {
  activePirates,
  generatePirateSchedule,
  piratePosition,
  type PirateSpec,
} from '../packages/rules/src/pirates.js';
import { COMBAT, DEBRIS, PIRATE, SERVERS } from '../packages/rules/src/constants.js';
import { resolveCombat } from '../packages/rules/src/combat.js';
import { computeLoot, gradeMultiplier } from '../packages/rules/src/loot.js';
import { fleetCargo, fleetValue, fleetEntries, HULLS } from '../packages/rules/src/hulls.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import { distance } from '../packages/rules/src/travel.js';
import { seededFrom } from '../packages/rules/src/rng.js';
import type { Fleet, Vec3 } from '../packages/rules/src/types.js';

/**
 * WHAT A COMMANDER ACTUALLY MEETS, AND WHAT BEATING IT IS WORTH. D150.
 *
 * `docs/balance.md` carries two claims about the pirate lane that a reader will
 * one day tune against: how many pirates a commander sees in a session at each
 * rung of the sensor ladder, and whether hunting one pays. Both were written as
 * tables with no instrument behind them, which is the one thing this project's
 * balance notes are not allowed to be — `tools/asteroid-visibility-study.ts` is
 * cited by name beside the rock numbers for exactly this reason.
 *
 * This is that instrument. It reads the shipped constants rather than restating
 * them, so a table regenerated after a constant moves cannot silently disagree
 * with the game.
 *
 *   pnpm study:pirates
 */

/** Five unrelated, repeatable galaxies. */
const SEEDS = [1, 7, 9, 42, 4242] as const;
/** How long a commander is assumed to be away between sessions. */
const SESSION_HOURS = 8;

const quantile = (values: readonly number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

/* ── 1 · OPPORTUNITY ──────────────────────────────────────────────────────── */

interface Rung {
  name: string;
  telescope: number;
  radar: number;
}

/**
 * The three rungs worth reporting. A pirate is a CRAFT, so it answers to the
 * three zones: the naked eye identifies inside `SENSOR.baseRadius`, and a Radar
 * detects at its own wider radius without naming what it found. Both count as an
 * opportunity here — you may launch at a contact you cannot identify.
 */
const RUNGS: Rung[] = [
  { name: 'naked eye', telescope: 0, radar: 0 },
  { name: 'Radar 3', telescope: 0, radar: 3 },
  { name: 'Telescope 5 · Radar 5', telescope: 5, radar: 5 },
];

/** Distinct pirates that enter this world's circles at any point in the window. */
function metBy(
  at: Vec3,
  rung: Rung,
  pirates: readonly PirateSpec[],
  fromMinute: number,
  toMinute: number,
): number {
  const identify = sensorReach(rung.telescope);
  const detect = radarContactRange(rung.radar);
  const reach = Math.max(identify, detect);
  const seen = new Set<number>();
  // One sample a minute. A pirate's shortest revolution is about six minutes, so
  // this cannot step over a whole pass.
  for (let minute = fromMinute; minute < toMinute; minute += 1) {
    for (const spec of activePirates(pirates, minute)) {
      if (seen.has(spec.index)) continue;
      if (distance(at, piratePosition(spec, minute)) <= reach) seen.add(spec.index);
    }
  }
  return seen.size;
}

function opportunity(): void {
  console.log('\n── What a commander meets in one 8-hour session ──\n');
  const perRung = new Map<string, number[]>(RUNGS.map((r) => [r.name, []]));
  let existed = 0;
  let samples = 0;

  for (const seed of SEEDS) {
    const galaxy = generateGalaxy(seed, SERVERS.capacity);
    const pirates = generatePirateSchedule(seededFrom('pirate:study', seed), 60 * 24 * 3);
    // A window well inside the generated span, so the lane is at steady state.
    const from = 24 * 60;
    const to = from + SESSION_HOURS * 60;
    const live = new Set<number>();
    for (let minute = from; minute < to; minute += 1) {
      for (const spec of activePirates(pirates, minute)) live.add(spec.index);
    }
    existed += live.size;
    samples += 1;

    for (const slot of galaxy.slots.slice(0, SERVERS.capacity)) {
      for (const rung of RUNGS) {
        perRung.get(rung.name)!.push(metBy(slot, rung, pirates, from, to));
      }
    }
  }

  const inWindow = existed / samples;
  console.log(`pirates alive at some point in the window: ${inWindow.toFixed(0)}\n`);
  console.log('| Instruments | p10 | median | p90 | share of the window |');
  console.log('| ----------- | --- | ------ | --- | ------------------- |');
  for (const rung of RUNGS) {
    const v = perRung.get(rung.name)!;
    const share = (100 * mean(v)) / inWindow;
    console.log(
      `| ${rung.name} | ${String(quantile(v, 0.1))} | ${String(quantile(v, 0.5))} `
      + `| ${String(quantile(v, 0.9))} | ${share.toFixed(0)}% |`,
    );
  }
  const eye = perRung.get('naked eye')!;
  const p10 = quantile(eye, 0.1);
  console.log(
    `\nnaked-eye p90:p10 spread ${p10 > 0 ? (quantile(eye, 0.9) / p10).toFixed(1) : 'n/a'}x`,
  );
}

/* ── 2 · IS IT PROFITABLE? ────────────────────────────────────────────────── */

const flyingValue = (fleet: Fleet): number =>
  fleetEntries(fleet)
    .filter(([id]) => !HULLS[id].ground)
    .reduce(
      (sum, [id, n]) => sum + n * (HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium),
      0,
    );

/**
 * Two compositions, and the gap between them IS the decision.
 *
 * A wing built for the fight and a hold for the prize should come home ahead; the
 * same budget spent on the wrong shape should not. If both are positive the target
 * is free money, and if both are negative nobody sane launches.
 */
const COMPOSITIONS: { name: string; fleet: (level: 1 | 2 | 3 | 4) => Fleet }[] = [
  {
    /*
      A wing actually sized for the target, which is the case the "profitable"
      claim is about. It scales with the level because a fixed budget is a
      different question — see the two rows under it.
    */
    name: 'sized for the target',
    fleet: (level) => ({ DART: 30 * level * level, COURIER: level + 1 }),
  },
  {
    // Same ships, no room to carry the prize home.
    name: 'sized, but no hold',
    fleet: (level) => ({ DART: 30 * level * level }),
  },
  {
    // Same budget, spent on holds instead of guns.
    name: 'sized, but no guns',
    fleet: (level) => ({ COURIER: 15 * level * level }),
  },
  {
    // One fixed budget against every level, so the table also shows where a
    // commander's current fleet stops being enough.
    name: 'fixed 40 Darts + 2 Couriers',
    fleet: () => ({ DART: 40, COURIER: 2 }),
  },
];

function profitability(): void {
  console.log('\n── E[net] per raid, by composition and pirate level ──\n');
  console.log('| Composition | L1 | L2 | L3 | L4 |');
  console.log('| ----------- | -- | -- | -- | -- |');

  for (const { name, fleet: fleetFor } of COMPOSITIONS) {
    const cells: string[] = [];
    for (const level of [1, 2, 3, 4] as const) {
      const fleet = fleetFor(level);
      const nets: number[] = [];
      for (const seed of SEEDS) {
        const pirates = generatePirateSchedule(seededFrom('pirate:net', seed), 60 * 24)
          .filter((spec) => spec.level === level)
          .slice(0, 12);
        for (const spec of pirates) {
          const rng = seededFrom('pirate:net:fight', seed, spec.index);
          const result = resolveCombat({ ...fleet }, { ...spec.roster }, 0, rng, {
            attacker: { tech: {} },
            defender: { tech: {}, damageMult: PIRATE.damageMult[level] },
          });
          const survivors = result.attackerSurvivors;
          const loot = computeLoot(
            spec.hoard,
            { alloy: 0, crystal: 0, deuterium: 0 },
            { alloy: 0, crystal: 0, deuterium: 0 },
            result.grade,
            fleetCargo(survivors, {}),
          );
          const wreck =
            (flyingValue(result.attackerLosses) + flyingValue(result.defenderLosses))
            * DEBRIS.share;
          // The capture is a chance, so it enters as its expected value.
          const oneHull = fleetValue(spec.roster) / Math.max(1, fleetEntries(spec.roster)
            .reduce((n, [, c]) => n + c, 0));
          const capture = result.grade === 'DECISIVE'
            ? PIRATE.captureChance[level] * oneHull
            : 0;
          // A representative crossing rather than a specific one: the median flight
          // measured from the reach sweep is a little over a quarter of the disc.
          const fuel = missionFuel(fleet, 1200, 2);
          nets.push(
            loot.alloy + loot.crystal + loot.deuterium
            + wreck + capture
            - fleetValue(result.attackerLosses)
            - fuel,
          );
        }
      }
      cells.push(mean(nets).toFixed(0));
    }
    console.log(`| ${name} | ${cells.join(' | ')} |`);
  }

  console.log(
    `\ngrade shares: DECISIVE ${String(gradeMultiplier('DECISIVE'))}`
    + ` · PARTIAL ${String(gradeMultiplier('PARTIAL'))}`
    + ` · partial threshold ${String(COMBAT.partialThreshold)}`,
  );
  console.log(`hoardValueMult ${String(PIRATE.hoardValueMult)} · DEBRIS.share ${String(DEBRIS.share)}`);
}

opportunity();
profitability();
