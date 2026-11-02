import { expect, it } from 'vitest';
import { distance, sensorReach, visualLeg, worldRadius, orbitStandoff } from '@astera/rules';
import { createSchool, schoolAction, schoolGalaxy, tickSchool, SCHOOL_TARGET, type SchoolWorld } from '../src/onboarding/flightSchool/world.js';
import { schoolTraffic } from '../src/onboarding/flightSchool/api.js';
import { schoolWorldRadius } from '../src/onboarding/flightSchool/visualStory.js';
it('magnifies Telescope demonstration planets to ten times their normal radius', () => {
 expect(schoolWorldRadius(3)).toBe(worldRadius(3) * 10);
 expect(schoolWorldRadius(15)).toBe(worldRadius(15) * 10);
});
it('keeps unexplored silhouettes smaller than discovered worlds', () => {
 expect(schoolWorldRadius(3, false)).toBeLessThan(schoolWorldRadius(3, true));
 expect(schoolWorldRadius(15, false)).toBe(schoolWorldRadius(3, false));
});

it('lets each Telescope upgrade show the old boundary for two seconds before discovering more worlds', () => {
 const at=1_800_000_000_000;let now=at;
 let w:SchoolWorld={...createSchool(at),scene:'range',instruments:{...createSchool(at).instruments,TELESCOPE:1}};
 for(const level of [2,3,4,5]){
  const before=schoolGalaxy(w,now),known=before.planets.filter(p=>p.intel==='RESOLVED').length;
  w=schoolAction(w,{kind:'range',level},now);
  expect(w.reach?.at).toBe(now+2000);
  expect(schoolGalaxy(w,now+1999).sensors![0]!.identify).toBe(before.sensors![0]!.identify);
  expect(schoolGalaxy(w,now+1999).planets.filter(p=>p.intel==='RESOLVED')).toHaveLength(known);
  w=tickSchool(w,now+5000);now+=5000;
  expect(schoolGalaxy(w,now).planets.filter(p=>p.intel==='RESOLVED').length).toBeGreaterThan(known);
 }
});

it('zooms out to frame new worlds before the Telescope boundary expands', async () => {
 const { schoolTelescopeFrame, schoolFrameRange }=await import('../src/onboarding/flightSchool/visualStory.js');
 const at=1_800_000_000_000,w={...createSchool(at),scene:'range' as const,instruments:{...createSchool(at).instruments,TELESCOPE:1}};
 const before=schoolTelescopeFrame(w)!;
 const upgraded=schoolAction(w,{kind:'range',level:3},at),after=schoolTelescopeFrame(upgraded)!;
 expect(schoolFrameRange(after,at)).toBe(before.to);
 expect(schoolFrameRange(after,at+1200)).toBe(after.to);
 expect(after.to).toBeGreaterThan(before.to);
 expect(upgraded.reach!.at).toBeGreaterThan(after.at+after.duration);
});

it('fits the complete sight sphere below the coach on short and tall phones', async () => {
 const { schoolCameraFit }=await import('../src/onboarding/flightSchool/visualStory.js');
 for(const view of [{width:350,height:512,top:150,bottom:56,fov:60},{width:390,height:756,top:170,bottom:56,fov:60}]){
  const radius=45,fit=schoolCameraFit(radius,view);
  const projected=radius/Math.sqrt(fit.distance**2-radius**2)/Math.tan(view.fov*Math.PI/360)*view.height/2;
  const center=view.height/2-fit.offsetY;
  expect(center-projected).toBeGreaterThanOrEqual(view.top+15);
  expect(center+projected).toBeLessThanOrEqual(view.height-view.bottom-15);
  expect(projected*2).toBeLessThanOrEqual(view.width-31);
 }
});
it('waits two seconds before opening Telescope and reveals the neighbouring worlds during its expansion', () => {
 const at=1_800_000_000_000;
 const w={...createSchool(at),scene:'telescope' as const,uplink:true};
 const done=tickSchool(schoolAction(w,{kind:'order',subject:'TELESCOPE',count:1},at),at+3000);
 expect(schoolGalaxy(done,at+3000).sensors![0]!.telescope).toBe(false);
 expect(schoolGalaxy(done,at+4999).planets.find(p=>p.id===SCHOOL_TARGET)?.intel).toBe('UNKNOWN');
 expect(schoolGalaxy(done,at+6500).sensors![0]!.identify).toBeGreaterThan(sensorReach(0));
 expect(schoolGalaxy(done,at+8000).planets.find(p=>p.id===SCHOOL_TARGET)?.intel).toBe('RESOLVED');
});
it('shows a real Dyson-stage world and describes Lyra as a home world', () => {
 const w=createSchool(1_800_000_000_000);w.instruments.TELESCOPE=1;
 const worlds=schoolGalaxy(w).planets;
 expect(worlds.find(p=>p.id==='school-3')!.coreLevel).toBeGreaterThanOrEqual(12);
 expect(worlds.find(p=>p.id===SCHOOL_TARGET)!.kind).toBe('CAPITAL');
});
it('lets the example fleet stop outside Altair rather than fly through the world', () => {
 const at=1_800_000_000_000,w={...createSchool(at),scene:'traffic' as const};w.instruments.TELESCOPE=1;
 const first=schoolTraffic(w,at).find(c=>c.id==='school-neighbour-fleet')!;
 const later=schoolTraffic(w,at+7000).find(c=>c.id==='school-neighbour-fleet')!;
 expect(first.landing).toBe(true);
 expect(later.endAt).toEqual(first.endAt);
 expect(first.endAt.getTime()-first.startAt.getTime()).toBe(8000);
 expect(schoolTraffic(w,at+8001).some(c=>c.id==='school-neighbour-fleet')).toBe(false);
 const worlds=schoolGalaxy(w).planets;
 const from=worlds.find(p=>p.id===SCHOOL_TARGET)!, to=worlds.find(p=>p.id==='school-3')!;
 const leg=visualLeg(from.position,to.position,orbitStandoff(Math.max(worldRadius(from.coreLevel),0)),orbitStandoff(Math.max(worldRadius(to.coreLevel),0)));
 expect(first.from).toEqual(leg.from);expect(first.to).toEqual(leg.to);
 expect(distance(first.to,to.position)).toBeGreaterThan(0);
});

it('keeps the travelling ship centred while turning from its origin toward its destination', async () => {
 const { schoolTransitPose }=await import('../src/onboarding/flightSchool/visualStory.js');
 const path={from:{x:0,y:0,z:0},to:{x:1000,y:0,z:0}};
 const start=schoolTransitPose(path,0),middle=schoolTransitPose(path,.5),end=schoolTransitPose(path,1);
 expect(start.position[0]).toBeGreaterThan(start.target[0]);
 expect(end.position[0]).toBeLessThan(end.target[0]);
 expect(middle.target[0]).toBe(10);
 expect(end.target[0]).toBe(20);
});
