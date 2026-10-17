import { expect, it } from 'vitest';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';

const member = (id: string, tier: number, navy: number, loss = 0, lootLost = 0) => ({
  id, tier, navy, weight: 10_000, civilianWeight: 0, loss, combatLoss: loss, lootLost,
});
const opening = (retaliationLootPercent?: 20 | 40): HonorEvidence => ({
  source: 'WORLD', id: 'opening', at: 1, eligible: true,
  ...(retaliationLootPercent === undefined ? {} : { retaliationLootPercent }),
  attack: [member('small', 2, 50_000)], defence: [member('large', 3, 100_000, 10_000, 20_000)],
  relations: [{ a: 'small', b: 'large', related: false }],
});
const counter = (id: string, at: number, loss: number, lootLost: number, retaliationLootPercent?: 20 | 40): HonorEvidence => ({
  source: 'WORLD', id, at, eligible: true,
  ...(retaliationLootPercent === undefined ? {} : { retaliationLootPercent }),
  attack: [member('large', 3, 100_000)], defence: [member('small', 2, 50_000, loss, lootLost)],
  relations: [{ a: 'large', b: 'small', related: false }],
});

it.each([3, 4] as const)('preserves historical grants while new v%s launches grant 40%% loot value', version => {
  expect(replayHonor([opening()], version).retaliations[0]?.remaining).toBe(70_000);
  expect(replayHonor([opening(20)], version).retaliations[0]?.remaining).toBe(70_000);
  expect(replayHonor([opening(40)], version).retaliations[0]?.remaining).toBe(90_000);
});

it.each([3, 4] as const)('uses each launch weight across delayed replay, prior budgets and exact exhaustion (v%s)', version => {
  const old = opening(), first = counter('first', 2, 10_000, 10_000, 40);
  const exhausted = counter('exhausted', 3, 0, 1, 40);
  const r = replayHonor([exhausted, first, old], version);
  expect(r).toEqual(replayHonor([old, first, exhausted], version));
  expect(r.events[1]?.attack.total).toBe(0);
  expect(r.events[1]?.pool.attack.exposures[0]?.retaliationSpentFifths).toBe(70_000);
  expect(r.events[2]?.attack.total).toBeLessThan(0);
  expect(r.events[2]?.pool.attack.exposures[0]?.retaliationSpentFifths).toBe(0);
  expect(replayHonor([opening(40), counter('old-flight', 2, 10_000, 20_000)], version)
    .retaliations.find(row => row.holder === 'large')?.remaining).toBe(20_000);
});

it('shares a prior budget across simultaneous new attacks without doubling it', () => {
  const r = replayHonor([opening(), counter('a', 2, 0, 100_000, 40), counter('b', 2, 0, 100_000, 40)], 4);
  expect(r.events.slice(1).flatMap(row => row.pool.attack.exposures)
    .reduce((sum, row) => sum + row.retaliationSpentFifths, 0)).toBe(70_000);
  expect(r.events[1]?.attack.total).toBeLessThan(0);
  expect(r.events[2]?.attack.total).toBeLessThan(0);
});

it('expires the new weighted budget at exactly 24 hours', () => {
  const first = opening(40);
  expect(replayHonor([first, counter('before', first.at + 86_399_999, 18_000, 0, 40)], 4).events[1]?.attack.total).toBe(0);
  expect(replayHonor([first, counter('at', first.at + 86_400_000, 18_000, 0, 40)], 4).events[1]?.attack.total).toBeLessThan(0);
});
