import { fleetValue, type Fleet } from '@astera/rules';
import type { GalaxyRecord } from '../db/schema.js';
import { dominionScore } from './dominion.js';

interface RankedCommander {
  playerId: string;
  commanderName: string;
  taken: number;
  lost: number;
}

interface RankedClan {
  id: string;
  name: string;
  tag: string;
  taken: number;
  lost: number;
}

interface RecordBattle {
  id: string;
  missionId: string | null;
  seasonId: string;
  targetKind: 'PLAYER' | 'NEUTRAL' | 'PIRATE';
  attackerPlayerId: string;
  defenderPlayerId: string | null;
  targetPlanetId: string | null;
  attackerLosses: Fleet;
  defenderLosses: Fleet;
  dominionSwing: number | null;
  createdAt: Date;
}

interface RecordEvent {
  seasonId: string;
  kind: string;
  refId: string;
  subjectPlanetId: string | null;
  payload?: unknown;
}

const CONFLICT_EVENT_KINDS: ReadonlySet<string> = new Set([
  'bombardment',
  'control_transfer',
  'death_star_impact',
  'neutral_claim',
  'strategic_intercept',
]);

interface RecordWorld {
  id: string;
  name: string;
}

/** Reduce volatile season facts into the small public record that survives the wipe. */
export function buildGalaxyRecord(input: {
  seasonId: string;
  ranked: readonly RankedCommander[];
  rankedClans: readonly RankedClan[];
  reports: readonly RecordBattle[];
  events: readonly RecordEvent[];
  worlds: readonly RecordWorld[];
}): GalaxyRecord {
  const commanderIds = new Set(input.ranked.map((row) => row.playerId));
  const commanderName = new Map(input.ranked.map((row) => [row.playerId, row.commanderName]));
  const worldName = new Map(input.worlds.map((world) => [world.id, world.name]));
  const battles = input.reports.filter((report) => (
    report.seasonId === input.seasonId
    && report.targetKind === 'PLAYER'
    && report.defenderPlayerId !== null
    && report.targetPlanetId !== null
    && commanderIds.has(report.attackerPlayerId)
    && commanderIds.has(report.defenderPlayerId)
  ));

  let biggest: RecordBattle | null = null;
  let biggestValue = -1;
  let sharpest: RecordBattle | null = null;
  for (const battle of battles) {
    const lossValue = fleetValue(battle.attackerLosses) + fleetValue(battle.defenderLosses);
    if (lossValue > biggestValue
      || (lossValue === biggestValue && battle.id.localeCompare(biggest?.id ?? '') < 0)) {
      biggest = battle;
      biggestValue = lossValue;
    }
    if (battle.dominionSwing !== null && (
      sharpest === null
      || Math.abs(battle.dominionSwing) > Math.abs(sharpest.dominionSwing ?? 0)
      || (
        Math.abs(battle.dominionSwing) === Math.abs(sharpest.dominionSwing ?? 0)
        && battle.id.localeCompare(sharpest.id) < 0
      )
    )) sharpest = battle;
  }

  const conflictRefs = new Map<string, Set<string>>();
  const countConflict = (worldId: string, refId: string): void => {
    const refs = conflictRefs.get(worldId) ?? new Set<string>();
    refs.add(refId);
    conflictRefs.set(worldId, refs);
  };
  for (const battle of battles) {
    const id = battle.targetPlanetId;
    if (id !== null && worldName.has(id)) countConflict(id, battle.missionId ?? `report:${battle.id}`);
  }
  for (const event of input.events) {
    if (event.seasonId !== input.seasonId || event.subjectPlanetId === null
      || !CONFLICT_EVENT_KINDS.has(event.kind)) continue;
    if (!worldName.has(event.subjectPlanetId)
      && event.payload !== null
      && typeof event.payload === 'object'
      && 'planetName' in event.payload
      && typeof event.payload.planetName === 'string'
      && event.payload.planetName.trim() !== '') {
      worldName.set(event.subjectPlanetId, event.payload.planetName);
    }
    if (!worldName.has(event.subjectPlanetId)) continue;
    countConflict(event.subjectPlanetId, event.refId);
  }
  const contested = [...conflictRefs.entries()].sort((left, right) =>
    right[1].size - left[1].size || left[0].localeCompare(right[0]))[0] ?? null;
  const first = input.ranked[0] ?? null;

  return {
    version: 1,
    champion: first === null ? null : {
      commanderName: first.commanderName,
      dominion: dominionScore(first.taken, first.lost),
    },
    clanPodium: input.rankedClans.slice(0, 3).map((clan, index) => ({
      rank: index + 1,
      name: clan.name,
      tag: clan.tag,
      dominion: dominionScore(clan.taken, clan.lost),
    })),
    biggestBattle: !biggest?.defenderPlayerId || !biggest.targetPlanetId ? null : {
        attackerName: commanderName.get(biggest.attackerPlayerId) ?? 'Unknown commander',
        defenderName: commanderName.get(biggest.defenderPlayerId) ?? 'Unknown commander',
        planetName: worldName.get(biggest.targetPlanetId) ?? 'Unknown world',
        totalLossValue: biggestValue,
        occurredAt: biggest.createdAt.toISOString(),
      },
    sharpestDominionSwing: !sharpest?.defenderPlayerId
      || sharpest.dominionSwing === null ? null : {
        attackerName: commanderName.get(sharpest.attackerPlayerId) ?? 'Unknown commander',
        defenderName: commanderName.get(sharpest.defenderPlayerId) ?? 'Unknown commander',
        amount: sharpest.dominionSwing,
        occurredAt: sharpest.createdAt.toISOString(),
      },
    mostContestedWorld: contested === null ? null : {
      planetName: worldName.get(contested[0]) ?? 'Unknown world',
      events: contested[1].size,
    },
  };
}
