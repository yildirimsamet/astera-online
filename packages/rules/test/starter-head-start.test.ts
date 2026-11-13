import { describe, expect, it } from 'vitest';
import { REPAIR_LADDER, headStartProgress, jumpWindowOpen, moduleStage, openingProgress, type VesselProgress } from '../src/index.js';

/**
 * A NEIGHBOUR WHO CAME EARLIER (owner 2026-11-13, plan §10.7 item 7). A new crew stands somewhere along
 * the required repairs, as a person who arrived hours ago would. The die has one face per place on that
 * road, so no place is likelier than another: when the road shrank to six, three faces of the old die
 * fell on "all done" and a third of new neighbours arrived with the first loop's repairs behind them.
 */
const required = REPAIR_LADDER.filter(step => step.required);
const behind = (progress: VesselProgress) => required.filter(step => moduleStage(progress, step.module) >= step.stage).length;

describe('where a new neighbour starts', () => {
  it('starts from the opening state on the lowest roll', () => {
    expect(headStartProgress(0)).toEqual(openingProgress());
  });

  it('makes every place on the required road as likely as another, from none to all', () => {
    const faces = required.length + 1;
    const rolls = faces * 1000;
    const counts = new Array<number>(faces).fill(0);
    for (let i = 0; i < rolls; i++) counts[behind(headStartProgress((i + 0.5) / rolls))]! += 1;
    expect(counts).toEqual(new Array<number>(faces).fill(1000));
  });

  it('never opens the jump window: the first dig home and the first report are the crew\'s own to make', () => {
    const top = headStartProgress(0.999_999);
    expect(behind(top)).toBe(required.length);
    expect(jumpWindowOpen(top)).toBe(false);
  });
});
