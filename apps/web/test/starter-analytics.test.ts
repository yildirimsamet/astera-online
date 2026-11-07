import { beforeEach, describe, expect, it } from 'vitest';
import { ANALYTICS_NAMES, analyticsPropertiesSchema } from '../src/api/analyticsSchemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { announceVessel, firstTimeOnly, vesselMilestones } from '../src/starter/vesselAnalytics.js';
import { wireVessel } from './starterVesselFixture.js';

const ship = (over: object = {}) => vesselSchema.parse(wireVessel(over));
const names = (events: readonly { name: string }[]) => events.map(event => event.name);

beforeEach(() => { localStorage.clear(); });

describe('what a ship tells the funnel', () => {
  it('counts every name it uses, in the shape the server accepts', () => {
    const events = vesselMilestones(null, ship());
    for (const event of events) {
      expect(ANALYTICS_NAMES).toContain(event.name);
      expect(analyticsPropertiesSchema.safeParse(event.properties).success).toBe(true);
    }
    for (const name of ['vessel_enlisted', 'vessel_step_completed', 'vessel_feature_opened', 'vessel_first_probe_sent', 'vessel_first_probe_received', 'vessel_first_mine', 'vessel_first_battle', 'vessel_first_pvp', 'vessel_part_found', 'vessel_migration_started', 'vessel_migration_landed']) {
      expect(ANALYTICS_NAMES).toContain(name);
    }
  });

  it('says a ship was enlisted once, the first time this device sees it', () => {
    expect(names(vesselMilestones(null, ship()))).toEqual(['vessel_enlisted']);
  });

  it('sees what finished while the player was away', () => {
    const before = ship();
    const after = ship({ modules: { REFINERY: 2 }, facts: ['FIRST_MINING_RETURN'], parts: 1 });
    const events = vesselMilestones({ modules: before.modules, facts: before.facts, parts: before.parts, features: before.features }, after);
    expect(events).toContainEqual({ name: 'vessel_step_completed', properties: { subject: 'REFINERY', value: 2 } });
    expect(names(events)).toContain('vessel_first_mine');
    expect(events).toContainEqual({ name: 'vessel_part_found', properties: { count: 1 } });
  });

  it('says nothing when nothing changed', () => {
    const same = ship();
    expect(vesselMilestones({ modules: same.modules, facts: same.facts, parts: same.parts, features: same.features }, same)).toEqual([]);
  });

  it('tells a reloaded page nothing new', () => {
    const sent: string[] = [];
    const observe = (name: string) => { sent.push(name); };
    announceVessel(ship(), observe);
    announceVessel(ship(), observe);
    expect(sent).toEqual(['vessel_enlisted']);
  });

  it('keeps a first time first, on this device', () => {
    const sent: string[] = [];
    firstTimeOnly('ship-1', 'vessel_first_probe_sent', (name) => { sent.push(name); });
    firstTimeOnly('ship-1', 'vessel_first_probe_sent', (name) => { sent.push(name); });
    expect(sent).toEqual(['vessel_first_probe_sent']);
  });
});
