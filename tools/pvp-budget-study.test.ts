import { expect, it } from 'vitest';
import { operationScenario, measureOperations } from './pvp-budget-study.js';
import { evaluateCalendar } from './economy-calendar-model.js';

it('charges replacement and fuel from the development wallet during actual sessions', () => {
  const s = operationScenario(0, 3, 0.225);
  const operations = s.actions.filter(a => a.id.startsWith('op-'));
  expect(operations).toHaveLength(33);
  expect(operations.every(a => a.cost.alloy > 0 && a.cost.deuterium > 0)).toBe(true);
  const r = evaluateCalendar(s);
  for (const a of operations) if (r.started[a.id] !== undefined) {
    expect(r.started[a.id]).toBeGreaterThanOrEqual(a.notBefore!);
    expect(r.started[a.id]).toBeLessThan(a.expiresAt!);
  }
  const m = measureOperations(s, r);
  expect(m.funded + m.missed).toBe(m.offered);
  expect(m.operationSpent.alloy).toBeGreaterThan(0);
  expect(m.operationSpent.alloy).toBeLessThanOrEqual(r.spent.alloy);
  for (const e of Object.values(r.conservationError)) expect(Math.abs(e)).toBeLessThan(1e-7);
});

it('does not invent operations or loot in the no-operation reference', () => {
  const s = operationScenario(0, 0, 0.225);
  const m = measureOperations(s, evaluateCalendar(s));
  expect(m.offered).toBe(0);
  expect(m.operationSpent).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
});
