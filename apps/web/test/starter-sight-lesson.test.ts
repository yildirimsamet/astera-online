import { describe,expect,it } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import type { TutorialAnswer, TutorialLineId } from '../src/starter/tutorial/script.js';
import { REVEAL_FLEETS_MS, REVEAL_ROCKS_MS, rockSheetStaysOpen, sightLesson, lessonContact, sightNow, telescopeReveal } from '../src/starter/tutorial/sightLesson.js';
const answer=(id:TutorialLineId):TutorialAnswer=>({kind:'step',id,step:'read',chapter:7,strict:false,marks:[]});
const contact=(id:string,kind:Contact['kind'],x=0):Contact=>({id,kind,from:{x,y:0,z:0},to:{x:x+10,y:0,z:0},startAt:new Date(),endAt:new Date(Date.now()+5000)});
describe('a sight lesson shows only the live world the caller earned',()=>{
 it('draws the instrument being introduced, and leaves page navigation alone',()=>{
  expect(sightLesson(answer('telescopeLook'))).toBe('telescope');
  expect(sightLesson(answer('radarContact'))).toBe('radar');
  // The Prospector goes out inside the ring that showed its rock (N12).
  expect(sightLesson(answer('findRock'))).toBe('telescope');
  expect(sightLesson(answer('mine'))).toBe('telescope');
  expect(sightLesson({kind:'step',id:'telescopeLook',step:'press',chapter:7,strict:false,marks:[],nav:'closePage'})).toBeNull();
  expect(sightLesson({kind:'advise'})).toBeNull();
 });
 it('points at real identified traffic and at a real anonymous radar return, never inventing a craft',()=>{
  const contacts=[contact('u','unknown',500),contact('seen','probe',100),contact('left','probe',800)];
  const sensor={at:{x:0,y:0,z:0},identify:450,detect:600};
  expect(lessonContact('sightTrio',contacts,sensor)?.id).toBe('seen');
  expect(lessonContact('radarContact',contacts,sensor)?.id).toBe('u');
  expect(lessonContact('radarContact',[contact('known','probe')],sensor)).toBeUndefined();
 });
 it('marks no craft while the field is looked at (owner 2026-11-08)',()=>{
  const contacts=[contact('u','unknown',500),contact('seen','probe',100)];
  const sensor={at:{x:0,y:0,z:0},identify:450,detect:600};
  expect(lessonContact('telescopeLook',contacts,sensor)).toBeUndefined();
  expect(lessonContact('radarRing',contacts,sensor)?.id).toBe('u');
 });
 // F6: what the live sky holds for a lesson, so each one waits for its own subject.
 it('says what is in sight: traffic in the ring, a radar question mark',()=>{
  const sensor={at:{x:0,y:0,z:0},identify:450,detect:600};
  expect(sightNow([],sensor)).toEqual({traffic:false,unknown:false});
  expect(sightNow([contact('seen','probe',100)],sensor)).toEqual({traffic:true,unknown:false});
  expect(sightNow([contact('left','fleet',800)],sensor)).toEqual({traffic:false,unknown:false});
  expect(sightNow([contact('u','unknown',500)],sensor)).toEqual({traffic:false,unknown:true});
  // A public effect is not a contact, and there is nothing in sight without a sensor post.
  expect(sightNow([{...contact('fx','fleet',100),effectOnly:true}],sensor).traffic).toBe(false);
  expect(sightNow([contact('seen','probe',100)],undefined)).toEqual({traffic:false,unknown:false});
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

describe('what the opening telescope brings into the sky, and when',()=>{
 const look=answer('telescopeLook');
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
