import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { READOUT_SLOTS, buildReplayTimeline, featuredShips, sampleReplay } from '../src/battle-simulator/timeline.js';

/**
 * WORDS ON THE FIELD COST THE SAME AT 22 SHIPS AS AT 1,000 (owner 2026-10-26: 500v500 on a
 * mid-range phone). Bars are drawn on the GPU for every ship; a few pooled labels name the ships
 * the moment is about, in this order: the one the player picked, the one firing, the ones just hit
 * (newest first), the ones leaving.
 */
describe('the ships the field labels', () => {
  const big = () => simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 3, aegisLevel: 0,
    attackers: [{ id: 'a', fleet: { DART: 250, CORSAIR: 250 } }], defenders: [{ id: 'd', fleet: { RAMPART: 250, CITADEL: 250 } }] }));

  it('puts the picked ship first, the firing ship next, then the newest hits, with no ship twice', () => {
    const timeline = buildReplayTimeline(big().recording);
    const shots = timeline.events.filter(event => event.kind === 'SHOT' && event.round === 1);
    const at = shots[40]!.kind === 'SHOT' ? shots[40]!.impactEnd + .05 : 0;
    const frame = sampleReplay(timeline, at);
    const picked = timeline.recording.ships.at(-1)!.id;
    const ids = featuredShips(frame, picked, new Map());
    expect(ids[0]).toBe(picked);
    expect(ids[1]).toBe(frame.activeShot!.shot.sourceId);
    const hits = [...frame.damageBadges].sort((a, b) => b.at - a.at).map(badge => badge.targetId).filter(id => id !== picked && id !== ids[1]);
    expect(ids.slice(2)).toEqual(hits.slice(0, READOUT_SLOTS - 2));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never asks for more labels than the pool holds, however many ships are hit at once', () => {
    const timeline = buildReplayTimeline(big().recording);
    for (let t = 0; t < timeline.duration; t += timeline.duration / 200) {
      const frame = sampleReplay(timeline, t);
      expect(featuredShips(frame, null, new Map()).length).toBeLessThanOrEqual(READOUT_SLOTS);
    }
  });

  it('labels a ship for a moment after it leaves the line, then lets it go', () => {
    const run = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 0, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { DART: 36 } }], defenders: [{ id: 'd', fleet: { DART: 18 } }] }));
    const timeline = buildReplayTimeline(run.recording);
    const retreat = timeline.events.find(event => event.kind === 'RETREAT')!;
    const id = retreat.shipId, leaving = new Map([[id, retreat.at]]);
    expect(featuredShips(sampleReplay(timeline, retreat.at + .5), null, leaving)).toContain(id);
    expect(featuredShips(sampleReplay(timeline, retreat.at + 2), null, leaving)).not.toContain(id);
  });
});
