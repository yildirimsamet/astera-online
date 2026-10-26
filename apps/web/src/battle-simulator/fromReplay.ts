import { HULLS, fleetEntries, shieldHp, type BattleReplayData, type BattleShipSnapshot, type Fleet, type HullId } from '@astera/rules';
import { DEFAULT_SCENARIO, type BattleScenario, type SimulationParticipant } from './scenario.js';

const SEATS = 5;

/**
 * A recorded battle as a simulator scenario: the same sides, wounds, research, Aegis and battlefield,
 * so a player can change one thing and fight it again. Only what the replay holds is read — the
 * simulator learns nothing the viewer could not already watch. The pirate level is not in a replay;
 * the report passes it.
 */
export function scenarioFromReplay(replay: Omit<BattleReplayData, 'result' | 'control'>, options: { seed?: number; pirateLevel?: number } = {}): BattleScenario {
  const { recording, environment } = replay;
  const side = (key: 'ATTACK' | 'DEFENCE') => {
    const owners = replay.owners.filter(owner => owner.side === key);
    const ships = recording.ships.filter(ship => ship.side === key);
    // The planet's host is the wing that owns the guns, and the simulator seats it first.
    const host = (stackId: string) => ships.some(ship => ship.stackId === stackId && (ship.ground ?? HULLS[ship.hull].ground));
    owners.sort((a, b) => Number(host(b.stackId)) - Number(host(a.stackId)) || a.wing - b.wing);
    const seat = new Map(owners.map((owner, index) => [owner.stackId, Math.min(index, SEATS - 1)]));
    const groups = owners.slice(0, SEATS).map(() => [] as BattleShipSnapshot[]);
    for (const ship of ships) groups[seat.get(ship.stackId) ?? 0]?.push(ship);
    return groups.map((members, index): SimulationParticipant => ({ id: String(index + 1), ...forceOf(members),
      tech: { ...DEFAULT_SCENARIO.attackers[0]!.tech, ...owners[index]!.research } }));
  };
  const attackers = side('ATTACK'), defenders = side('DEFENCE');
  const escaped = replay.escape?.kind === 'ESCAPED' && environment === 'PLANET' && defenders.length === 1;
  if (escaped) for (const [hull, count] of fleetEntries(replay.escape!.ships)) defenders[0]!.fleet[hull] = (defenders[0]!.fleet[hull] ?? 0) + count;
  const capacity = environment === 'PLANET' ? replay.aegisCapacity : 0;
  let aegisLevel = 0;
  while (aegisLevel < 20 && shieldHp(aegisLevel + 1) <= capacity) aegisLevel++;
  return {
    ...DEFAULT_SCENARIO, seed: options.seed ?? DEFAULT_SCENARIO.seed, environment, aegisLevel,
    aegisCharge: capacity > 0 ? Math.min(100, Math.round(recording.initialAegis / capacity * 100)) : 100,
    defenceOffline: replay.defenceOffline, automaticEscape: escaped,
    pirateLevel: environment === 'MONUMENT' && defenders.length === 1 ? pirateLevel(options.pirateLevel) : 0,
    attackers, defenders,
  };
}

/** Counts per hull, and each hull's average remaining hull as the simulator's health. */
function forceOf(ships: readonly BattleShipSnapshot[]): Pick<SimulationParticipant, 'fleet' | 'health'> {
  const fleet: Fleet = {}, share = new Map<HullId, number>();
  for (const ship of ships) {
    fleet[ship.hull] = (fleet[ship.hull] ?? 0) + 1;
    share.set(ship.hull, (share.get(ship.hull) ?? 0) + ship.hp / ship.maxHp);
  }
  const health: Partial<Record<HullId, number>> = {};
  for (const [hull, count] of fleetEntries(fleet)) {
    const pct = Math.max(1, Math.min(100, Math.round(share.get(hull)! / count * 100)));
    if (pct < 100) health[hull] = pct;
  }
  return { fleet, health };
}

const pirateLevel = (level: number | undefined): BattleScenario['pirateLevel'] =>
  level === 1 || level === 2 || level === 3 || level === 4 ? level : 0;
