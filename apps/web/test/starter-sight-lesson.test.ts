import { describe,expect,it } from 'vitest';
import type { TutorialAnswer, TutorialLineId } from '../src/starter/tutorial/script.js';
import { CARD_AFTER_REVEAL_MS, REVEAL_FLEETS_MS, REVEAL_ROCKS_MS, rockMarks, rocksHeld, rockSheetStaysOpen, sightLesson, telescopeReveal } from '../src/starter/tutorial/sightLesson.js';
import { SHELL_SPREAD_SECONDS } from '../src/galaxy/SensorRings.js';
const answer=(id:TutorialLineId):TutorialAnswer=>({kind:'step',id,step:'read',chapter:7,strict:false,marks:[]});
describe('a sight lesson shows only the live world the caller earned',()=>{
 it('draws the instrument being introduced, and leaves page navigation alone',()=>{
  expect(sightLesson(answer('telescopeLook'))).toBe('telescope');
  // The radar is shown in its own scene now (item 28): no line of the guide draws it.
  expect(sightLesson(answer('farewell'))).toBeNull();
  // The Prospector goes out inside the ring that showed its rock (N12).
  expect(sightLesson(answer('findRock'))).toBe('telescope');
  expect(sightLesson(answer('mine'))).toBe('telescope');
  expect(sightLesson({kind:'step',id:'telescopeLook',step:'press',chapter:7,strict:false,marks:[],nav:'closePage'})).toBeNull();
  expect(sightLesson({kind:'advise'})).toBeNull();
 });
});

it('asks of the yard the same purse its own button does', async () => {
  const { HULLS } = await import('@astera/rules');
  const { canPayDart } = await import('../src/starter/steps.js');
  const { alloy, crystal, deuterium } = HULLS.DART;
  expect(canPayDart({ alloy, crystal, deuterium })).toBe(true);
  expect(canPayDart({ alloy: alloy - 1, crystal, deuterium })).toBe(false);
  // What waits in the works has to be collected before the button takes it.
  expect(canPayDart({ alloy: 0, crystal: 0, deuterium: 0 })).toBe(alloy === 0 && crystal === 0);
});

// Owner playtest 2026-11-08: the ring grows, a second on the rocks, a second on the two fleets.
// Walk 2026-11-08: the sheet came up folded, and the Prospector button the line named was not on it.
it('keeps a rock\'s sheet unfolded while the guide is about that rock',()=>{
 expect(rockSheetStaysOpen(answer('findRock'))).toBe(true);
 expect(rockSheetStaysOpen(answer('mine'))).toBe(true);
 expect(rockSheetStaysOpen(answer('telescopeLook'))).toBe(false);
 expect(rockSheetStaysOpen({kind:'advise'})).toBe(false);
 expect(rockSheetStaysOpen(null)).toBe(false);
});

describe('the zoom before the rock',()=>{
 it('keeps the telescope ring up',()=>{ expect(sightLesson(answer('zoomRock'))).toBe('telescope'); });
 it('shows every rock it is asking the player to come closer to',()=>{
  expect(telescopeReveal(answer('zoomRock'),0)).toEqual({rocks:true,fleets:true});
 });
 it('holds a rock tap only on that step, and only out on the galaxy',()=>{
  expect(rocksHeld(answer('zoomRock'))).toBe(true);
  expect(rocksHeld(answer('findRock'))).toBe(false);
  expect(rocksHeld({kind:'step',id:'zoomRock',step:'press',chapter:6,strict:false,marks:[],nav:'closePage'})).toBe(false);
  expect(rocksHeld(null)).toBe(false);
 });
});

// Play-test 2026-11-13: at the ring's framing a rock is a few pixels, so the reveal showed a dark field.
describe('which rocks wear a soft ring',()=>{
 it('marks the rocks the telescope brings in on its first look, and keeps them marked to the rock',()=>{
  expect(rockMarks(answer('telescopeLook'))).toBe(true);
  expect(rockMarks(answer('zoomRock'))).toBe(true);
  expect(rockMarks(answer('findRock'))).toBe(true);
 });
 it('marks none behind the note the look waits on, nor anywhere else',()=>{
  expect(rockMarks({kind:'step',id:'telescopeLook',step:'press',chapter:7,strict:false,marks:[],nav:'dismissUnlock'})).toBe(false);
  expect(rockMarks(answer('mine'))).toBe(false);
  expect(rockMarks({kind:'advise'})).toBe(false);
  expect(rockMarks(null)).toBe(false);
 });
});

describe('what the opening telescope brings into the sky, and when',()=>{
 const look=answer('telescopeLook');
 // Owner playtest 2026-11-09: the rocks are there the moment the ring has spread.
 it('brings the rocks at the very end of the ring',()=>{
  expect(REVEAL_ROCKS_MS).toBe(SHELL_SPREAD_SECONDS*1000);
 });
 it('lets the officer speak only once the rocks have landed',()=>{
  expect(CARD_AFTER_REVEAL_MS).toBeGreaterThanOrEqual(REVEAL_FLEETS_MS);
  expect(CARD_AFTER_REVEAL_MS-REVEAL_ROCKS_MS).toBeLessThanOrEqual(1600);
 });
 it('keeps both back while the ring grows',()=>{
  expect(telescopeReveal(look,REVEAL_ROCKS_MS-1)).toEqual({rocks:false,fleets:false});
 });
 it('brings the rocks, and a second later the fleets',()=>{
  expect(REVEAL_FLEETS_MS-REVEAL_ROCKS_MS).toBe(1000);
  expect(telescopeReveal(look,REVEAL_ROCKS_MS)).toEqual({rocks:true,fleets:false});
  expect(telescopeReveal(look,REVEAL_FLEETS_MS)).toEqual({rocks:true,fleets:true});
 });
 it('keeps both back behind the note or the page the look waits on',()=>{
  expect(telescopeReveal({kind:'step',id:'telescopeLook',step:'press',chapter:6,strict:false,marks:[],nav:'dismissUnlock'},60_000)).toEqual({rocks:false,fleets:false});
 });
 it('keeps the rocks back while the telescope comes in',()=>{
  expect(telescopeReveal(answer('waitTelescope'),0).rocks).toBe(false);
 });
 it('leaves every other moment of the game alone',()=>{
  expect(telescopeReveal(answer('findRock'),0)).toEqual({rocks:true,fleets:true});
  expect(telescopeReveal({kind:'advise'},0)).toEqual({rocks:true,fleets:true});
  expect(telescopeReveal(null,0)).toEqual({rocks:true,fleets:true});
 });
});
