import { HULLS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline, sampleReplay } from '../src/battle-simulator/timeline.js';
import { layoutBattle, retreatDestinations, sampleRetreatPose } from '../src/battle-simulator/sceneLayout.js';

describe('escaped units remain alive outside the battlefield', () => {
  const run = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 0, aegisLevel: 0,
    attackers: [{ id: 'a', fleet: { DART: 36 } }], defenders: [{ id: 'd', fleet: { DART: 18 } }] }));
  const timeline = buildReplayTimeline(run.recording), poses = layoutBattle(run.recording);

  it('only exposes escapes that have happened, with their true identity, round and remaining health', () => {
    const retreats = timeline.events.filter(event => event.kind === 'RETREAT');
    expect(retreats.length).toBeGreaterThan(0);
    for (const event of retreats) {
      expect(sampleReplay(timeline, event.at - .001).retreats.some(item => item.shipId === event.shipId)).toBe(false);
      const frame = sampleReplay(timeline, event.at + .5);
      expect(frame.retreats).toContainEqual(event);
      const state = frame.ships.get(event.shipId)!;
      expect(state.hp).toBeGreaterThan(0);
      expect(state.status).toBe('RETREATED');
      const source = run.recording.ships.find(ship => ship.id === event.shipId)!;
      expect(HULLS[source.hull].ground).toBe(false);
      expect(timeline.events.some(item => item.at > event.at && (item.kind === 'SHOT' && item.shot.sourceId === event.shipId
        || item.kind === 'HIT' && item.hit.targetId === event.shipId))).toBe(false);
    }
    expect(sampleReplay(timeline, 0).retreats).toEqual([]);
  });

  it('turns and flies continuously to a distinct parking position, preserving a visible model', () => {
    const destinations = retreatDestinations(timeline, poses);
    expect(destinations.size).toBeGreaterThan(0);
    expect(new Set([...destinations.values()].map(pose => `${pose.x},${pose.z}`)).size).toBe(destinations.size);
    for (const event of timeline.events.filter(item => item.kind === 'RETREAT')) {
      const ship = run.recording.ships.find(item => item.id === event.shipId)!;
      const origin = poses.get(ship.id)!, destination = destinations.get(ship.id)!;
      const before = sampleRetreatPose(origin, destination, ship.side, -.01);
      expect(before.x).toBe(origin.x); expect(before.z).toBe(origin.z);
      const after = sampleRetreatPose(origin, destination, ship.side, 5);
      expect(after.x).toBeCloseTo(destination.x); expect(after.z).toBeCloseTo(destination.z);
      expect(after.scale).toBeGreaterThan(0);
      expect(Math.abs(after.yaw - (ship.side === 'ATTACK' ? 0 : Math.PI))).toBeGreaterThan(.1);
      const p1 = sampleRetreatPose(origin, destination, ship.side, .8);
      const p2 = sampleRetreatPose(origin, destination, ship.side, .80001);
      expect(Math.hypot(p1.x - p2.x, p1.z - p2.z)).toBeLessThan(.01);
    }
  });
});
