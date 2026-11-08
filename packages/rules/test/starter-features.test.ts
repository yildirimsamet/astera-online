import { describe, expect, it } from 'vitest';
import {
  MAIN_GALAXY_FEATURES,
  REPAIR_LADDER,
  STARTER,
  STARTER_FEATURES,
  isFeatureOpen,
  nextLockedFeature,
  nextUnlockToAnnounce,
  openFeatures,
  openingProgress,
  partsVisible,
  type StarterFeature,
  type VesselFact,
  type VesselModule,
  type VesselProgress,
} from '../src/index.js';

const at = (modules: Partial<Record<VesselModule, number>>, more: Partial<VesselProgress> = {}): VesselProgress => ({
  ...openingProgress(), modules: { ...openingProgress().modules, ...modules }, ...more,
});
const facts = (...list: VesselFact[]) => at({}, { facts: list });

describe('what a commander can use', () => {
  it('opens only production on a new ship', () => {
    expect([...openFeatures(openingProgress())]).toEqual(['production']);
  });

  it.each<[StarterFeature, VesselProgress]>([
    ['intel', at({ SURVEY: 1 })],
    ['chat', at({ SURVEY: 2 })],
    ['fleet', at({ SHIPYARD: 1 })],
    ['salvage', facts('FIRST_MINING_RETURN')],
    ['research', at({ HANGAR: 2 })],
    ['telescope', at({ TELESCOPE: 1 })],
    ['radar', at({ RADAR: 1 })],
    ['defence', at({ AEGIS: 1 })],
    ['attack', at({ AEGIS: 1 }, { facts: ['FIRST_BATTLE_REPORT'] })],
    ['deuterium', at({ DEUTERIUM_PLANT: 1 })],
    ['migration', at({}, { fuel: STARTER.fuelForJump })],
  ])('opens %s on its own trigger', (feature, progress) => {
    expect(isFeatureOpen(openingProgress(), feature)).toBe(false);
    expect(isFeatureOpen(progress, feature)).toBe(true);
  });

  it('opens the drive panel only when the hull can be ordered', () => {
    const ready = at({ REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, SHIPYARD: 1, HANGAR: 2, TELESCOPE: 1 });
    expect(isFeatureOpen(ready, 'drive')).toBe(false);
    expect(isFeatureOpen({ ...ready, modules: { ...ready.modules, RADAR: 1 } }, 'drive')).toBe(true);
  });

  it('shows parts only to those with the drive panel open', () => {
    const ready = at({ REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, SHIPYARD: 1, HANGAR: 2, TELESCOPE: 1 });
    expect(partsVisible(ready)).toBe(false);
    expect(partsVisible({ ...ready, modules: { ...ready.modules, RADAR: 1 } })).toBe(true);
  });

  it('stops showing parts to a ship that holds all it can carry', () => {
    const hunting = at({ REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, SHIPYARD: 1, HANGAR: 2, TELESCOPE: 1, RADAR: 1 });
    expect(partsVisible({ ...hunting, parts: STARTER.parts.needed - 1 })).toBe(true);
    expect(partsVisible({ ...hunting, parts: STARTER.parts.needed })).toBe(false);
  });

  it('never opens more than one system on one repair', () => {
    const triggers = (step: { module: VesselModule; stage: number }) => {
      const before = at({ [step.module]: step.stage - 1 });
      const after = at({ [step.module]: step.stage });
      return [...openFeatures(after)].filter(f => !openFeatures(before).has(f));
    };
    for (const step of REPAIR_LADDER) expect(triggers(step).length, `${step.module} ${String(step.stage)}`).toBeLessThanOrEqual(1);
  });

  it('has the battle report and defence open before the first raid, and attack shut until the report', () => {
    const shielded = at({ AEGIS: 1 });
    expect(isFeatureOpen(shielded, 'defence')).toBe(true);
    expect(isFeatureOpen(shielded, 'attack')).toBe(false);
  });

  /**
   * OWNER 2026-11-08 (N2): an outpost is fought with the shipyard's first ships, and its report is a
   * battle report like any other. Striking another ship still asks for the attacker's own shield, since
   * the shield is what lets a ship be struck back.
   */
  it('keeps attacking ships shut to a ship that won its battle without a shield', () => {
    const victor = at({ SHIPYARD: 1 }, { facts: ['FIRST_BATTLE_REPORT'] });
    expect(isFeatureOpen(victor, 'fleet')).toBe(true);
    expect(isFeatureOpen(victor, 'attack')).toBe(false);
    expect(isFeatureOpen({ ...victor, modules: { ...victor.modules, AEGIS: 1 } }, 'attack')).toBe(true);
  });

  it('keeps the main galaxy\'s systems out, whatever is repaired', () => {
    const everything = at(
      Object.fromEntries(REPAIR_LADDER.map(s => [s.module, s.stage])),
      { facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'], parts: 3, fuel: STARTER.fuelForJump },
    );
    const open: ReadonlySet<string> = openFeatures(everything);
    expect(open.size).toBe(STARTER_FEATURES.length);
    for (const closed of MAIN_GALAXY_FEATURES) expect(open.has(closed), closed).toBe(false);
    expect(MAIN_GALAXY_FEATURES).toEqual(expect.arrayContaining(['clan', 'dominion', 'honor', 'colony', 'rankings', 'directMessages', 'store']));
  });
});

describe('what the screen says next', () => {
  it('shows one lock at a time', () => {
    expect(nextLockedFeature(openingProgress())).toBe('intel');
    expect(nextLockedFeature(at({ SURVEY: 1 }))).toBe('fleet');
  });

  it('has nothing to say when all is open', () => {
    const everything = at(
      Object.fromEntries(REPAIR_LADDER.map(s => [s.module, s.stage])),
      { facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'], fuel: STARTER.fuelForJump },
    );
    expect(nextLockedFeature(everything)).toBeNull();
  });

  it('announces one opening at a time, even when several opened while away', () => {
    const progress = at({ SURVEY: 2, SHIPYARD: 1 });
    expect(nextUnlockToAnnounce(progress, [])).toBe('production');
    expect(nextUnlockToAnnounce(progress, ['production'])).toBe('intel');
    expect(nextUnlockToAnnounce(progress, ['production', 'intel'])).toBe('fleet');
    expect(nextUnlockToAnnounce(progress, ['production', 'intel', 'fleet'])).toBe('chat');
    expect(nextUnlockToAnnounce(progress, ['production', 'intel', 'fleet', 'chat'])).toBeNull();
  });
});
