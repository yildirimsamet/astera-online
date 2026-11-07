import { STARTER, mulberry32, starterBattle, vesselAegisHp, type HullId } from '@astera/rules';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { scenarioFromReplay } from '../src/battle-simulator/fromReplay.js';
import { DEFAULT_SCENARIO, STARTER_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';

const fight = (over: object) => scenarioSchema.parse({
  seed: 77, galaxy: 'STARTER', aegisLevel: 1, aegisCharge: 100,
  attackers: [{ id: '1', fleet: { DART: 6 } }], defenders: [{ id: '1', fleet: { DART: 3 } }], ...over,
});

describe('the simulator aboard a ship', () => {
  it('fights exactly as this galaxy fights: same solver, same tempo, same wall', () => {
    const simulated = simulateScenario(fight({})).result;
    const real = starterBattle(
      [{ contributionId: 'a:1', playerId: 'a:1', fleet: { DART: 6 }, tech: { tech: { SHIP_POWER: 0, SHIP_ARMOR: 0, SHIP_SHIELDS: 0, EMPLACEMENT_DOCTRINE: 0 } }, damage: [] }],
      [{ stackId: 'd:1', playerId: 'd:1', fleet: { DART: 3 }, tech: { tech: { SHIP_POWER: 0, SHIP_ARMOR: 0, SHIP_SHIELDS: 0, EMPLACEMENT_DOCTRINE: 0 } }, damage: [] }],
      vesselAegisHp(1), mulberry32(77),
    );
    expect(simulated.grade).toBe(real.grade);
    expect(simulated.attackerSurvivors).toEqual(real.attackerSurvivors);
    expect(simulated.defenderSurvivors).toEqual(real.defenderSurvivors);
  });

  it('reads the wall from the ship ladder and stops it where the ladder stops', () => {
    expect(simulateScenario(fight({ aegisLevel: 1 })).aegisCapacity).toBe(vesselAegisHp(1));
    expect(simulateScenario(fight({ aegisLevel: 2 })).aegisCapacity).toBe(vesselAegisHp(2));
    expect(simulateScenario(fight({ aegisLevel: 9 })).aegisCapacity).toBe(vesselAegisHp(STARTER.combat.aegisMax));
  });

  it('leaves the main game alone: a scenario that names no galaxy fights at the main tempo', () => {
    expect(scenarioSchema.parse({ ...DEFAULT_SCENARIO }).galaxy).toBe('MAIN');
    expect(simulateScenario(DEFAULT_SCENARIO).aegisCapacity).toBeGreaterThan(vesselAegisHp(2));
    const main = simulateScenario(fight({ galaxy: 'MAIN', aegisLevel: 0 })).recording.rounds[0]!;
    const here = simulateScenario(fight({ aegisLevel: 0 })).recording.rounds[0]!;
    const hurt = (round: typeof main) => JSON.stringify(round.after);
    expect(hurt(main)).not.toBe(hurt(here));
  });

  it('opens on the ships this galaxy can build', () => {
    const fielded = [...STARTER_SCENARIO.attackers, ...STARTER_SCENARIO.defenders].flatMap(side => Object.keys(side.fleet) as HullId[]);
    expect(fielded.length).toBeGreaterThan(0);
    for (const hull of fielded) expect((STARTER.hulls as readonly string[]).includes(hull)).toBe(true);
    expect(STARTER_SCENARIO.galaxy).toBe('STARTER');
    expect(STARTER_SCENARIO.aegisLevel).toBeLessThanOrEqual(STARTER.combat.aegisMax);
  });

  it('reads a report from here back at the same wall', () => {
    const simulated = simulateScenario(fight({ aegisLevel: 2 }));
    const replay = { ...simulated.recording, recording: simulated.recording, owners: simulated.owners, environment: 'PLANET' as const,
      seed: 77, aegisCapacity: simulated.aegisCapacity, defenceOffline: false, escape: null };
    const back = scenarioFromReplay(replay, { galaxy: 'STARTER' });
    expect(back.galaxy).toBe('STARTER');
    expect(back.aegisLevel).toBe(2);
    expect(back.aegisCharge).toBe(100);
  });
});

describe('the reading of a target from a ship', () => {
  const ship = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
    id: 'them', body: 'VESSEL', intel: 'RESOLVED', isSelf: false, isOwned: false, position: { x: 1, y: 2, z: 3 },
    state: { kind: 'NORMAL' }, satellites: [], coreLevel: 1, coreTier: 1, shielded: true, kind: 'CAPITAL', ...over,
  } as GalaxyPlanet);
  const read = (aboard: boolean) => renderHook(() => useTargetReading({
    target: { kind: 'world', world: ship() }, reports: [], tech: {}, wing: { DART: 6 }, rulesetVersion: 99, aboard,
  })).result.current;

  it('holds an unread dome to the most a ship can carry, not the main ladder', () => {
    const noted = read(true);
    const main = read(false);
    expect(noted.power).not.toBeNull();
    expect(noted.domeCeiling).toBe(vesselAegisHp(STARTER.combat.aegisMax));
    expect(main.domeCeiling).not.toBe(noted.domeCeiling);
  });

  it('draws no retreat line: nothing runs in this galaxy', () => {
    expect(read(true).escape).toBeNull();
    expect(read(false).escape).not.toBeNull();
  });
});
