import { describe, expect, it } from 'vitest';
import { asteroidPosition, distance } from '@astera/rules';
import { createSchool, schoolAction, tickSchool, schoolScene, schoolRock, schoolPlanet } from '../src/onboarding/flightSchool/world.js';

describe('complete training journey', () => {
  it('completes every commitment with a finite budget, a moving interception, and an effective defence', () => {
    let now = 1_800_000_000_000;
    let w = createSchool(now);
    let count = 0;
    while (w.scene !== 'departure' && count++ < 60) {
      const scene = schoolScene(w);
      const kind = scene.kind;
      if (kind === 'order') w = schoolAction(w, { kind, subject: scene.subject!, count: scene.count ?? 1 }, now);
      else if (kind === 'report' || kind === 'read' || kind === 'range') w = schoolAction(w, { kind: 'continue' }, now);
      else w = schoolAction(w, { kind }, now);
      if (w.flight?.kind === 'mine') {
        const f = w.flight;
        const at = asteroidPosition({ ...schoolRock(w), index: 0 }, (f.arriveAt - w.startedAt) / 60_000);
        expect(distance(at, f.to)).toBeLessThan(0.01);
        expect(f.arriveAt - f.departAt).toBeGreaterThan(3000);
        expect(f.homeAt - f.departAt).toBeLessThan(45_000);
      }
      if (w.pending) now = w.pending.finishesAt.getTime();
      if (w.flight) now = w.flight.homeAt;
      w = tickSchool(w, now);
    }
    expect(w.scene).toBe('departure');
    expect(w.reports).toHaveLength(2);
    expect(w.reports[0]?.grade).toBe('DECISIVE');
    expect(w.reports[0]?.neutral).toBe(false);
    expect(w.reports[1]?.grade).toBe('REPELLED');
    expect(w.reports[1]?.theirLosses.RAMPART).toBeGreaterThan(0);
    expect(w.reports[1]?.shieldAbsorbed).toBeGreaterThan(0);
    expect(w.probeAt).not.toBeNull();
    expect(schoolPlanet(w).planet.shield).toBe(w.reports[1]!.rounds.at(-1)!.shieldAfter);
    expect(w.resources.alloy).toBeGreaterThanOrEqual(0);
  });
});
