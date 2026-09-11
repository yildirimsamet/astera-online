/** Bounded target-derived candidate study. Normal mining/PvP are not invented as isolated income. */
import { ALL_HULLS } from '../packages/rules/src/index.js';
import type { ActivityProfile } from '../packages/sim/src/player-calendar.js';
import { costedScenario } from './costed-progression-study.js';
import { designHull } from './economy-design-model.js';

export function designScenario(profile: ActivityProfile, days: number) {
  const s = costedScenario(profile, days);
  s.world!.initial.design = { seasonDays: days };
  s.developmentReserveHours = 3;
  s.roster = Object.fromEntries(ALL_HULLS.map(id => [id, designHull(id)]));
  s.bulk = Object.fromEntries(ALL_HULLS.map(id => [id, designHull(id).bulk]));
  const removed = s.development.filter(a => {
    const o = s.world!.orders[a.id]!;
    return ('building' in o && o.building === 'DEUTERIUM_PLANT' && o.level > 3)
      || ('research' in o && o.research === 'DEUTERIUM_SYNTHESIS' && o.level > 1);
  }).map(a => a.id);
  s.development = s.development.filter(a => !removed.includes(a.id));
  for (const id of removed) Reflect.deleteProperty(s.world!.orders, id);
  for (let level = 13; level <= 20; level++) {
    for (const building of ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT'] as const) {
      const id = `building:${building}:${level}`;
      s.world!.orders[id] = { building, level };
      s.development.push({ id, queue: 'construction', minutes: 1, requires: [],
        cost: { alloy: 0, crystal: 0, deuterium: 0 } });
    }
  }
  return s;
}
