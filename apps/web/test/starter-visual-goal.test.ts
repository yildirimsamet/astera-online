import { REPAIR_LADDER } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import type { TutorialStep } from '../src/starter/tutorial/script.js';
import { goalMarks, goalRepair, starterGoal, type StarterGoalValue } from '../src/starter/tutorial/visualGoal.js';
import { repairGainIcon } from '../src/starter/steps.js';

const ladder = (module: string, stage: number) => REPAIR_LADDER.find(s => s.module === module && s.stage === stage)!;
const shield = ladder('AEGIS', 1);
const goal = (over: Partial<StarterGoalValue> = {}): StarterGoalValue =>
  ({ step: null, choice: { kind: 'collect' }, picked: false, guided: true, view: 'galaxy', ...over });
const step = (over: Partial<TutorialStep>): TutorialStep =>
  ({ kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1, strict: true, ...over });

/**
 * WHAT THE MARKS FOLLOW (plan F3, N1). While the guide asks for something, its step; after the core,
 * what the player picked from the advisor, or the advisor's first offer until they pick. The hand is
 * the guide's: it comes only for a pick, and never with the guide off.
 */
describe('what the marks follow', () => {
  it('follows the guide while it asks for a press, and leaves the hand to its card', () => {
    expect(goalMarks(goal({ step: step({}) }))).toEqual({ marks: ['[data-guide="works"]'], hand: false });
  });

  it('marks nothing while the guide reads a line or waits', () => {
    expect(goalMarks(goal({ step: step({ id: 'telescopeRing', step: 'read', marks: ['[data-guide="sight-radar"]'], strict: false }) }))).toEqual({ marks: [], hand: false });
    expect(goalMarks(goal({ step: step({ id: 'waitFirst', step: 'wait', marks: [] }) }))).toEqual({ marks: [], hand: false });
  });

  it('points the hand only at what the player picked, and only with the guide on', () => {
    expect(goalMarks(goal({ picked: true }))).toEqual({ marks: ['[data-guide="works"]'], hand: true });
    expect(goalMarks(goal({ picked: false }))).toEqual({ marks: ['[data-guide="works"]'], hand: false });
    expect(goalMarks(goal({ picked: true, guided: false }))).toEqual({ marks: ['[data-guide="works"]'], hand: false });
  });

  it('takes the way aboard for a repair chosen out on the galaxy, and the card itself aboard', () => {
    expect(goalMarks(goal({ choice: { kind: 'repair', step: shield }, picked: true }))).toEqual({ marks: ['[data-guide="dock-base"]'], hand: true });
    expect(goalMarks(goal({ choice: { kind: 'repair', step: shield }, picked: true, view: 'ship' })).marks[0]).toBe('[data-guide="repair-order"][data-step="AEGIS:1"]');
  });

  it('has nothing to press for a state the advisor only names', () => {
    expect(goalMarks(goal({ choice: { kind: 'save', step: shield, minutes: 20 }, picked: true }))).toEqual({ marks: [], hand: false });
    expect(goalMarks(goal({ choice: null }))).toEqual({ marks: [], hand: false });
  });
});

describe('the machine the ship lights', () => {
  it('is the repair the guide names while it speaks', () => {
    const order = step({ id: 'orderRefinery', marks: ['[data-guide="dock-base"]'], nav: 'openShip' });
    expect(goalRepair(goal({ step: order, choice: { kind: 'repair', step: shield } }))).toMatchObject({ module: 'REFINERY', stage: 2 });
  });

  it('is none while the guide speaks of something else, whatever was chosen', () => {
    expect(goalRepair(goal({ step: step({ id: 'firstCrate', marks: ['[data-guide="crate"]'], strict: false }), choice: { kind: 'repair', step: shield } }))).toBeUndefined();
  });

  it('is the repair chosen, or the one being saved for, once the guide is quiet', () => {
    expect(goalRepair(goal({ choice: { kind: 'repair', step: shield } }))).toMatchObject({ module: 'AEGIS' });
    expect(goalRepair(goal({ choice: { kind: 'save', step: shield, minutes: 20 } }))).toMatchObject({ module: 'AEGIS' });
    expect(goalRepair(goal())).toBeUndefined();
  });
});

describe('the goal the shell hands down', () => {
  const tutorial = { answer: step({}), offers: [{ kind: 'repair', step: shield }, { kind: 'collect' }] as const, view: 'ship' as const };

  it('carries the guide only while the guide is on', () => {
    expect(starterGoal(tutorial, true).step).toMatchObject({ id: 'collect' });
    expect(starterGoal(tutorial, false).step).toBeNull();
  });

  it('follows the pick, else the first offer', () => {
    expect(starterGoal(tutorial, false)).toMatchObject({ choice: { kind: 'repair' }, picked: false, view: 'ship' });
    expect(starterGoal({ ...tutorial, pick: { kind: 'collect' } }, false)).toMatchObject({ choice: { kind: 'collect' }, picked: true });
  });
});

it('maps unlocked capabilities to the icons used beside their price', () => {
  for (const [module, stage, icon] of [['SHIPYARD', 1, 'i-fleet'], ['SURVEY', 1, 'i-probe'], ['TELESCOPE', 1, 'i-telescope'], ['RADAR', 1, 'i-radar']] as const) {
    expect(repairGainIcon(ladder(module, stage))).toBe(icon);
  }
});
