import type { BuildingId, HullId, InstrumentId, SatelliteId } from '@astera/rules';

/**
 * THE READING ORDER OF EVERY LIST A PLAYER SCROLLS.
 *
 * The names, tags and roles that used to live here are gone: they are language,
 * and they now live in each language's `data.ts` under `vocabulary`, reached
 * through `i18n/names.ts`. What is left is the part that is NOT language —
 * which of the four instruments is read first, which two need an Uplink — and
 * that belongs beside the panels that lay them out.
 *
 * The rule those sentences are written to has not changed and is restated where
 * they now live: say what the thing DECIDES, not what it is. "Level ceiling for
 * everything else" tells a player why they are about to spend; "the main
 * building" tells them nothing. The TAG is the other half — two or three words
 * answering "what IS this" for someone scanning fourteen cards, with a
 * twelve-year-old as the test.
 */

export const BUILDING_ORDER: readonly BuildingId[] = [
  'CORE',
  'REFINERY',
  'EXTRACTOR',
  'VAULT',
  'SHIPYARD',
];

/**
 * INSTRUMENTS. Levelled, no slot, and there is no order between them.
 *
 * The list below is a reading order for one panel, not a tech tree. Any of them,
 * at any time, for the price on the card — except that the two that SEE need an
 * Uplink overhead first, which is the one gate in the whole system and the reason
 * the first orbit slot is a real decision.
 */
export const INSTRUMENT_ORDER: readonly InstrumentId[] = [
  'TELESCOPE',
  'RADAR',
  'AEGIS',
  'VEIL',
];

/** The two that hang off an Uplink. Everything else stands on its own. */
export const INSTRUMENT_NEEDS_UPLINK: readonly InstrumentId[] = ['TELESCOPE', 'RADAR'];

/**
 * SATELLITES. One slot each, bought once, no levels, no order. D25.
 *
 * Each changes a different number across the whole planet, so the interesting
 * question is never "which is best" — it is which two or three you can run at
 * once. The Command Core opens slots at 1, 3, 5 and 9, and four satellites against
 * four slots is not a checklist, because the fourth slot is a Core 9 planet.
 */
export const SATELLITE_ORDER: readonly SatelliteId[] = [
  'UPLINK',
  'FOUNDRY',
  'DERRICK',
  'BEACON',
];

export const HULL_ORDER: readonly HullId[] = [
  'WASP', 'LANCE', 'BULWARK', 'BREACHER', 'HAULER', 'RUNNER',
  'BASTION', 'THORN', 'PROSPECTOR',
];
