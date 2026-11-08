import { COMBAT, COMBAT_CLASSES, HULLS, STARTER, counterMult, counteredBy, fleetEntries, type CombatClass, type Fleet, type HullId } from '@astera/rules';
import type { TFunction } from 'i18next';
import type { PlanetView } from '../api/schemas.js';
import { combatClassLabel, hullLabel } from '../i18n/names.js';
import { factor } from '../lib/format.js';
import { orderMinutes } from '../lib/orderTime.js';
import { durationPrecise } from '../lib/time.js';

export interface OutpostReportFacts {
  attacking: boolean;
  opponentKind?: 'SHIP' | 'OUTPOST' | 'PIRATES' | undefined;
  yourFleet: Fleet;
  theirFleet: Fleet;
  yourLosses: Fleet;
  firstVictory?: boolean | undefined;
  beatenBy?: string | null | undefined;
}

export interface OutpostLine { key: 'beaten' | 'victoryCrate' | 'why' | 'rebuild'; tone: string; text: string }

const armed = (fleet: Fleet): [HullId, number][] => fleetEntries(fleet).filter(([hull, count]) => count > 0 && HULLS[hull].cls !== 'SUPPORT');

/** The guard's class, by its biggest part; none for an empty guard or a tie, where one name would mislead. */
function guardClass(fleet: Fleet): CombatClass | null {
  const counts = new Map<CombatClass, number>();
  for (const [hull, count] of armed(fleet)) {
    const cls = HULLS[hull].cls;
    if (cls !== 'SUPPORT') counts.set(cls, (counts.get(cls) ?? 0) + count);
  }
  const [first, second] = COMBAT_CLASSES.flatMap(cls => counts.has(cls) ? [[cls, counts.get(cls) ?? 0] as const] : []).toSorted((a, b) => b[1] - a[1]);
  return first && first[1] !== second?.[1] ? first[0] : null;
}

/** The wing's hull, by its biggest part; between equal parts, the one with the edge on this guard. */
function wingHull(fleet: Fleet, guard: CombatClass): HullId | null {
  const [best] = armed(fleet).toSorted(([a, x], [b, y]) => y - x || counterMult(HULLS[b].cls, guard) - counterMult(HULLS[a].cls, guard));
  return best?.[0] ?? null;
}

/** The starter yard's hull for a class: what "send this" names. */
const yardHull = (cls: CombatClass): HullId | undefined => STARTER.hulls.find(hull => HULLS[hull].cls === cls);

function why(facts: OutpostReportFacts, t: TFunction): string | null {
  const guard = guardClass(facts.theirFleet);
  const hull = guard ? wingHull(facts.yourFleet, guard) : null;
  if (!guard || !hull) return null;
  const mult = counterMult(HULLS[hull].cls, guard);
  const names = { ships: hullLabel(hull), guard: combatClassLabel(guard), mult: factor(mult) };
  if (mult === COMBAT.strongMult) return t('starter.reports.whyStrong', names);
  // The hull that beats this guard: the next step after an even fight or a bad one.
  const ship = yardHull(counteredBy(guard));
  if (!ship) return null;
  return t(mult === COMBAT.weakMult ? 'starter.reports.whyWeak' : 'starter.reports.whyEven', { ...names, answer: hullLabel(ship) });
}

function rebuild(facts: OutpostReportFacts, t: TFunction, view: PlanetView): string | null {
  const lost = fleetEntries(facts.yourLosses).filter(([, count]) => count > 0);
  if (lost.length === 0) return null;
  const alloy = lost.reduce((sum, [hull, count]) => sum + HULLS[hull].alloy * count, 0);
  const crystal = lost.reduce((sum, [hull, count]) => sum + HULLS[hull].crystal * count, 0);
  const minutes = lost.reduce((sum, [hull, count]) => sum + orderMinutes('HULL', HULLS[hull], view, count, { hull }), 0);
  const ships = lost.map(([hull, count]) => `${String(count)} ${hullLabel(hull)}`).join(', ');
  return t('starter.reports.rebuild', { ships, alloy, crystal, time: durationPrecise(minutes) });
}

/**
 * WHAT A RAID FROM THE SHIP TAUGHT (plan §5.6 and its outcome branches, F4f), said only to the side that
 * came: who took the guard first when someone did, that the first win's crate waits, why the fight went
 * as it did in the counter cycle's words, and what the lost ships cost at the yard. Each one only when true.
 */
export function outpostReportLines(facts: OutpostReportFacts, t: TFunction, view: PlanetView): OutpostLine[] {
  if (!facts.attacking || facts.opponentKind === undefined) return [];
  const said = [
    { key: 'beaten', tone: 'text-v2-warn', text: facts.beatenBy ? t('starter.reports.beatenBy', { name: facts.beatenBy }) : null },
    { key: 'victoryCrate', tone: 'text-v2-self', text: facts.firstVictory === true ? t('starter.reports.firstVictory') : null },
    { key: 'why', tone: 'text-v2-ink', text: why(facts, t) },
    { key: 'rebuild', tone: 'text-v2-alloy', text: rebuild(facts, t, view) },
  ] as const;
  return said.flatMap(line => line.text === null ? [] : [{ key: line.key, tone: line.tone, text: line.text }]);
}
