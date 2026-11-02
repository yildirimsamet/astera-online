import { describe, expect, it } from 'vitest';
import { createSchool, schoolAction, tickSchool, schoolScene } from '../src/onboarding/flightSchool/world.js';
import { restoreSchool, saveSchool, type SchoolRecord } from '../src/onboarding/flightSchool/storage.js';

describe('training recovery', () => {
  const start = 1_800_000_000_000;
  it('reconstructs pending work and stops at the unread result after a reload', () => {
    const events: SchoolRecord['events'] = [
      { at: start, action: { kind: 'home' } }, { at: start + 1, action: { kind: 'continue' } },
      { at: start + 2, action: { kind: 'collect' } },
      { at: start + 3, action: { kind: 'order', subject: 'CORE', count: 1 } },
    ];
    saveSchool({ version: 1, startedAt: start, events });
    const restored = restoreSchool(start + 30_000);
    expect(restored.world.scene).toBe('coreResult');
    expect(restored.world.buildings.CORE).toBe(2);
    expect(restored.world.pending).toBeNull();
  });
  it('refuses forged outcomes and future or invalid action histories', () => {
    localStorage.setItem('astera.flight-school.v1', JSON.stringify({ version: 1, startedAt: start, fleet: { DART: 99999 }, events: [] }));
    expect(restoreSchool(start).world).toEqual(createSchool(start));
    saveSchool({ version: 1, startedAt: start, events: [{ at: start + 99, action: { kind: 'order', subject: 'DART', count: 9999 } }] });
    expect(restoreSchool(start + 100).world.scene).toBe('welcome');
  });
  it('does not complete orders twice', () => {
    const w = { ...createSchool(start), scene: 'core' as const };
    const done = tickSchool(schoolAction(w, { kind: 'order', subject: 'CORE', count: 1 }, start), start + 3000);
    expect(tickSchool(done, start + 99_000).buildings.CORE).toBe(2);
  });
  it('restores the fractional milliseconds produced by the corrected server clock', () => {
    saveSchool({ version: 1, startedAt: start + 0.125, events: [{ at: start + 0.25, action: { kind: 'home' } }] });
    expect(restoreSchool(start + 10).world.scene).toBe('resources');
  });
});

it('preserves an existing playthrough when the new fleet close-up is inserted before watch', () => {
  const at = 1_800_000_000_000;
  let w = createSchool(at), now = at;
  const events: SchoolRecord['events'] = [];
  while (w.scene !== 'range') {
    const scene = schoolScene(w), kind = scene.kind;
    const action = kind === 'order' ? { kind, subject: scene.subject!, count: scene.count ?? 1 }
      : kind === 'read' || kind === 'report' || kind === 'range' ? { kind: 'continue' as const } : { kind };
    if (w.scene !== 'traffic') events.push({ action, at: now });
    w = schoolAction(w, action, now);
    now = w.pending?.finishesAt.getTime() ?? now + 1;
    w = tickSchool(w, now);
  }
  saveSchool({ version: 1, startedAt: at, events });
  expect(restoreSchool(now).world.scene).toBe('range');
});

it('replays the unread Telescope reveal after returning to the exercise later', () => {
 const at=1_800_000_000_000;
 let w=createSchool(at),now=at;
 const events: SchoolRecord['events']=[];
 while(w.scene!=='sight'){
  const scene=schoolScene(w),kind=scene.kind;
  const action=kind==='order'?{kind,subject:scene.subject!,count:scene.count??1}:kind==='read'||kind==='range'||kind==='report'?{kind:'continue' as const}:{kind};
  events.push({at:now,action});w=schoolAction(w,action,now);now=w.pending?.finishesAt.getTime()??now+1;w=tickSchool(w,now);
 }
 saveSchool({version:1,startedAt:at,events});
 const restored=restoreSchool(now+60_000).world;
 expect(restored.sceneAt).toBe(now+60_000);
 expect(restored.reach?.at).toBe(now+62_000);
});
