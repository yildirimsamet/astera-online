import { expect, it } from 'vitest';
import { capitalRoute, evaluateCalendar, playerWindows } from './economy-calendar-model.js';

it('allows the entire capital progression without preparing or owning a colony', () => {
  const actions = capitalRoute(1.5, 1, false);
  expect(actions.some(a => a.id.includes('colony'))).toBe(false);
  const r = evaluateCalendar({ ...base, start: { alloy: 1200, crystal: 400, deuterium: 80 },
    rate: { alloy: 90, crystal: 40, deuterium: 6 }, end: 14 * 1440,
    windows: playerWindows('average', 14), actions });
  expect(r.completed.T3).toBeGreaterThan(0);
  expect(r.completed.T4).toBeGreaterThan(r.completed.T3!);
});

it('keeps colony preparation optional and outside the T3 dependency chain', () => {
  const actions = capitalRoute(1.5, 1, true);
  expect(actions.some(a => a.id === 'colony-ready')).toBe(true);
  expect(actions.find(a => a.id === 'T3-research')!.requires).toEqual(['industry-5']);
  expect(actions.some(a => a.id === 'colony')).toBe(false);
});

it('waits for a dated opportunity without reserving funds for it before it opens', () => {
  const r = evaluateCalendar({ ...base, start: { alloy: 100, crystal: 0, deuterium: 0 }, end: 180,
    windows: [{ start: 0, end: 10 }, { start: 120, end: 130 }], actions: [
      { id: 'future', queue: 'construction', cost: { alloy: 100, crystal: 0, deuterium: 0 }, minutes: 5, requires: [], notBefore: 60 },
      { id: 'now', queue: 'yard', cost: { alloy: 50, crystal: 0, deuterium: 0 }, minutes: 5, requires: [] },
    ] });
  expect(r.started.now).toBe(0);
  expect(r.started.future).toBe(120);
});

it('does not purchase an expired operation later or block development behind it', () => {
  const r = evaluateCalendar({ ...base, end: 180,
    windows: [{ start: 0, end: 10 }, { start: 120, end: 130 }], actions: [
      { id: 'operation', queue: 'yard', cost: { alloy: 100, crystal: 0, deuterium: 0 }, minutes: 5, requires: [], expiresAt: 10 },
      { id: 'development', queue: 'construction', cost: { alloy: 50, crystal: 0, deuterium: 0 }, minutes: 5, requires: [] },
    ] });
  expect(r.started.operation).toBeUndefined();
  expect(r.started.development).toBe(120);
});

it('rejects circular dependencies instead of reporting them as extremely slow progression', () => {
  const a = { queue: 'research' as const, cost: { alloy: 1, crystal: 0, deuterium: 0 }, minutes: 1 };
  expect(() => evaluateCalendar({ ...base, windows: [{ start: 0, end: 10 }], actions: [
    { ...a, id: 'a', requires: ['b'] }, { ...a, id: 'b', requires: ['a'] },
  ] })).toThrow();
});

const base = { start: { alloy: 0, crystal: 0, deuterium: 0 }, rate: { alloy: 60, crystal: 30, deuterium: 6 },
  worksHours: 12, storageHours: 48, end: 1440, actions: [] };
it('produces through eleven offline hours and conserves every resource', () => {
  const r = evaluateCalendar({ ...base, end: 660, windows: [] });
  expect(r.works).toEqual({ alloy: 660, crystal: 330, deuterium: 66 });
  expect(r.produced).toEqual(r.works);
});
it('records overflow instead of inventing offline income', () => {
  const r = evaluateCalendar({ ...base, end: 780, windows: [] });
  expect(r.works.alloy).toBe(720);
  expect(r.overflow.alloy).toBe(60);
});
it('finishes construction offline and changes the production rate at completion', () => {
  const r = evaluateCalendar({ ...base, start: { alloy: 100, crystal: 0, deuterium: 0 }, end: 180,
    windows: [{ start: 0, end: 1 }], actions: [{ id: 'mine', queue: 'construction' as const,
      cost: { alloy: 100, crystal: 0, deuterium: 0 }, minutes: 60, requires: [], rateGain: { alloy: 60, crystal: 0, deuterium: 0 } }] });
  expect(r.completed.mine).toBe(60);
  expect(r.produced.alloy).toBe(300);
  expect(r.spent.alloy).toBe(100);
});
it('does not buy a dependent order while the player is offline', () => {
  const r = evaluateCalendar({ ...base, start: { alloy: 1000, crystal: 1000, deuterium: 1000 }, end: 180,
    windows: [{ start: 0, end: 1 }, { start: 120, end: 121 }], actions: [
      { id: 'a', queue: 'research' as const, cost: { alloy: 1, crystal: 1, deuterium: 1 }, minutes: 60, requires: [] },
      { id: 'b', queue: 'yard' as const, cost: { alloy: 1, crystal: 1, deuterium: 1 }, minutes: 10, requires: ['a'] },
    ] });
  expect(r.started.b).toBe(120);
  expect(r.completed.b).toBe(130);
});
it('defines waking sessions rather than spreading logins across 24 hours', () => {
  const w = playerWindows('average', 7);
  expect(w.length).toBe(26);
  expect(w.reduce((sum, x) => sum + x.end - x.start, 0)).toBe(950);
});

it('reserves for the next eligible planned investment instead of spending on later affordable work', () => {
  const r = evaluateCalendar({ ...base, start: { alloy: 50, crystal: 1000, deuterium: 1000 }, end: 65,
    windows: [{ start: 0, end: 65 }], actions: [
      { id: 'priority', queue: 'research' as const, cost: { alloy: 100, crystal: 0, deuterium: 0 }, minutes: 5, requires: [] },
      { id: 'later', queue: 'construction' as const, cost: { alloy: 50, crystal: 0, deuterium: 0 }, minutes: 5, requires: [] },
    ] });
  expect(r.started.priority).toBe(50);
  expect(r.started.later).toBeUndefined();
});

it('rejects negative time and duplicate orders rather than corrupting the resource ledger', () => {
  const action = { id: 'a', queue: 'research' as const, cost: { alloy: 1, crystal: 1, deuterium: 1 }, minutes: -1, requires: [] };
  expect(() => evaluateCalendar({ ...base, windows: [], actions: [action] })).toThrow();
  expect(() => evaluateCalendar({ ...base, windows: [], actions: [{ ...action, minutes: 1 }, { ...action, minutes: 1 }] })).toThrow();
});

it('keeps offline completions from creating extra player decisions within a session', () => {
  const r = evaluateCalendar({ ...base, start: { alloy: 1000, crystal: 1000, deuterium: 1000 }, end: 10,
    windows: [{ start: 0, end: 10 }], actions: [
      { id: 'a', queue: 'research' as const, cost: { alloy: 1, crystal: 1, deuterium: 1 }, minutes: 1, requires: [] },
      { id: 'b', queue: 'yard' as const, cost: { alloy: 1, crystal: 1, deuterium: 1 }, minutes: 1, requires: ['a'] },
    ] });
  expect(r.started.b).toBe(2);
});
