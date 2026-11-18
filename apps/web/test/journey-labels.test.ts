import { describe, expect, it } from 'vitest';
import { STARTER_TUTORIAL_STEPS } from '../src/api/starterTutorialSteps.js';
import { journeyLabel } from '../src/screens/journeyLabels.js';

/** Code review 2026-11-19: the journey board named old steps and left the guide's newer ones as raw codes. */
describe('the journey board\'s labels', () => {
  it('names every step the guide can speak', () => {
    expect(STARTER_TUTORIAL_STEPS.filter(id => journeyLabel(id) === id)).toEqual([]);
  });

  it('names the probe launcher as the game does', () => {
    expect(journeyLabel('SURVEY')).toBe('Sonda rampası onarımı');
    expect(journeyLabel('orderSurvey')).toBe('Sonda rampasını onar');
  });
});
