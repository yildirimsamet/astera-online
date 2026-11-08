import { describe, expect, it } from 'vitest';
import { huntStage } from '../src/starter/hunt.js';

/**
 * WHERE THE FIRST HUNT STANDS (plan §5, F4e), read off what the map, the intel and the sky already
 * hold: the two outposts the map marks, the reports on them, and this ship's own flights.
 */
const posts = [{ id: 'tevis', firstHunt: true }, { id: 'ash' }, { id: 'eldeth', firstHunt: true }];
const report = (id: string, current = true) => ({ targetPlanetId: id, spatiallyCurrent: current });
const probe = (id: string) => ({ kind: 'probe', targetPlanetId: id, leg: 'outbound' as const });
const raid = (id: string, leg: 'outbound' | 'return' = 'outbound') => ({ kind: 'fleet', targetPlanetId: id, leg });

describe('the first hunt', () => {
  it('is not on while the map marks no outpost for it', () => {
    expect(huntStage([{ id: 'ash' }], [], [])).toBeNull();
  });

  it('asks for a probe on the first outpost nobody has read yet', () => {
    expect(huntStage(posts, [], [])).toEqual({ stage: 'probe', target: 'tevis' });
    expect(huntStage(posts, [report('tevis')], [])).toEqual({ stage: 'probe', target: 'eldeth' });
  });

  it('asks again for one whose report has gone stale', () => {
    expect(huntStage(posts, [report('tevis', false), report('eldeth')], [])).toEqual({ stage: 'probe', target: 'tevis' });
  });

  it('does not ask for a probe already flying there, and waits while they fly', () => {
    expect(huntStage(posts, [], [probe('tevis')])).toEqual({ stage: 'probe', target: 'eldeth' });
    expect(huntStage(posts, [], [probe('tevis'), probe('eldeth')])).toEqual({ stage: 'probing' });
    expect(huntStage(posts, [report('tevis')], [probe('eldeth')])).toEqual({ stage: 'probing' });
  });

  it('asks for the choice once both guards are read', () => {
    expect(huntStage(posts, [report('tevis'), report('eldeth')], [])).toEqual({ stage: 'decide' });
  });

  // A report on some other outpost, or a probe flying to it, is not this hunt.
  it('reads only the two outposts it marks', () => {
    expect(huntStage(posts, [report('ash')], [probe('ash')])).toEqual({ stage: 'probe', target: 'tevis' });
  });

  it('says the fleet is on its way while it flies to one, whatever is read', () => {
    expect(huntStage(posts, [report('tevis')], [raid('tevis')])).toEqual({ stage: 'raid' });
    expect(huntStage(posts, [], [raid('eldeth')])).toEqual({ stage: 'raid' });
  });

  // On the way home the battle is behind it: what comes next is the choice again.
  it('lets the fleet home go back to the choice', () => {
    expect(huntStage(posts, [report('tevis'), report('eldeth')], [raid('tevis', 'return')])).toEqual({ stage: 'decide' });
  });
});
