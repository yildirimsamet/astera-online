import { describe, expect, it } from 'vitest';
import { LOCAL_ALERT_LIMIT, localAlertId, planLocalAlerts, type LocalAlertInput } from '../src/lib/localAlerts.js';

/** Free queue alerts on the phone, owner 2026-10-30 (docs/bildirim-merkezi-plani-2026-10-30.md, decision 3). */
const NOW = Date.parse('2026-10-30T10:00:00Z');
const at = (minutes: number) => new Date(NOW + minutes * 60_000);
const all = { build: true, research: true, ships: true, fleet: true };

const input = (over: Partial<LocalAlertInput> = {}): LocalAlertInput => ({
  now: NOW,
  prefs: all,
  worlds: [{
    id: 'home', name: 'Earth',
    construction: [
      { id: 'c1', kind: 'BUILDING', subject: 'RADAR', finishesAt: at(10) },
      { id: 'c2', kind: 'RESEARCH', subject: 'X', finishesAt: at(20) },
      { id: 'c3', kind: 'BUILDING', subject: 'VAULT', finishesAt: at(30), pausedAt: at(1) },
      { id: 'c4', kind: 'BUILDING', subject: 'HANGAR' },
    ],
    yard: [{ id: 'y1', subject: 'DART', count: 5, finishesAt: at(15) }],
    research: [{ id: 'r1', projectId: 'ARMOR', finishesAt: at(40) }],
  }],
  pending: [
    { id: 'm1', kind: 'fleet', leg: 'return', arriveAt: at(25) },
    { id: 'm2', kind: 'fleet', leg: 'outbound', arriveAt: at(5) },
    { kind: 'incoming', arriveAt: at(6) },
  ],
  ...over,
});

describe('planLocalAlerts', () => {
  it('schedules every timed, running finish in the future, soonest first', () => {
    const plan = planLocalAlerts(input());
    expect(plan.map(alert => [alert.category, alert.key])).toEqual([
      ['build', 'build:c1'], ['ships', 'ships:y1'], ['research', 'research:c2'], ['fleet', 'fleet:m1'], ['research', 'research:r1'],
    ]);
    expect(plan[0]).toMatchObject({ at: at(10).getTime(), world: 'Earth', subject: 'RADAR' });
  });

  it('skips paused and staged orders, outbound legs and anything inbound', () => {
    const keys = planLocalAlerts(input()).map(alert => alert.key);
    expect(keys).not.toContain('build:c3');
    expect(keys).not.toContain('build:c4');
    expect(keys.some(key => key.includes('m2'))).toBe(false);
    expect(keys).toHaveLength(5);
  });

  it('alerts once for research every world repeats', () => {
    const base = input();
    const twin = { ...base.worlds[0]!, id: 'mars', name: 'Mars', construction: [], yard: [] };
    const plan = planLocalAlerts({ ...base, worlds: [...base.worlds, twin] });
    expect(plan.filter(alert => alert.key === 'research:r1')).toHaveLength(1);
  });

  it('drops what has already finished', () => {
    const plan = planLocalAlerts(input({ now: at(16).getTime() }));
    expect(plan.map(alert => alert.key)).toEqual(['research:c2', 'fleet:m1', 'research:r1']);
  });

  it('honours each category switch', () => {
    const plan = planLocalAlerts(input({ prefs: { ...all, research: false, fleet: false } }));
    expect(plan.map(alert => alert.category)).toEqual(['build', 'ships']);
    expect(planLocalAlerts(input({ prefs: { build: false, research: false, ships: false, fleet: false } }))).toEqual([]);
  });

  it('keeps the soonest few, so the phone is never flooded', () => {
    const construction = Array.from({ length: LOCAL_ALERT_LIMIT + 10 }, (_, i) =>
      ({ id: `c${String(i)}`, kind: 'BUILDING' as const, subject: 'RADAR', finishesAt: at(100 - i) }));
    const plan = planLocalAlerts(input({ worlds: [{ id: 'home', name: 'Earth', construction, yard: [], research: [] }], pending: [] }));
    expect(plan).toHaveLength(LOCAL_ALERT_LIMIT);
    expect(plan[0]?.at).toBe(at(100 - (LOCAL_ALERT_LIMIT + 9)).getTime());
  });

  it('gives each alert a stable, positive 31-bit id from its key', () => {
    expect(localAlertId('build:c1')).toBe(localAlertId('build:c1'));
    expect(localAlertId('build:c1')).not.toBe(localAlertId('build:c2'));
    for (const key of ['a', 'build:c1', 'x'.repeat(500)]) {
      const id = localAlertId(key);
      expect(Number.isInteger(id) && id > 0 && id <= 0x7fffffff).toBe(true);
    }
  });
});

describe('localAlertText', () => {
  it('names the order and the world in the reader\'s language', async () => {
    const { default: i18n } = await import('../src/i18n/index.js');
    const { localAlertText } = await import('../src/lib/localAlertText.js');
    await i18n.changeLanguage('en');
    const base = { id: 1, key: 'k', at: 0, world: 'Earth' };
    expect(localAlertText({ ...base, category: 'build', subject: 'RADAR' })).toEqual({ title: 'Construction finished', body: 'Radar on Earth is ready.' });
    expect(localAlertText({ ...base, category: 'build', subject: 'SOMETHING_NEW' }).body).toBe('An order on Earth is finished.');
    expect(localAlertText({ ...base, category: 'ships', subject: 'DART', count: 5 }).body).toMatch(/^5 × .+ ready on Earth\.$/);
    expect(localAlertText({ ...base, category: 'fleet' })).toEqual({ title: 'Fleet back home', body: 'A fleet is back at its home world.' });
    await i18n.changeLanguage('tr');
    expect(localAlertText({ ...base, category: 'fleet' }).title).toBe('Filo eve döndü');
    await i18n.changeLanguage('en');
  });
});
