import { describe,expect,it } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import type { TutorialAnswer, TutorialLineId } from '../src/starter/tutorial/script.js';
import { sightLesson, lessonContact, sightNow } from '../src/starter/tutorial/sightLesson.js';
const answer=(id:TutorialLineId):TutorialAnswer=>({kind:'step',id,step:'read',chapter:7,strict:false,marks:[]});
const contact=(id:string,kind:Contact['kind'],x=0):Contact=>({id,kind,from:{x,y:0,z:0},to:{x:x+10,y:0,z:0},startAt:new Date(),endAt:new Date(Date.now()+5000)});
describe('a sight lesson shows only the live world the caller earned',()=>{
 it('draws the instrument being introduced, and leaves page navigation alone',()=>{
  expect(sightLesson(answer('telescopeRing'))).toBe('telescope');
  expect(sightLesson(answer('telescopeLook'))).toBe('telescope');
  expect(sightLesson(answer('radarContact'))).toBe('radar');
  // The Prospector goes out inside the ring that showed its rock (N12).
  expect(sightLesson(answer('mine'))).toBe('telescope');
  expect(sightLesson({kind:'step',id:'telescopeRing',step:'press',chapter:7,strict:false,marks:[],nav:'closePage'})).toBeNull();
  expect(sightLesson({kind:'advise'})).toBeNull();
 });
 it('points at real identified traffic and at a real anonymous radar return, never inventing a craft',()=>{
  const contacts=[contact('u','unknown',500),contact('seen','probe',100),contact('left','probe',800)];
  const sensor={at:{x:0,y:0,z:0},identify:450,detect:600};
  expect(lessonContact('telescopeTraffic',contacts,sensor)?.id).toBe('seen');
  expect(lessonContact('telescopeTrack',contacts,sensor)?.id).toBe('left');
  expect(lessonContact('radarContact',contacts,sensor)?.id).toBe('u');
  expect(lessonContact('radarContact',[contact('known','probe')],sensor)).toBeUndefined();
 });
 it('draws the same craft the ring and the closing line talk about',()=>{
  const contacts=[contact('u','unknown',500),contact('seen','probe',100)];
  const sensor={at:{x:0,y:0,z:0},identify:450,detect:600};
  expect(lessonContact('telescopeRing',contacts,sensor)?.id).toBe('seen');
  // The ring is looked at first: the craft is marked only once that step is passed (owner 2026-11-08).
  expect(lessonContact('telescopeLook',contacts,sensor)).toBeUndefined();
  expect(lessonContact('radarRing',contacts,sensor)?.id).toBe('u');
  expect(lessonContact('sightTrio',contacts,sensor)?.id).toBe('seen');
 });
 // F6: what the live sky holds for a lesson, so each one waits for its own subject.
 it('says what is in sight: traffic in the ring, a track kept outside it, a radar question mark',()=>{
  const sensor={at:{x:0,y:0,z:0},identify:450,detect:600};
  expect(sightNow([],sensor)).toEqual({traffic:false,tracked:false,unknown:false});
  expect(sightNow([contact('seen','probe',100)],sensor)).toEqual({traffic:true,tracked:false,unknown:false});
  expect(sightNow([contact('left','fleet',800)],sensor)).toEqual({traffic:false,tracked:true,unknown:false});
  expect(sightNow([contact('u','unknown',500)],sensor)).toEqual({traffic:false,tracked:false,unknown:true});
  // A public effect is not a contact, and there is nothing in sight without a sensor post.
  expect(sightNow([{...contact('fx','fleet',100),effectOnly:true}],sensor).traffic).toBe(false);
  expect(sightNow([contact('seen','probe',100)],undefined)).toEqual({traffic:false,tracked:false,unknown:false});
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
