import { expect, it } from 'vitest';
import { buildWorld } from '../packages/sim/src/season.js';
import { summarizeProfiles } from './economy-season-calendar-study.js';

it('reports final home holdings separately from technology and colony ownership', () => {
  const world = buildWorld({ players: 5, days: 1, seed: 42, activityProfiles: ['average', 'low', 'low-once'], spendingArchetype: 'CASUAL' });
  world.players[0]!.fleet = { TEMPEST: 2 };
  world.neutrals[0]!.controllerId = 0;
  const groups = summarizeProfiles(world);
  expect(groups.map(g => g.players)).toEqual([2, 2, 1]);
  expect(groups[0]!.colonyOwners).toBe(1);
  expect(groups[0]!.homeT3Holders).toBe(1);
  expect(groups[0]!.homeT4Holders).toBe(0);
  expect(groups[1]!.colonyOwners).toBe(0);
});
