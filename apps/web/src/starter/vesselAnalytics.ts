import { VESSEL_MODULES, type VesselFact } from '@astera/rules';
import type { AnalyticsName, AnalyticsProperties } from '../api/analyticsSchemas.js';
import { vesselSchema, type VesselView } from '../api/starterSchemas.js';
import { observe } from '../lib/playerAnalytics/runtime.js';

type Snapshot = Pick<VesselView, 'modules' | 'facts' | 'parts' | 'features'>;
type Observed = (name: AnalyticsName, properties?: AnalyticsProperties) => void;

const FACT_EVENT: Readonly<Record<VesselFact, AnalyticsName>> = {
  FIRST_PROBE_REPORT: 'vessel_first_probe_received',
  FIRST_MINING_RETURN: 'vessel_first_mine',
  FIRST_BATTLE_REPORT: 'vessel_first_battle',
  FIRST_OUTPOST_VICTORY: 'vessel_first_victory',
};

/**
 * THE DIFFERENCE BETWEEN TWO LOOKS AT A SHIP, which is how a repair finished overnight still gets
 * counted: most of them end with nobody watching. A device's first look only says the ship exists.
 */
export function vesselMilestones(before: Snapshot | null, ship: Snapshot): { name: AnalyticsName; properties: AnalyticsProperties }[] {
  if (!before) return [{ name: 'vessel_enlisted', properties: {} }];
  const events: { name: AnalyticsName; properties: AnalyticsProperties }[] = [];
  for (const module of VESSEL_MODULES) {
    const stage = ship.modules[module] ?? 0;
    if (stage > (before.modules[module] ?? 0)) events.push({ name: 'vessel_step_completed', properties: { subject: module, value: stage } });
  }
  for (const feature of ship.features) {
    if (!before.features.includes(feature)) events.push({ name: 'vessel_feature_opened', properties: { subject: feature } });
  }
  for (const fact of ship.facts) {
    if (!before.facts.includes(fact)) events.push({ name: FACT_EVENT[fact], properties: {} });
  }
  if (ship.parts > before.parts) events.push({ name: 'vessel_part_found', properties: { count: ship.parts } });
  return events;
}

const store = (id: string) => `astera.vessel-seen.${id}`;

const tryJson = (text: string): unknown => { try { return JSON.parse(text); } catch { return null; } };

/** What this device wrote, read back as anything else may have written it. */
const snapshotSchema = vesselSchema.pick({ modules: true, facts: true, parts: true, features: true });

const parsed = (text: string | null): Snapshot | null => {
  if (!text) return null;
  const read = snapshotSchema.safeParse(tryJson(text));
  return read.success ? read.data : null;
};

export function announceVessel(ship: Snapshot & { id?: string }, send: Observed): void {
  const key = store(ship.id ?? 'ship');
  try {
    for (const event of vesselMilestones(parsed(localStorage.getItem(key)), ship)) send(event.name, event.properties);
    localStorage.setItem(key, JSON.stringify({ modules: ship.modules, facts: ship.facts, parts: ship.parts, features: ship.features }));
  } catch {
    // With no storage nothing can be told apart from a reload, so nothing is told.
  }
}

/** The moments no row records: sent once from each device. */
export function firstTimeOnly(vesselId: string, name: AnalyticsName, send: Observed = (event) => { observe(event, {}, 'live'); }): void {
  const key = `astera.vessel-first.${vesselId}.${name}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    send(name);
  } catch {
    // As above.
  }
}
