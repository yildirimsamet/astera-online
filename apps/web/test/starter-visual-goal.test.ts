import { openingProgress, REPAIR_LADDER } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { tutorialAction, tutorialStep, type TutorialInput } from '../src/starter/tutorial/script.js';
import { repairGainIcon } from '../src/starter/steps.js';
const input = (over: Partial<TutorialInput> = {}): TutorialInput => ({ modules: openingProgress().modules, facts: [], queue: [], unlockToAnnounce: null, works: 0, canPayNext: true, probing: false, mining: false, crates: [], view: 'ship', acked: [], ...over });
describe('the same road with or without the officer', () => {
  it('passes spoken lines and keeps the next real repair', () => {
    expect(tutorialAction(input())).toEqual(tutorialStep(input({acked:['lookAround','welcome','online','collect']})));
    expect(tutorialAction(input())).toMatchObject({id:'orderRefinery'});
    expect(tutorialAction(input({ queue: [{ subject: 'REFINERY', stage: 2 }] }))).toMatchObject({ id: 'orderExtractor' });
  });
  it('keeps a wait a wait on any page, then shows the ready crate', () => {
    expect(tutorialAction(input({ queue: [{ subject: 'REFINERY', stage: 2 }, { subject: 'EXTRACTOR', stage: 1 }], view: 'other' }))).toMatchObject({ step: 'wait' });
    expect(tutorialAction(input({ modules: { REFINERY: 2, EXTRACTOR: 1 }, crates: [{ id: 'REFINERY:2', state: 'ready' }] }))).toMatchObject({ id: 'firstCrate' });
  });
  it('points at the next shipyard action and then the first Prospector', () => {
    const mid = input({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1 }, facts: ['FIRST_PROBE_REPORT'], crates: [{ id:'REFINERY:3',state:'opened' }] });
    expect(tutorialAction(mid)).toMatchObject({ id: 'orderShipyard' });
    expect(tutorialAction({ ...mid, modules: {...mid.modules, SHIPYARD:1}, queue:[{subject:'EXTRACTOR',stage:3}], crates:[...mid.crates,{id:'SHIPYARD:1',state:'opened'}], view:'galaxy' })).toMatchObject({id:'mine'});
  });
  it('maps unlocked capabilities to the icons used beside their price', () => {
    for(const [module,stage,icon] of [['SHIPYARD',1,'i-fleet'],['SURVEY',1,'i-probe'],['TELESCOPE',1,'i-telescope'],['RADAR',1,'i-radar']] as const){
      const step=REPAIR_LADDER.find(s=>s.module===module&&s.stage===stage)!;
      expect(repairGainIcon(step)).toBe(icon);
    }
  });
});

it('offers the works before tab navigation when the repair needs the production buffer', () => {
  const goal=tutorialAction(input({works:100,canPayNext:true,acked:['collect']}));
  expect(goal).toMatchObject({id:'orderRefinery',marks:[expect.stringContaining('repair-order'),'[data-guide="works"]',expect.stringContaining('repair-show'),expect.stringContaining('system-')]});
});
