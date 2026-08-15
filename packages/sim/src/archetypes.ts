import type { BuildingId, SatelliteId } from '@blindspace/rules';

/**
 * Five spending policies plus a login cadence. Deliberately crude — the point is
 * to bracket real behaviour, not to imitate it.
 *
 * GRINDER is the one that matters: it is the informed player, and the design's
 * central claim is that it should top the ladder.
 */
export interface Archetype {
  readonly share: number;
  readonly loginsPerDay: number;
  readonly buildOrder: readonly BuildingId[];
  readonly sats: readonly SatelliteId[];
  /**
   * Defence value held per unit of raidable stock — insurance, bought FIRST.
   *
   * Buying defence from leftovers means it never gets bought: buildings compound,
   * so at the margin they always look like the better purchase. The first version
   * of these bots did exactly that and produced 23 Bastions across 140 planets,
   * which made 95% of attacks DECISIVE and left the fog with nothing to resolve.
   */
  readonly defenceRatio: number;
  readonly militaryShare: number;
  readonly attackChance: number;
  readonly scouts: boolean;
}

export type ArchetypeName = 'TURTLE' | 'RAIDER' | 'FARMER' | 'CASUAL' | 'GRINDER';

export const ARCHETYPES: Record<ArchetypeName, Archetype> = {
  TURTLE: {
    share: 0.18, loginsPerDay: 4, defenceRatio: 2.2,
    buildOrder: ['REFINERY', 'EXTRACTOR', 'VAULT', 'CORE', 'RING'],
    sats: ['AEGIS', 'AEGIS', 'RADAR'],
    militaryShare: 0.35, attackChance: 0, scouts: false,
  },
  RAIDER: {
    share: 0.22, loginsPerDay: 6, defenceRatio: 0.35,
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'EXTRACTOR', 'RING'],
    sats: ['RADAR', 'TELESCOPE', 'VEIL'],
    militaryShare: 0.65, attackChance: 0.55, scouts: false,
  },
  FARMER: {
    share: 0.24, loginsPerDay: 4, defenceRatio: 1.3,
    buildOrder: ['REFINERY', 'EXTRACTOR', 'VAULT', 'CORE', 'SHIPYARD'],
    sats: ['DRILL', 'AEGIS', 'RADAR'],
    militaryShare: 0.3, attackChance: 0.12, scouts: false,
  },
  CASUAL: {
    share: 0.24, loginsPerDay: 2, defenceRatio: 0.9,
    buildOrder: ['REFINERY', 'CORE', 'EXTRACTOR', 'SHIPYARD', 'VAULT'],
    sats: ['RADAR', 'AEGIS'],
    militaryShare: 0.4, attackChance: 0.2, scouts: false,
  },
  GRINDER: {
    share: 0.12, loginsPerDay: 10, defenceRatio: 0.45,
    buildOrder: ['SHIPYARD', 'REFINERY', 'CORE', 'RING', 'EXTRACTOR'],
    sats: ['TELESCOPE', 'TELESCOPE', 'RADAR', 'VEIL'],
    militaryShare: 0.6, attackChance: 0.7, scouts: true,
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as ArchetypeName[];
