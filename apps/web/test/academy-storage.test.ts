import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACADEMY_STEPS } from '@astera/rules';
import { restoreAcademy, saveAcademy, clearAcademy } from '../src/onboarding/academyStorage.js';
import { openAcademy, beginAcademyOrder, beginAcademyFlight, advanceAcademy } from '../src/onboarding/academyWorld.js';

const now = 1_800_000_000_000;
const at = (id: string) => ACADEMY_STEPS.findIndex((step) => step.id === id);
describe('private Academy resume', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
  it('resumes a paid order without restarting its clock or paying twice', () => {
    const world = beginAcademyOrder(openAcademy(now, at('core')), 'core', now);
    saveAcademy(world);
    expect(restoreAcademy(now + 1000)).toEqual(world);
    const done = restoreAcademy(now + 60_000);
    expect(done.step).toBe(at('coreReward'));
    expect(done.checkpoint.buildings.CORE).toBe(2);
  });
  it('restores a flight, its losses, report and read status from authored actions', () => {
    const flight = beginAcademyFlight(openAcademy(now, at('pirate')), 'pirate', now);
    saveAcademy(flight);
    expect(restoreAcademy(now + 1000)).toEqual(flight);
    const done = advanceAcademy(flight, now + 60_000);
    done.seenSignals = [`${done.reports[0]!.id}-signal`];
    saveAcademy(done);
    expect(restoreAcademy(now + 60_000)).toEqual(done);
  });
  it('refuses malformed or foreign versions and never trusts resource snapshots', () => {
    for (const raw of ['{', JSON.stringify({ version: 900, step: 40 }), JSON.stringify({ version: 1, step: -1 })]) {
      localStorage.setItem('astera.academy.v1', raw);
      expect(restoreAcademy(now).step).toBe(0);
    }
    saveAcademy(openAcademy(now, at('darts')));
    const stored: unknown = JSON.parse(localStorage.getItem('astera.academy.v1')!);
    expect(stored).not.toHaveProperty('resources');
    expect(stored).not.toHaveProperty('checkpoint');
    clearAcademy();
    expect(restoreAcademy(now).step).toBe(0);
  });
  it('restarts checkpoints saved against the old lesson order', () => {
    saveAcademy(openAcademy(now, at('darts')));
    const saved = localStorage.getItem('astera.academy.v1');
    if (saved === null) throw new Error('Academy checkpoint was not saved');
    expect(saved).toContain('"version":2');

    localStorage.setItem('astera.academy.v1', saved.replace('"version":2', '"version":1'));
    expect(restoreAcademy(now).step).toBe(0);
  });
  it('works when accessing storage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private mode'); });
    expect(() => { saveAcademy(openAcademy(now)); }).not.toThrow();
    expect(restoreAcademy(now).step).toBe(0);
    expect(() => { clearAcademy(); }).not.toThrow();
  });
});
