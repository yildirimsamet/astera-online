import { describe,expect,it } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import type { TutorialAnswer, TutorialLineId } from '../src/starter/tutorial/script.js';
import { sightLesson, lessonContact, sightNow } from '../src/starter/tutorial/sightLesson.js';
const answer=(id:TutorialLineId):TutorialAnswer=>({kind:'step',id,step:'read',chapter:7,strict:false,marks:[]});
const contact=(id:string,kind:Contact['kind'],x=0):Contact=>({id,kind,from:{x,y:0,z:0},to:{x:x+10,y:0,z:0},startAt:new Date(),endAt:new Date(Date.now()+5000)});
describe('a sight lesson shows only the live world the caller earned',()=>{
 it('draws the instrument being introduced, and leaves page navigation alone',()=>{
  expect(sightLesson(answer('telescopeRing'))).toBe('telescope');
  expect(sightLesson(answer('radarContact'))).toBe('radar');
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
