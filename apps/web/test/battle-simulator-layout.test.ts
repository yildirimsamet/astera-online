import { describe, expect, it } from 'vitest';
import { buildReplayTimeline } from '../src/battle-simulator/timeline.js';
import { HULLS } from '@astera/rules';
import { DEFAULT_SCENARIO, simulateScenario } from '../src/battle-simulator/scenario.js';
import { battlefieldEnvironment, destructionScale, layoutBattle, shieldIntercept } from '../src/battle-simulator/sceneLayout.js';

describe('battle formation identity and portrait composition', () => {
  it('keeps every ground unit on the planet even at the 400-unit scenario boundary', () => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    scenario.attackers[0]!.fleet = { DART: 1 };
    scenario.defenders[0]!.fleet = { BASTION: 133, HARPOON: 133, THORN: 133 };
    const { recording } = simulateScenario(scenario), poses = layoutBattle(recording);
    const { planet } = battlefieldEnvironment(recording, poses);
    const ground = recording.ships.filter(ship => HULLS[ship.hull].ground);
    expect(ground).toHaveLength(399);
    expect(new Set(ground.map(ship => JSON.stringify(poses.get(ship.id))))).toHaveProperty('size', 399);
    for (const ship of ground) {
      const pose = poses.get(ship.id)!;
      const radius = Math.hypot(pose.x - planet.x, pose.y - planet.y, pose.z - planet.z);
      // A gun stands on its own plinth: the pose is where that plinth meets the ground.
      expect(radius).toBeGreaterThanOrEqual(planet.radius);
      expect(radius).toBeLessThan(planet.radius + .05);
    }
  });
  // Owner 2026-10-26: scattered guns looked silly, and 50 or 100 shrank into one blob on a small planet.
  it.each([6, 20, 50, 100])('sets %i ground guns in ordered batteries facing the attacker, on a planet big enough to hold them', count => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    const third = Math.floor(count / 3);
    scenario.attackers[0]!.fleet = { DART: 1 };
    scenario.defenders[0]!.fleet = { RAMPART: 4, BASTION: third, HARPOON: third, THORN: count - 2 * third };
    const { recording } = simulateScenario(scenario), poses = layoutBattle(recording);
    const { planet } = battlefieldEnvironment(recording, poses);
    const guns = recording.ships.filter(ship => HULLS[ship.hull].ground).map(ship => ({ ship, pose: poses.get(ship.id)! }));
    expect(guns).toHaveLength(count);
    for (const { pose } of guns) {
      expect(pose.scale).toBe(1);
      // Every gun sits on the face the attacker's camera sees.
      const n = { x: pose.x - planet.x, y: pose.y - planet.y, z: pose.z - planet.z }, length = Math.hypot(n.x, n.y, n.z);
      expect((n.y * .82 - n.z * .58) / length / Math.hypot(.82, .58)).toBeGreaterThan(.3);
    }
    for (let i = 0; i < guns.length; i++) for (let j = i + 1; j < guns.length; j++) {
      const a = guns[i]!.pose, b = guns[j]!.pose;
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(1.1);
    }
    // Read front row to back row, left to right: each kind of gun is one unbroken battery.
    const rows = [...new Set(guns.map(({ pose }) => pose.y.toFixed(3)))];
    expect(rows.length).toBeLessThanOrEqual(Math.ceil(count / 4));
    const reading = [...guns].sort((a, b) => a.pose.y - b.pose.y || a.pose.x - b.pose.x).map(({ ship }) => ship.hull);
    expect(reading.filter((hull, i) => i > 0 && hull !== reading[i - 1]).length).toBe(2);
    expect(planet.radius).toBeGreaterThanOrEqual(6);
    if (count === 100) {
      const twenty = structuredClone(scenario);
      twenty.defenders[0]!.fleet = { RAMPART: 4, BASTION: 6, HARPOON: 6, THORN: 8 };
      const small = simulateScenario(twenty).recording;
      expect(planet.radius).toBeGreaterThan(battlefieldEnvironment(small, layoutBattle(small)).planet.radius);
    }
  });

  it('fits sixteen ships side by side and starts a new row at seventeen', () => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    scenario.attackers[0]!.fleet = { DART: 33 };
    const { recording } = simulateScenario(scenario), poses = layoutBattle(recording);
    const rows = new Map<number, number>();
    for (const ship of recording.ships.filter(ship => ship.side === 'ATTACK')) {
      const z = poses.get(ship.id)!.z; rows.set(z, (rows.get(z) ?? 0) + 1);
    }
    expect([...rows.values()]).toEqual([16, 16, 1]);
  });
  it('keeps attackers outside a wide sixteen-capital-ship Aegis formation', () => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    scenario.attackers[0]!.fleet = { CATACLYSM: 16 };
    scenario.defenders[0]!.fleet = { CATACLYSM: 16 };
    const { recording } = simulateScenario(scenario), poses = layoutBattle(recording);
    const { aegis } = battlefieldEnvironment(recording, poses);
    for (const ship of recording.ships.filter(ship => ship.side === 'ATTACK')) {
      const pose = poses.get(ship.id)!;
      expect(Math.hypot(pose.x - aegis.x, pose.y - aegis.y, pose.z - aegis.z) - pose.scale).toBeGreaterThan(aegis.radius);
    }
  });
  it('removes a destroyed ground unit and its foundation together after its return-fire right, and restores both on rewind', () => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    scenario.aegisLevel = 0; scenario.attackers[0]!.fleet = { CATACLYSM: 8 }; scenario.defenders[0]!.fleet = { THORN: 1 };
    const { recording } = simulateScenario(scenario), timeline = buildReplayTimeline(recording);
    const gun = recording.ships.find(ship => ship.hull === 'THORN')!;
    const death = timeline.events.find(event => event.kind === 'DESTROY' && event.shipId === gun.id)!;
    const reply = timeline.events.find(event => event.kind === 'SHOT' && event.shot.sourceId === gun.id)!;
    if (reply.kind !== 'SHOT') throw new Error('Expected the ground gun return fire');
    expect(destructionScale(death.at, reply.impactEnd)).toBe(1);
    expect(destructionScale(death.at, death.at + 1)).toBe(0);
    expect(destructionScale(death.at, 0)).toBe(1);
    expect(destructionScale(undefined, 100)).toBe(1);
  });
  it('places every real unit once, separates opposing sides and anchors ground defences behind the defending fleet', () => {
    const { recording } = simulateScenario(DEFAULT_SCENARIO);
    const positions = layoutBattle(recording);
    expect(positions.size).toBe(recording.ships.length);
    for (const ship of recording.ships) {
      const pose = positions.get(ship.id)!;
      expect(ship.side === 'ATTACK' ? pose.z < 0 : pose.z > 0).toBe(true);
      expect(pose.scale).toBeGreaterThan(0);
      if (HULLS[ship.hull].ground) expect(pose.y).toBeLessThan(0);
    }
    expect(layoutBattle(recording)).toEqual(positions);
    const defence = recording.ships.filter(s => s.side === 'DEFENCE');
    const space = defence.filter(s => !HULLS[s.hull].ground).map(s => positions.get(s.id)!.z);
    for (const gun of defence.filter(s => HULLS[s.hull].ground)) expect(positions.get(gun.id)!.z).toBeGreaterThan(Math.max(...space));
  });

  it('puts Nullifiers at the front and cargo and collectors strictly behind the fighting line at a smaller scale', () => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    scenario.attackers[0]!.fleet.GARBAGE_COLLECTOR = 1;
    const { recording } = simulateScenario(scenario), poses = layoutBattle(recording);
    const own = recording.ships.filter(ship => ship.side === 'ATTACK');
    const nullifiers = own.filter(ship => ship.hull === 'NULLIFIER').map(ship => Math.abs(poses.get(ship.id)!.z));
    const fighters = own.filter(ship => ship.hull !== 'NULLIFIER' && ship.attack > 0).map(ship => Math.abs(poses.get(ship.id)!.z));
    const support = own.filter(ship => HULLS[ship.hull].cls === 'SUPPORT').map(ship => Math.abs(poses.get(ship.id)!.z));
    expect(Math.max(...nullifiers)).toBeLessThan(Math.min(...fighters));
    expect(Math.min(...support)).toBeGreaterThan(Math.max(...fighters));
    expect(Math.max(...[...poses.values()].map(pose => pose.scale))).toBeLessThan(3.5);
  });

  it('encloses the planet and every defender with Aegis, keeps the attackers outside and intercepts incoming rays on its surface', () => {
    const { recording } = simulateScenario(DEFAULT_SCENARIO), poses = layoutBattle(recording);
    const { planet, aegis } = battlefieldEnvironment(recording, poses);
    const distance = (point: { x: number; y: number; z: number }) => Math.hypot(point.x - aegis.x, point.y - aegis.y, point.z - aegis.z);
    expect(distance(planet) + planet.radius).toBeLessThan(aegis.radius);
    for (const ship of recording.ships) {
      if (ship.side === 'DEFENCE') expect(distance(poses.get(ship.id)!)).toBeLessThan(aegis.radius);
      else expect(distance(poses.get(ship.id)!)).toBeGreaterThan(aegis.radius);
    }
    const source = poses.get(recording.ships.find(ship => ship.side === 'ATTACK')!.id)!;
    const target = poses.get(recording.ships.find(ship => ship.side === 'DEFENCE')!.id)!;
    const intercept = shieldIntercept(source, target, aegis);
    expect(distance(intercept)).toBeCloseTo(aegis.radius);
    expect(Math.hypot(intercept.x - source.x, intercept.y - source.y, intercept.z - source.z))
      .toBeLessThan(Math.hypot(target.x - source.x, target.y - source.y, target.z - source.z));
  });
});
