import { describe, expect, it } from 'vitest';
import {
  REPAIR_LADDER, STARTER, STARTER_CRATES, alloyRate, canOrderStep, crystalRate, nextSteps, openingProgress,
  type RepairStep, type VesselModule, type VesselProgress,
} from '../src/index.js';

/**
 * THE FIRST SESSION'S ROAD (owner 2026-11-08, N10–N12). Free spending left the antenna hours away, and
 * the player left before meeting anybody. So the repairs open one at a time, for everyone, and the
 * sensors are cheap enough to be used in the first ten minutes.
 */
const ROAD: readonly (readonly [VesselModule, number])[] = [
  ['REFINERY', 2], ['EXTRACTOR', 1], ['TELESCOPE', 1], ['RADAR', 1], ['SURVEY', 1], ['SHIPYARD', 1],
];
const stepOf = ([module, stage]: readonly [VesselModule, number]): RepairStep => REPAIR_LADDER.find(s => s.module === module && s.stage === stage)!;
const name = (s: RepairStep): string => `${s.module}:${String(s.stage)}`;
const after = (p: VesselProgress, [module, stage]: readonly [VesselModule, number]): VesselProgress => ({ ...p, modules: { ...p.modules, [module]: stage } });
const roadDone = (): VesselProgress => ROAD.reduce(after, openingProgress());

describe('the road opens one repair at a time', () => {
  it('is the ladder\'s own first steps, in order', () => {
    expect(REPAIR_LADDER.slice(0, ROAD.length).map(name)).toEqual(ROAD.map(stepOf).map(name));
  });

  it('offers only the next step at every point of it', () => {
    let ship = openingProgress();
    for (const part of ROAD) {
      expect(nextSteps(ship).map(name)).toEqual([name(stepOf(part))]);
      ship = after(ship, part);
    }
  });

  it('refuses a later step of the road, with the one before it named', () => {
    const answer = canOrderStep(openingProgress(), 'TELESCOPE', 1);
    expect(answer).toMatchObject({ ok: false, code: 'REPAIR_REQUIREMENT' });
    expect(!answer.ok && answer.code === 'REPAIR_REQUIREMENT' && answer.missing).toContainEqual({ kind: 'MODULE', module: 'EXTRACTOR', stage: 1 });
  });

  it('keeps everything off the road behind the shipyard', () => {
    const almost = ROAD.slice(0, -1).reduce(after, openingProgress());
    const off = REPAIR_LADDER.filter(s => !ROAD.some(([m, stage]) => s.module === m && s.stage === stage));
    expect(off.length).toBeGreaterThan(0);
    for (const step of off) expect(canOrderStep(almost, step.module, step.stage).ok, name(step)).toBe(false);
  });

  it('opens the rest of the ship once the shipyard stands', () => {
    const open = nextSteps(roadDone()).map(name);
    expect(open).toEqual(expect.arrayContaining(['EXTRACTOR:2', 'REFINERY:3', 'VAULT:1']));
  });
});

describe('the sensors in the first session', () => {
  it('prices the telescope and the radar for it', () => {
    expect(stepOf(['TELESCOPE', 1])).toMatchObject({ alloy: 250, crystal: 150, minutes: 15 / 60, required: true });
    expect(stepOf(['RADAR', 1])).toMatchObject({ alloy: 200, crystal: 120, minutes: 15 / 60, required: true });
  });

  it('pays the sensors with the crate that used to wait at the third refinery, the sum unchanged', () => {
    expect(STARTER_CRATES.find(c => c.id === 'TELESCOPE:1')).toMatchObject({ module: 'TELESCOPE', stage: 1, reward: { alloy: 650, crystal: 200 } });
    expect(STARTER_CRATES.find(c => c.id === 'RADAR:1')).toMatchObject({ module: 'RADAR', stage: 1, reward: { alloy: 150, crystal: 100 } });
    expect(STARTER_CRATES.find(c => c.id === 'REFINERY:3')).toBeUndefined();
  });

  it('hands over the Prospector with the telescope, and two Darts with the shipyard', () => {
    expect(stepOf(['TELESCOPE', 1]).grants).toEqual({ fleet: { PROSPECTOR: 1 } });
    expect(stepOf(['SHIPYARD', 1]).grants).toEqual({ fleet: { DART: 2 } });
  });

  it('walks the whole road inside ten minutes without waiting on the store', () => {
    let alloy = STARTER.opening.alloy + STARTER.opening.works.alloy, crystal = STARTER.opening.crystal, refinery = 1, extractor = 0, minutes = 0;
    for (const part of ROAD) {
      const step = stepOf(part);
      expect(alloy, `alloy for ${name(step)}`).toBeGreaterThanOrEqual(step.alloy);
      expect(crystal, `crystal for ${name(step)}`).toBeGreaterThanOrEqual(step.crystal);
      alloy += alloyRate(refinery) * step.minutes / 60 - step.alloy;
      crystal += crystalRate(extractor) * step.minutes / 60 - step.crystal;
      minutes += step.minutes;
      if (step.module === 'REFINERY') refinery = step.stage;
      if (step.module === 'EXTRACTOR') extractor = step.stage;
      for (const crate of STARTER_CRATES) if (crate.fact === null && crate.module === step.module && crate.stage === step.stage) { alloy += crate.reward.alloy; crystal += crate.reward.crystal; }
    }
    expect(minutes).toBeLessThanOrEqual(10);
  });
});
