import type { BuildingId, HullId, InstrumentId, SatelliteId } from '@astera/rules';
import type { PlanetGroup } from '../../lib/directives.js';

type OrderSubject = BuildingId | HullId | InstrumentId | SatelliteId;
interface Scene {
  id: string;
  chapter: number;
  kind: 'read' | 'home' | 'collect' | 'order' | 'mine' | 'probe' | 'raid' | 'defend' | 'report' | 'watch' | 'range';
  subject?: OrderSubject;
  count?: number;
  group?: PlanetGroup;
}

/** Authoring order is also the recovery order. A completed action leads to a
 * stable result scene; reading speed never advances a lesson. */
export const SCHOOL_SCENES = [
  { id: 'welcome', chapter: 1, kind: 'home' },
  { id: 'resources', chapter: 2, kind: 'read', group: 'grow' },
  { id: 'collect', chapter: 2, kind: 'collect', group: 'grow' },
  { id: 'core', chapter: 3, kind: 'order', subject: 'CORE', group: 'grow' },
  { id: 'coreResult', chapter: 3, kind: 'read', group: 'grow' },
  { id: 'refinery', chapter: 3, kind: 'order', subject: 'REFINERY', group: 'grow' },
  { id: 'extractor', chapter: 3, kind: 'order', subject: 'EXTRACTOR', group: 'grow' },
  { id: 'production', chapter: 3, kind: 'read', group: 'grow' },
  { id: 'uplink', chapter: 4, kind: 'order', subject: 'UPLINK', group: 'orbit' },
  { id: 'telescope', chapter: 4, kind: 'order', subject: 'TELESCOPE', group: 'orbit' },
  { id: 'sight', chapter: 4, kind: 'read' },
  { id: 'sightWorlds', chapter: 4, kind: 'read' },
  { id: 'sightCompare', chapter: 4, kind: 'read' },
  { id: 'traffic', chapter: 4, kind: 'read' },
  { id: 'watch', chapter: 4, kind: 'watch' },
  { id: 'range', chapter: 4, kind: 'range' },
  { id: 'shipyard', chapter: 5, kind: 'order', subject: 'SHIPYARD', group: 'reach' },
  { id: 'miner', chapter: 5, kind: 'order', subject: 'PROSPECTOR', group: 'reach' },
  { id: 'mine', chapter: 5, kind: 'mine' },
  { id: 'mineResult', chapter: 5, kind: 'read', group: 'grow' },
  { id: 'collectOre', chapter: 5, kind: 'collect', group: 'grow' },
  { id: 'probe', chapter: 6, kind: 'probe' },
  { id: 'probeReport', chapter: 6, kind: 'read' },
  { id: 'hangar', chapter: 7, kind: 'order', subject: 'HANGAR', group: 'reach' },
  { id: 'darts', chapter: 7, kind: 'order', subject: 'DART', count: 30, group: 'reach' },
  { id: 'couriers', chapter: 7, kind: 'order', subject: 'COURIER', count: 2, group: 'reach' },
  { id: 'raid', chapter: 8, kind: 'raid' },
  { id: 'raidReport', chapter: 8, kind: 'report' },
  { id: 'incoming', chapter: 9, kind: 'read' },
  { id: 'radar', chapter: 9, kind: 'order', subject: 'RADAR', group: 'orbit' },
  { id: 'warning', chapter: 9, kind: 'read' },
  { id: 'aegis', chapter: 10, kind: 'order', subject: 'AEGIS', group: 'defend' },
  { id: 'shield', chapter: 10, kind: 'read' },
  { id: 'guns', chapter: 10, kind: 'order', subject: 'THORN', count: 4, group: 'defend' },
  { id: 'defend', chapter: 10, kind: 'defend' },
  { id: 'defenseReport', chapter: 10, kind: 'report' },
  { id: 'departure', chapter: 11, kind: 'read' },
] as const satisfies readonly Scene[];
export type SchoolSceneId = (typeof SCHOOL_SCENES)[number]['id'];
export type SchoolScene = Scene & { id: SchoolSceneId };
export const schoolFocusRequest = (startedAt: number, id: SchoolSceneId): number =>
  startedAt + SCHOOL_SCENES.findIndex(s => s.id === id) + 1;
export const sceneById = (id: SchoolSceneId): SchoolScene => SCHOOL_SCENES.find(s => s.id === id)!;
export const nextSchoolScene = (id: SchoolSceneId): SchoolSceneId =>
  SCHOOL_SCENES[Math.min(SCHOOL_SCENES.length - 1, SCHOOL_SCENES.findIndex(s => s.id === id) + 1)]!.id;
