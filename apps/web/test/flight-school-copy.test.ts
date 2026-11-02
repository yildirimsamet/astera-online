import { expect, it } from 'vitest';
import { schoolCopy } from '../src/onboarding/flightSchool/copy.js';
it('offers growing the Telescope rather than an abstract next-level demonstration', () => {
 expect(schoolCopy('tr').range).toBe('Teleskopu büyüt');
 expect(schoolCopy('en').range).toBe('Expand the Telescope');
});
it('labels worlds outside Telescope reach as unexplored', () => {
  expect(schoolCopy('tr').unexplored).toBe('Keşfedilmemiş');
  expect(schoolCopy('en').unexplored).toBe('Unexplored');
});
it('explains the watch result before starting the range demonstration', () => {
  expect(schoolCopy('tr').scenes.range).toContain('Filo evde');
  expect(schoolCopy('en').scenes.range).toContain('Fleet home');
});

it('shows a moving neighbour fleet before introducing the watch controls', async () => {
  const { nextSchoolScene, sceneById } = await import('../src/onboarding/flightSchool/scenes.js');
  expect(nextSchoolScene('sightCompare')).toBe('traffic');
  expect(sceneById('traffic').kind).toBe('read');
  expect(schoolCopy('tr').scenes.traffic).toContain('Lyra');
  expect(schoolCopy('en').scenes.traffic).toContain('Lyra');
});
