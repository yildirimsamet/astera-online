import {
  ALL_HULLS,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type ResearchProjectId,
  type SatelliteId,
} from '@astera/rules';
import i18n from './index.js';

/**
 * EVERY NAME A PLAYER READS, RESOLVED FROM AN ID.
 *
 * `packages/rules` owns the ids and the numbers and stays language-free — it is
 * the shared source of truth for the server and the simulator, and a translation
 * table in there would be I/O by another name (and would put the same string in
 * three places that cannot all be right at once). So the client owns the names,
 * keyed by the rules' own ids, and every surface asks for them here.
 *
 * These are functions rather than the `Record` tables they replace, because a
 * table is built once at module load and a name has to change when the language
 * does. Every caller is inside a component that renders translated text, so it is
 * already re-rendering when `languageChanged` fires.
 */

export const buildingName = (id: BuildingId): string => i18n.t(`vocabulary.building.${id}.name`);
export const buildingTag = (id: BuildingId): string => i18n.t(`vocabulary.building.${id}.tag`);
export const buildingRole = (id: BuildingId): string => i18n.t(`vocabulary.building.${id}.role`);
export const buildingDetail = (id: BuildingId): string => i18n.t(`vocabulary.building.${id}.detail`);

export const instrumentLabel = (id: InstrumentId): string =>
  i18n.t(`vocabulary.instrument.${id}.name`);
export const instrumentTag = (id: InstrumentId): string =>
  i18n.t(`vocabulary.instrument.${id}.tag`);
export const instrumentRole = (id: InstrumentId): string =>
  i18n.t(`vocabulary.instrument.${id}.role`);
export const instrumentDetail = (id: InstrumentId): string =>
  i18n.t(`vocabulary.instrument.${id}.detail`);

/**
 * The longer line on the planet screen, which differs by whether you own one.
 *
 * An instrument you do not have is sold on what it would let you do and on what
 * it costs you (an Uplink overhead); one you have is described by what it is
 * doing now. Two sentences, two keys, and the level picks between them.
 */
export const instrumentPitch = (id: InstrumentId, level: number): string =>
  i18n.t(level === 0 ? `vocabulary.instrument.${id}.roleNone` : `vocabulary.instrument.${id}.roleOwned`);

export const satelliteLabel = (id: SatelliteId): string => i18n.t(`vocabulary.satellite.${id}.name`);
export const satelliteTag = (id: SatelliteId): string => i18n.t(`vocabulary.satellite.${id}.tag`);
export const satelliteRole = (id: SatelliteId): string => i18n.t(`vocabulary.satellite.${id}.role`);
export const satelliteDetail = (id: SatelliteId): string => i18n.t(`vocabulary.satellite.${id}.detail`);
export const satelliteBlurb = (id: SatelliteId): string =>
  i18n.t(`vocabulary.satellite.${id}.blurb`);

export const hullLabel = (id: HullId): string => i18n.t(`vocabulary.hull.${id}.name`);
export const hullTag = (id: HullId): string => i18n.t(`vocabulary.hull.${id}.tag`);
export const hullRole = (id: HullId): string => i18n.t(`vocabulary.hull.${id}.role`);
export const hullPitch = (id: HullId): string => i18n.t(`vocabulary.hull.${id}.pitch`);
export const hullDetail = (id: HullId): string => i18n.t(`vocabulary.hull.${id}.detail`);

const HULL_IDS = new Set<string>(ALL_HULLS);
const INSTRUMENT_IDS = new Set<string>(['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL']);

/**
 * The same lookups, for a string that MIGHT be an id.
 *
 * Used where the id came off the wire rather than out of a typed table — an error
 * payload, a notification payload — so an unrecognised value has to fall through
 * rather than throw. Returning null lets the caller keep whatever it was given,
 * which is the honest thing to print for a hull a newer server knows about.
 */
export const hullName = (id: string): string | null => (HULL_IDS.has(id) ? hullLabel(id as HullId) : null);

export const instrumentName = (id: string): string | null =>
  INSTRUMENT_IDS.has(id) ? instrumentLabel(id as InstrumentId) : null;

/** The four things a season can hand you, announced the moment they open. */
export type Unlockable = 'TELESCOPE' | 'RADAR' | 'EXPLORER' | 'VEIL';

const UNLOCKABLE = new Set<string>(['TELESCOPE', 'RADAR', 'EXPLORER', 'VEIL']);

/**
 * An unlock's headline and body.
 *
 * The notification payload carries the server's own English pair as well, and it
 * is used verbatim when the `unlock` field names something this build has never
 * heard of — the same fallback the error catalogue uses, for the same reason.
 */
export function unlockCopy(
  unlock: string | undefined,
  fallback: { title: string; body: string },
): { title: string; body: string } {
  if (unlock === undefined || !UNLOCKABLE.has(unlock)) return fallback;
  const id = unlock as Unlockable;
  return {
    title: i18n.t(`vocabulary.unlock.${id}.title`),
    body: i18n.t(`vocabulary.unlock.${id}.body`),
  };
}

/**
 * WHAT A RESEARCH PROJECT IS CALLED, IN ONE PLACE. T12 · D141.
 *
 * `buildOrderName` had its own list of four, written when four was all there was,
 * so a queued Cargo Holds order printed the raw id `CARGO_HOLDS` on the build
 * queue. The research panel had a fifteen-entry copy table of its own. Two lists
 * for one question is how the first one falls behind.
 *
 * The key is derived from the id, so a sixteenth project is a locale entry and
 * nothing else — and a missing one is a COMPILE error, because `t()` is bound to
 * the English tree.
 */
const RESEARCH_NAME_KEY = {
  ISOTOPE_SPECTROMETRY: 'research.isotopeName',
  DENSE_FUEL_CELLS: 'research.denseName',
  GRAVITIC_CHARGES: 'research.graviticName',
  DEATH_STAR_PROTOCOL: 'research.deathStarName',
  DEUTERIUM_SYNTHESIS: 'research.synthesisName',
  YARD_AUTOMATION: 'research.yardName',
  PROSPECTOR_HOLDS: 'research.holdsName',
  CARGO_HOLDS: 'research.cargoName',
  WASP_DOCTRINE: 'research.waspDoctrineName',
  LANCE_DOCTRINE: 'research.lanceDoctrineName',
  BULWARK_DOCTRINE: 'research.bulwarkDoctrineName',
  EMPLACEMENT_DOCTRINE: 'research.groundDoctrineName',
  WEAPONS_GENERAL: 'research.generalName',
  INTERCEPTION_GRID: 'research.gridName',
  STRATEGIC_STOCKPILE: 'research.stockpileName',
} as const satisfies Record<ResearchProjectId, string>;

export const researchName = (id: ResearchProjectId): string =>
  i18n.t(RESEARCH_NAME_KEY[id]);
