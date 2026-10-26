import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { shieldHp, type BattleReplayData } from '@astera/rules';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario, type BattleScenario } from '../src/battle-simulator/scenario.js';
import { scenarioFromReplay } from '../src/battle-simulator/fromReplay.js';

/**
 * "TRY IT IN THE SIMULATOR" (owner 2026-10-26). A recorded battle opens in the simulator with the
 * forces that fought it, so the player can change one thing and see what it would have done. The
 * replay is the only source: the simulator learns nothing the replay did not already show.
 */
const scenario = (input: Partial<z.input<typeof scenarioSchema>>) => scenarioSchema.parse({ ...DEFAULT_SCENARIO, ...input });
const replayOf = (input: BattleScenario): BattleReplayData => {
  const run = simulateScenario(input);
  return { recording: run.recording, owners: run.owners, result: { grade: run.result.grade, defenceSalvage: {} }, environment: run.environment,
    aegisCapacity: run.aegisCapacity, defenceOffline: run.defenceOffline, escape: run.escape, control: run.control };
};
const forces = (input: BattleScenario) => ({ environment: input.environment, aegisLevel: input.aegisLevel, aegisCharge: input.aegisCharge,
  defenceOffline: input.defenceOffline, pirateLevel: input.pirateLevel,
  attackers: input.attackers.map(({ fleet, health, tech }) => ({ fleet, health, tech })),
  defenders: input.defenders.map(({ fleet, health, tech }) => ({ fleet, health, tech })) });

describe('a recorded battle opened in the simulator', () => {
  it('brings back both sides, their wounds, their research and the Aegis, and fights the same battle again', () => {
    const fought = scenario({ seed: 7, aegisLevel: 4, aegisCharge: 60,
      attackers: [{ id: '1', fleet: { CORSAIR: 6, NULLIFIER: 2 }, health: { CORSAIR: 70 }, tech: { SHIP_POWER: 3, SHIP_ARMOR: 1, SHIP_SHIELDS: 0, EMPLACEMENT_DOCTRINE: 0 } }],
      defenders: [{ id: '1', fleet: { CITADEL: 2, DART: 5, BASTION: 3, THORN: 2 }, health: { DART: 40 }, tech: { SHIP_POWER: 1, SHIP_ARMOR: 2, SHIP_SHIELDS: 2, EMPLACEMENT_DOCTRINE: 3 } }] });
    const opened = scenarioSchema.parse(scenarioFromReplay(replayOf(fought), { seed: 7 }));
    expect(forces(opened)).toEqual(forces(fought));
    expect(simulateScenario(opened).recording).toEqual(simulateScenario(fought).recording);
  });

  it('puts the host who owns the guns first when a clan defends together', () => {
    const fought = scenario({ seed: 3, aegisLevel: 0,
      attackers: [{ id: '1', fleet: { CORSAIR: 4 } }, { id: '2', fleet: { VIPER: 5 } }],
      defenders: [{ id: '1', fleet: { DART: 3, HARPOON: 2 } }, { id: '2', fleet: { RAMPART: 2 } }] });
    const replay = replayOf(fought);
    const opened = scenarioFromReplay({ ...replay, owners: [...replay.owners].reverse() }, { seed: 3 });
    expect(opened.attackers.map(owner => owner.fleet)).toEqual([{ CORSAIR: 4 }, { VIPER: 5 }]);
    expect(opened.defenders.map(owner => owner.fleet)).toEqual([{ DART: 3, HARPOON: 2 }, { RAMPART: 2 }]);
    expect(scenarioSchema.safeParse(opened).success).toBe(true);
  });

  it('opens a fight in open space without a shield', () => {
    const fought = scenario({ seed: 1, environment: 'MONUMENT', aegisLevel: 0, aegisCharge: 100,
      attackers: [{ id: '1', fleet: { CATACLYSM: 2 } }], defenders: [{ id: '1', fleet: { DART: 2, ARGOSY: 3 } }] });
    const opened = scenarioSchema.parse(scenarioFromReplay(replayOf(fought), { seed: 1 }));
    expect(forces(opened)).toEqual(forces(fought));
  });

  it('takes the pirate level from the report, since the replay does not carry it', () => {
    const fought = scenario({ seed: 2, environment: 'MONUMENT', aegisLevel: 0, aegisCharge: 100, pirateLevel: 3,
      attackers: [{ id: '1', fleet: { CORSAIR: 8 } }], defenders: [{ id: '1', fleet: { VIPER: 4, ARGOSY: 2 } }] });
    const opened = scenarioSchema.parse(scenarioFromReplay(replayOf(fought), { seed: 2, pirateLevel: 3 }));
    expect(forces(opened)).toEqual(forces(fought));
    expect(simulateScenario(opened).recording).toEqual(simulateScenario(fought).recording);
  });

  it('returns the fleet that escaped before the fight, with the escape switched on', () => {
    const fought = scenario({ seed: 0, aegisLevel: 0, automaticEscape: true,
      attackers: [{ id: '1', fleet: { CORSAIR: 20 } }], defenders: [{ id: '1', fleet: { DART: 10, RAMPART: 2, BASTION: 1 } }] });
    const replay = replayOf(fought);
    expect(replay.escape?.kind).toBe('ESCAPED');
    const opened = scenarioSchema.parse(scenarioFromReplay(replay, { seed: 0 }));
    expect(opened.automaticEscape).toBe(true);
    expect(opened.defenders[0]!.fleet).toEqual({ DART: 10, RAMPART: 2, BASTION: 1 });
    expect(simulateScenario(opened).recording).toEqual(simulateScenario(fought).recording);
  });

  it('keeps a defence that was offline offline, and reads the shield level off its capacity', () => {
    const fought = scenario({ seed: 4, aegisLevel: 9, aegisCharge: 100, defenceOffline: true,
      attackers: [{ id: '1', fleet: { CORSAIR: 3 } }], defenders: [{ id: '1', fleet: { DART: 2 } }] });
    const opened = scenarioFromReplay(replayOf(fought), { seed: 4 });
    expect(opened.defenceOffline).toBe(true);
    expect(opened.aegisLevel).toBe(9);
    expect(shieldHp(opened.aegisLevel)).toBe(replayOf(fought).aegisCapacity);
  });

  it('folds a sixth wing into the fifth, since the simulator seats five a side', () => {
    const fought = scenario({ seed: 5, aegisLevel: 0,
      attackers: ['1', '2', '3', '4', '5'].map(id => ({ id, fleet: { DART: 2 } })), defenders: [{ id: '1', fleet: { RAMPART: 3 } }] });
    const replay = replayOf(fought);
    const sixth = { ...replay.owners.find(owner => owner.side === 'ATTACK' && owner.wing === 5)!, stackId: 'a:6', playerId: 'a:6', wing: 6 };
    const moved = replay.recording.ships.find(ship => ship.stackId === 'a:5')!.id;
    const ships = replay.recording.ships.map(ship => ship.id === moved ? { ...ship, stackId: 'a:6', playerId: 'a:6' } : ship);
    const opened = scenarioFromReplay({ ...replay, owners: [...replay.owners, sixth], recording: { ...replay.recording, ships } }, { seed: 5 });
    expect(opened.attackers).toHaveLength(5);
    expect(opened.attackers.reduce((sum, owner) => sum + (owner.fleet.DART ?? 0), 0)).toBe(10);
  });
});
