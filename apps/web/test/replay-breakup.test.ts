import { describe, expect, it } from 'vitest';
import { createBattleRecording, mulberry32, resolveBattle } from '@astera/rules';
import { buildReplayTimeline, sampleReplay } from '../src/battle-simulator/timeline.js';

/**
 * KRİTİK HASAR IN THE REPLAY (combat v3). A ship hit below 70% of its hull may break apart
 * at the round's end without any shot taking it to zero. The replay must blow it up there,
 * in that round, like any other kill — not keep it flying and drop it at the next round.
 */
function recordedBreakup() {
  for (let seed = 1; seed < 200; seed++) {
    const recording = createBattleRecording();
    resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { DART: 12 }, tech: { tech: {} } }],
      [{ stackId: 'd', playerId: 'd', fleet: { DART: 12 }, tech: { tech: {} } }], 0, mulberry32(seed), 'HP_PLANET', false, recording);
    const round = recording.rounds.find((r) => (r.exploded?.length ?? 0) > 0);
    if (round) return { recording, round, shipId: round.exploded![0]! };
  }
  throw new Error('no recorded break-up');
}

describe('a ship that breaks apart', () => {
  it('explodes in the round it broke, after the fire and before the retreats', () => {
    const { recording, round, shipId } = recordedBreakup();
    const timeline = buildReplayTimeline(recording);
    const turn = timeline.rounds.find((r) => r.round === round.round)!;
    const destroy = timeline.events.find((e) => e.kind === 'DESTROY' && e.shipId === shipId && e.round === round.round);
    expect(destroy).toBeDefined();
    expect(destroy!.at).toBeLessThanOrEqual(turn.retreatAt);
    const lastImpact = Math.max(...timeline.events.filter((e) => e.kind === 'HIT' && e.round === round.round).map((e) => e.at));
    expect(destroy!.at).toBeGreaterThan(lastImpact);
    expect(sampleReplay(timeline, destroy!.at - 0.01).ships.get(shipId)!.status).toBe('ACTIVE');
    const after = sampleReplay(timeline, turn.retreatAt).ships.get(shipId)!;
    expect(after.status).toBe('DESTROYED');
    expect(after.hp).toBe(0);
  });
});
