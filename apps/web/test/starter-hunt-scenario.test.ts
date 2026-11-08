import { openingProgress, type VesselProgress } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { huntStage } from '../src/starter/hunt.js';
import { opportunities, type OpportunityInput } from '../src/starter/opportunities.js';

/**
 * THE FIRST HUNT, START TO END (plan §5, F4g). What the line names at each step of a player's first
 * hunt, read the way the galaxy reads it: the map's marks, the reports, this ship's own flights. A loss
 * sends the player back to the choice with the reports still in hand; the first win ends the hunt,
 * because the map stops marking its outposts.
 */
const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 2, TELESCOPE: 1, SURVEY: 1, VAULT: 1, SHIPYARD: 1 }, facts: ['FIRST_PROBE_REPORT'] };
const poor = { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 };
const marked = [{ id: 'tevis', firstHunt: true }, { id: 'eldeth', firstHunt: true }, { id: 'ash' }];
const unmarked = marked.map(({ id }) => ({ id }));
const read = (...ids: string[]) => ids.map(targetPlanetId => ({ targetPlanetId, spatiallyCurrent: true }));
const flying = (kind: 'probe' | 'fleet', id: string, leg: 'outbound' | 'return' = 'outbound') => ({ kind, targetPlanetId: id, leg });

const line = (hunt: OpportunityInput['hunt'], mining: boolean) => opportunities({
  progress, queue: [], held: poor, income: { alloyPerHour: 60, crystalPerHour: 0 }, features: ['production', 'telescope', 'intel', 'fleet'], mining, hunt,
})[0];

describe('a first hunt, step by step', () => {
  it('names each step while the Prospector is out, and ends with the first win', () => {
    const steps = [
      huntStage(marked, [], []),
      huntStage(marked, [], [flying('probe', 'tevis')]),
      huntStage(marked, [], [flying('probe', 'tevis'), flying('probe', 'eldeth')]),
      huntStage(marked, read('tevis', 'eldeth'), []),
      huntStage(marked, read('tevis', 'eldeth'), [flying('fleet', 'tevis')]),
      // Repelled: the survivors fly home and the choice is back, the reports still current.
      huntStage(marked, read('tevis', 'eldeth'), [flying('fleet', 'tevis', 'return')]),
      // Won: the map marks nothing more.
      huntStage(unmarked, read('tevis', 'eldeth'), [flying('fleet', 'eldeth', 'return')]),
    ];
    expect(steps).toEqual([
      { stage: 'probe', target: 'tevis' },
      { stage: 'probe', target: 'eldeth' },
      { stage: 'probing' },
      { stage: 'decide' },
      { stage: 'raid' },
      { stage: 'decide' },
      null,
    ]);
    expect(steps.map(hunt => line(hunt, true).kind)).toEqual(['hunt', 'hunt', 'hunt', 'hunt', 'hunt', 'hunt', 'underway']);
  });

  it('waits for the Prospector to go first: the first mining run leads until it is out', () => {
    expect(line({ stage: 'probe', target: 'tevis' }, false)).toEqual({ kind: 'mine' });
  });

  // Beaten to it: the map stops marking the outpost someone else cleared, and the hunt points at the other.
  it('turns to the other outpost when one is taken by someone else', () => {
    const taken = [{ id: 'tevis' }, { id: 'eldeth', firstHunt: true }];
    expect(huntStage(taken, read('tevis'), [])).toEqual({ stage: 'probe', target: 'eldeth' });
    expect(huntStage(taken, read('tevis', 'eldeth'), [])).toEqual({ stage: 'decide' });
  });
});
